/* loans-kyc-routes.js — loan applications + multi-step KYC upgrade.
   Uses your existing SQLite database and login middleware. */
const crypto = require('crypto');
const { db } = require('./config/db');
const { requireUser, requireAdmin } = require('./middleware/auth');
let jwt = null; try { jwt = require('jsonwebtoken'); } catch (e) { /* optional */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    amount REAL NOT NULL,
    termMonths INTEGER NOT NULL,
    purpose TEXT, employment TEXT, monthlyIncome REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    adminMessage TEXT,
    seenByUser INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    decidedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS kyc_requests (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    fullName TEXT, dateOfBirth TEXT, idType TEXT, idNumber TEXT, idCountry TEXT, address TEXT, note TEXT,
    adminMessage TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`);

// extra loan columns (safe to run repeatedly)
['loanType TEXT','interestRate REAL','monthlyPayment REAL','totalRepayment REAL'].forEach(function(c){
  try{ db.exec('ALTER TABLE loans ADD COLUMN ' + c); }catch(e){ /* already exists */ }
});

const LOAN_TYPES = [
  { id:'personal',  name:'Personal Loan',  rate:8.9, min:500,   max:50000,   maxTerm:60,  desc:'Flexible funds for any personal need.' },
  { id:'business',  name:'Business Loan',  rate:7.5, min:5000,  max:500000,  maxTerm:84,  desc:'Working capital, equipment or expansion.' },
  { id:'mortgage',  name:'Mortgage Loan',  rate:5.9, min:50000, max:2000000, maxTerm:360, desc:'Buy or refinance a property.' },
  { id:'auto',      name:'Auto Loan',      rate:6.5, min:2000,  max:150000,  maxTerm:72,  desc:'Finance a new or used vehicle.' },
  { id:'education', name:'Education Loan', rate:4.5, min:1000,  max:100000,  maxTerm:120, desc:'Tuition and study costs.' },
  { id:'emergency', name:'Emergency Loan', rate:12,  min:100,   max:5000,    maxTerm:12,  desc:'Quick short-term cash.' }
];
const ALLOWED_TERMS = [3,6,12,24,36,48,60,84,120,180,240,360];
const r2 = (n) => Math.round(n * 100) / 100;
function calcLoan(P, apr, n){
  const r = apr / 1200;
  const monthly = r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
  const total = monthly * n;
  return { monthly: r2(monthly), total: r2(total), interest: r2(total - P) };
}

// Works after requireUser has verified the token; tries the usual places the user id lives.
function uidOf(req){
  const u = req.user || req.auth || {};
  let id = u.id || u._id || u.userId || req.userId;
  if(!id && jwt){
    try{
      const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const p = jwt.decode(t) || {};
      id = p.id || p.userId || p.sub || p._id;
    }catch(e){}
  }
  return id;
}
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const latestKyc = (userId) => db.prepare('SELECT * FROM kyc_requests WHERE userId=? ORDER BY createdAt DESC LIMIT 1').get(userId);
const setUserKyc = (userId, status) => db.prepare('UPDATE users SET kycStatus=? WHERE id=?').run(status, userId);

module.exports = function(app){
  /* ================= LOANS: user ================= */
    app.get('/api/user/loan-types', requireUser, (req, res) => {
    res.json({ types: LOAN_TYPES, terms: ALLOWED_TERMS });
  });
  app.post('/api/user/loans', requireUser, (req, res) => {
    const uid = uidOf(req);
    if(!uid) return res.status(401).json({ error:'Not signed in' });
    const b = req.body || {};
    const type = LOAN_TYPES.find(t => t.id === b.loanType);
    if(!type) return res.status(400).json({ error:'Choose a loan type.' });
    const amount = Number(b.amount);
    const term = parseInt(b.termMonths, 10);
    if(!(amount >= type.min && amount <= type.max))
      return res.status(400).json({ error:`${type.name} amounts are between $${type.min} and $${type.max}.` });
    if(!ALLOWED_TERMS.includes(term) || term > type.maxTerm)
      return res.status(400).json({ error:`Choose a repayment term of up to ${type.maxTerm} months.` });
    const purpose = clean(b.purpose, 300);
    if(!purpose) return res.status(400).json({ error:'Please tell us what the loan is for.' });
    const employment = clean(b.employment, 100);
    const income = (b.monthlyIncome === '' || b.monthlyIncome == null) ? null : Number(b.monthlyIncome);
    if(income != null && !(income >= 0)) return res.status(400).json({ error:'Enter a valid monthly income.' });
    if(db.prepare("SELECT id FROM loans WHERE userId=? AND status='pending'").get(uid))
      return res.status(400).json({ error:'You already have a loan application under review.' });
    const c = calcLoan(amount, type.rate, term);
    db.prepare(`INSERT INTO loans (id,userId,amount,termMonths,purpose,employment,monthlyIncome,status,createdAt,loanType,interestRate,monthlyPayment,totalRepayment)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(crypto.randomUUID(), uid, amount, term, purpose, employment, income, 'pending', Date.now(), type.name, type.rate, c.monthly, c.total);
    res.json({ ok:true });
  });
  
  /* ================= LOANS: admin ================= */
  app.get('/api/admin/loans', requireAdmin, (req, res) => {
    res.json(db.prepare(`SELECT l.*, u.name AS name, u.username AS username FROM loans l
      LEFT JOIN users u ON u.id = l.userId
      ORDER BY (l.status='pending') DESC, l.createdAt DESC LIMIT 500`).all());
  });
  app.post('/api/admin/loans/:id/approve', requireAdmin, (req, res) => {
    const r = db.prepare("UPDATE loans SET status='approved', adminMessage=NULL, seenByUser=0, decidedAt=? WHERE id=? AND status='pending'")
      .run(Date.now(), req.params.id);
    if(!r.changes) return res.status(404).json({ error:'Application not found or already decided.' });
    res.json({ ok:true });
  });
  app.post('/api/admin/loans/:id/decline', requireAdmin, (req, res) => {
    const reason = clean(req.body && req.body.reason, 1000);
    if(!reason) return res.status(400).json({ error:'Please write the reason for declining.' });
    const r = db.prepare("UPDATE loans SET status='declined', adminMessage=?, seenByUser=0, decidedAt=? WHERE id=? AND status='pending'")
      .run(reason, Date.now(), req.params.id);
    if(!r.changes) return res.status(404).json({ error:'Application not found or already decided.' });
    res.json({ ok:true });
  });

  /* ================= KYC: user ================= */
  app.get('/api/user/kyc/status', requireUser, (req, res) => {
    res.json({ request: latestKyc(uidOf(req)) || null });
  });
  // Replaces the old one-click "pending" request: this one creates a request the admin can see.
  app.post('/api/user/kyc/request', requireUser, (req, res) => {
    const uid = uidOf(req);
    const last = latestKyc(uid);
    if(last && ['requested','details_needed','submitted'].includes(last.status))
      return res.status(400).json({ error:'Your upgrade request is already in progress.' });
    if(last && last.status === 'verified')
      return res.status(400).json({ error:'Your account is already verified.' });
    const now = Date.now();
    db.prepare("INSERT INTO kyc_requests (id,userId,status,createdAt,updatedAt) VALUES (?,?,?,?,?)")
      .run(crypto.randomUUID(), uid, 'requested', now, now);
    setUserKyc(uid, 'pending');
    res.json({ ok:true });
  });
  app.post('/api/user/kyc/details', requireUser, (req, res) => {
    const uid = uidOf(req);
    const last = latestKyc(uid);
    if(!last || last.status !== 'details_needed')
      return res.status(400).json({ error:'Your upgrade has not been approved for details yet.' });
    const b = req.body || {};
    const d = { fullName:clean(b.fullName,150), dateOfBirth:clean(b.dateOfBirth,20), idType:clean(b.idType,50),
      idNumber:clean(b.idNumber,60), idCountry:clean(b.idCountry,80), address:clean(b.address,300), note:clean(b.note,500) };
    if(!d.fullName || !d.dateOfBirth || !d.idType || !d.idNumber || !d.idCountry || !d.address)
      return res.status(400).json({ error:'Please complete all required fields.' });
    db.prepare("UPDATE kyc_requests SET status='submitted', fullName=?, dateOfBirth=?, idType=?, idNumber=?, idCountry=?, address=?, note=?, adminMessage=NULL, updatedAt=? WHERE id=?")
      .run(d.fullName, d.dateOfBirth, d.idType, d.idNumber, d.idCountry, d.address, d.note, Date.now(), last.id);
    res.json({ ok:true });
  });

  /* ================= KYC: admin ================= */
  app.get('/api/admin/kyc', requireAdmin, (req, res) => {
    res.json(db.prepare(`SELECT k.*, u.name AS name, u.username AS username, u.email AS email FROM kyc_requests k
      LEFT JOIN users u ON u.id = k.userId
      ORDER BY (k.status IN ('requested','submitted')) DESC, k.updatedAt DESC LIMIT 500`).all());
  });
  app.post('/api/admin/kyc/:id/approve-upgrade', requireAdmin, (req, res) => {
    const r = db.prepare("UPDATE kyc_requests SET status='details_needed', adminMessage=NULL, updatedAt=? WHERE id=? AND status='requested'")
      .run(Date.now(), req.params.id);
    if(!r.changes) return res.status(404).json({ error:'Request not found or already handled.' });
    res.json({ ok:true });
  });
  app.post('/api/admin/kyc/:id/verify', requireAdmin, (req, res) => {
    const k = db.prepare('SELECT * FROM kyc_requests WHERE id=?').get(req.params.id);
    if(!k || k.status !== 'submitted') return res.status(404).json({ error:'Nothing to verify for this request.' });
    db.prepare("UPDATE kyc_requests SET status='verified', adminMessage=NULL, updatedAt=? WHERE id=?").run(Date.now(), k.id);
    setUserKyc(k.userId, 'verified');
    res.json({ ok:true });
  });
  app.post('/api/admin/kyc/:id/reject', requireAdmin, (req, res) => {
    const reason = clean(req.body && req.body.reason, 1000);
    if(!reason) return res.status(400).json({ error:'Please write a message for the user.' });
    const k = db.prepare('SELECT * FROM kyc_requests WHERE id=?').get(req.params.id);
    if(!k || !['requested','details_needed','submitted'].includes(k.status))
      return res.status(404).json({ error:'Request not found or already handled.' });
    db.prepare("UPDATE kyc_requests SET status='rejected', adminMessage=?, updatedAt=? WHERE id=?").run(reason, Date.now(), k.id);
    setUserKyc(k.userId, 'none');
    res.json({ ok:true });
  });
};