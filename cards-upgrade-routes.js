/* cards-upgrade-routes.js — card requests + account upgrade requests. */
const crypto = require('crypto');
const { db } = require('./config/db');
const { requireUser, requireAdmin } = require('./middleware/auth');
let jwt = null; try { jwt = require('jsonwebtoken'); } catch (e) { /* optional */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS card_requests (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL,
    cardType TEXT, nameOnCard TEXT, phone TEXT, address TEXT, city TEXT, country TEXT, purpose TEXT,
    status TEXT NOT NULL DEFAULT 'pending', adminMessage TEXT,
    createdAt INTEGER NOT NULL, decidedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS upgrade_requests (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL,
    tier TEXT, reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending', adminMessage TEXT,
    createdAt INTEGER NOT NULL, decidedAt INTEGER
  );
`);

// extra card column (safe to run repeatedly)
['cardBrand TEXT'].forEach(function(c){
  try{ db.exec('ALTER TABLE card_requests ADD COLUMN ' + c); }catch(e){ /* already exists */ }
});

const TIERS = ['Standard', 'Premium', 'Business'];
const CARD_TYPES = ['Virtual', 'Physical'];
const CARD_BRANDS = ['Visa', 'Mastercard'];
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

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

module.exports = function(app){
  /* ---------- USER: cards ---------- */
   app.post('/api/user/cards', requireUser, (req, res) => {
    const uid = uidOf(req);
    if(!uid) return res.status(401).json({ error:'Not signed in' });
    const b = req.body || {};
    const d = { cardBrand:clean(b.cardBrand,20), cardType:clean(b.cardType,20), nameOnCard:clean(b.nameOnCard,60), phone:clean(b.phone,30),
      address:clean(b.address,200), city:clean(b.city,80), country:clean(b.country,80), purpose:clean(b.purpose,300) };
    if(!CARD_BRANDS.includes(d.cardBrand)) return res.status(400).json({ error:'Choose a card network.' });
    if(!CARD_TYPES.includes(d.cardType)) return res.status(400).json({ error:'Choose a card type.' });
    if(!d.nameOnCard || !d.phone || !d.purpose) return res.status(400).json({ error:'Please complete all required fields.' });
    if(d.cardType === 'Physical' && (!d.address || !d.city || !d.country))
      return res.status(400).json({ error:'A delivery address is required for a physical card.' });
    if(db.prepare("SELECT id FROM card_requests WHERE userId=? AND status='pending'").get(uid))
      return res.status(400).json({ error:'You already have a card request under review.' });
    db.prepare(`INSERT INTO card_requests (id,userId,cardBrand,cardType,nameOnCard,phone,address,city,country,purpose,status,createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(crypto.randomUUID(), uid, d.cardBrand, d.cardType, d.nameOnCard, d.phone, d.address, d.city, d.country, d.purpose, 'pending', Date.now());
    res.json({ ok:true });
  });

  /* ---------- USER: upgrades ---------- */
  app.get('/api/user/upgrades', requireUser, (req, res) => {
    res.json(db.prepare('SELECT * FROM upgrade_requests WHERE userId=? ORDER BY createdAt DESC LIMIT 50').all(uidOf(req)));
  });
  app.post('/api/user/upgrades', requireUser, (req, res) => {
    const uid = uidOf(req);
    if(!uid) return res.status(401).json({ error:'Not signed in' });
    const tier = clean(req.body && req.body.tier, 30);
    const reason = clean(req.body && req.body.reason, 300);
    if(!TIERS.includes(tier)) return res.status(400).json({ error:'Choose an upgrade level.' });
    if(db.prepare("SELECT id FROM upgrade_requests WHERE userId=? AND status='pending'").get(uid))
      return res.status(400).json({ error:'You already have an upgrade request under review.' });
    db.prepare('INSERT INTO upgrade_requests (id,userId,tier,reason,status,createdAt) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), uid, tier, reason, 'pending', Date.now());
    res.json({ ok:true });
  });

  /* ---------- ADMIN ---------- */
  function adminList(table){
    return (req, res) => res.json(db.prepare(`SELECT r.*, u.name AS name, u.username AS username FROM ${table} r
      LEFT JOIN users u ON u.id = r.userId ORDER BY (r.status='pending') DESC, r.createdAt DESC LIMIT 500`).all());
  }
  function approve(table){
    return (req, res) => {
      const msg = clean(req.body && req.body.message, 1000);
      const r = db.prepare(`UPDATE ${table} SET status='approved', adminMessage=?, decidedAt=? WHERE id=? AND status='pending'`)
        .run(msg || null, Date.now(), req.params.id);
      if(!r.changes) return res.status(404).json({ error:'Request not found or already decided.' });
      res.json({ ok:true });
    };
  }
  function reject(table){
    return (req, res) => {
      const msg = clean(req.body && req.body.message, 1000);
      if(!msg) return res.status(400).json({ error:'Please write a message for the user.' });
      const r = db.prepare(`UPDATE ${table} SET status='rejected', adminMessage=?, decidedAt=? WHERE id=? AND status='pending'`)
        .run(msg, Date.now(), req.params.id);
      if(!r.changes) return res.status(404).json({ error:'Request not found or already decided.' });
      res.json({ ok:true });
    };
  }
  app.get('/api/admin/cards', requireAdmin, adminList('card_requests'));
  app.post('/api/admin/cards/:id/approve', requireAdmin, approve('card_requests'));
  app.post('/api/admin/cards/:id/reject', requireAdmin, reject('card_requests'));
  app.get('/api/admin/upgrades', requireAdmin, adminList('upgrade_requests'));
  app.post('/api/admin/upgrades/:id/approve', requireAdmin, approve('upgrade_requests'));
  app.post('/api/admin/upgrades/:id/reject', requireAdmin, reject('upgrade_requests'));
};