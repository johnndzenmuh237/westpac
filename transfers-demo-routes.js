/* transfers-demo-routes.js: DEMO transfers. No money moves; this only records requests. */
const crypto = require('crypto');
const { db } = require('./config/db');
const { requireUser, requireAdmin } = require('./middleware/auth');
let jwt = null; try { jwt = require('jsonwebtoken'); } catch (e) {}

db.exec(`CREATE TABLE IF NOT EXISTS transfer_requests (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, method TEXT, amount REAL,
  recipient TEXT, details TEXT, status TEXT NOT NULL DEFAULT 'pending',
  adminMessage TEXT, createdAt INTEGER NOT NULL, decidedAt INTEGER)`);

const METHODS = ['Crypto', 'Bank', 'Credit Card'];
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
function uidOf(req){
  const u = req.user || req.auth || {};
  let id = u.id || u._id || u.userId || req.userId;
  if(!id && jwt){ try{ const t = String(req.headers.authorization||'').replace(/^Bearer\s+/i,''); const p = jwt.decode(t)||{}; id = p.id||p.userId||p.sub||p._id; }catch(e){} }
  return id;
}
const isUpgraded = (uid) => !!db.prepare("SELECT id FROM upgrade_requests WHERE userId=? AND status='approved' LIMIT 1").get(uid);

module.exports = function(app){
  app.get('/api/user/transfers', requireUser, (req, res) => {
    res.json({ upgraded: isUpgraded(uidOf(req)),
      list: db.prepare('SELECT * FROM transfer_requests WHERE userId=? ORDER BY createdAt DESC LIMIT 50').all(uidOf(req)) });
  });
  app.post('/api/user/transfers', requireUser, (req, res) => {
    const uid = uidOf(req);
    if(!isUpgraded(uid)) return res.status(403).json({ error:'Upgrade your account first. Open the Upgrade page and request an upgrade.', needUpgrade:true });
    const b = req.body || {};
    const method = clean(b.method, 20), amount = Number(b.amount);
    const recipient = clean(b.recipient, 120), details = clean(b.details, 300);
    if(!METHODS.includes(method)) return res.status(400).json({ error:'Choose a transfer method.' });
    if(!(amount > 0) || amount > 1e9) return res.status(400).json({ error:'Enter a valid amount.' });
    if(!recipient) return res.status(400).json({ error:'Enter the recipient.' });
    db.prepare('INSERT INTO transfer_requests (id,userId,method,amount,recipient,details,status,createdAt) VALUES (?,?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), uid, method, amount, recipient, details, 'pending', Date.now());
    res.json({ ok:true });
  });

  app.get('/api/admin/transfers', requireAdmin, (req, res) => {
    res.json(db.prepare(`SELECT r.*, u.name AS name, u.username AS username FROM transfer_requests r
      LEFT JOIN users u ON u.id=r.userId ORDER BY (r.status='pending') DESC, r.createdAt DESC LIMIT 500`).all());
  });
  const decide = (status, needMsg) => (req, res) => {
    const msg = clean(req.body && req.body.message, 1000);
    if(needMsg && !msg) return res.status(400).json({ error:'Please write a message for the user.' });
    const r = db.prepare("UPDATE transfer_requests SET status=?, adminMessage=?, decidedAt=? WHERE id=? AND status='pending'")
      .run(status, msg || null, Date.now(), req.params.id);
    if(!r.changes) return res.status(404).json({ error:'Request not found or already decided.' });
    res.json({ ok:true });
  };
  app.post('/api/admin/transfers/:id/approve', requireAdmin, decide('approved', false));
  app.post('/api/admin/transfers/:id/reject', requireAdmin, decide('rejected', true));
};