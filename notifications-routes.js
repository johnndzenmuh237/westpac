/* notifications-routes.js: in-app notifications + phone push (Web Push).
   Notifications are created automatically when requests are made or decided. */
const { db } = require('./config/db');
const { requireUser, requireAdmin } = require('./middleware/auth');

let webpush = null;
try { webpush = require('web-push'); } catch (e) { /* package not installed */ }
const PUB = process.env.VAPID_PUBLIC_KEY, PRIV = process.env.VAPID_PRIVATE_KEY;
let pushOn = false;
if (webpush && PUB && PRIV) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', PUB, PRIV);
  pushOn = true;
} else {
  console.log('Push notifications: not configured (set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY). In-app notifications still work.');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, audience TEXT NOT NULL, userId TEXT,
    title TEXT, body TEXT, url TEXT, createdAt INTEGER NOT NULL, readAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY, role TEXT NOT NULL, userId TEXT, p256dh TEXT, auth TEXT, createdAt INTEGER NOT NULL
  );
`);
setInterval(() => {
  try { db.prepare('DELETE FROM notifications WHERE createdAt < ?').run(Date.now() - 30 * 86400e3); } catch (e) {}
}, 6 * 3600e3);

function notify(audience, userId, title, body) {
  try {
    const url = audience === 'admin' ? '/admin.html' : '/user.html';
    const text = String(body || '').slice(0, 300);
    db.prepare('INSERT INTO notifications (audience,userId,title,body,url,createdAt) VALUES (?,?,?,?,?,?)')
      .run(audience, userId || null, title, text, url, Date.now());
    if (!pushOn) return;
    const subs = audience === 'admin'
      ? db.prepare("SELECT * FROM push_subscriptions WHERE role='admin'").all()
      : db.prepare("SELECT * FROM push_subscriptions WHERE role='user' AND userId=?").all(userId);
    const payload = JSON.stringify({ title, body: text, url });
    subs.forEach((s) => {
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 })
        .catch((e) => {
          if (e && (e.statusCode === 404 || e.statusCode === 410)) {
            try { db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(s.endpoint); } catch (x) {}
          }
        });
    });
  } catch (e) { console.error('notify failed:', e.message); }
}

function ownerOf(table, id) {
  try {
    const r = db.prepare(`SELECT userId FROM ${table} WHERE id=?`).get(id);
    return r && r.userId;
  } catch (e) { return null; }
}
function nameOf(uid) {
  try { const r = db.prepare('SELECT name FROM users WHERE id=?').get(uid); return r ? r.name : 'A user'; }
  catch (e) { return 'A user'; }
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const DECISIONS = [
  [/^\/api\/admin\/loans\/([^/]+)\/(approve|decline)$/, 'loans', 'loan application'],
  [/^\/api\/admin\/cards\/([^/]+)\/(approve|reject)$/, 'card_requests', 'card request'],
  [/^\/api\/admin\/upgrades\/([^/]+)\/(approve|reject)$/, 'upgrade_requests', 'upgrade request'],
  [/^\/api\/admin\/transfers\/([^/]+)\/(approve|reject)$/, 'transfer_requests', 'transfer request'],
  [/^\/api\/admin\/withdrawals\/([^/]+)\/(approve|reject)$/, 'transactions', 'withdrawal']
];
const USER_EVENTS = [
  [/^\/api\/user\/loans$/, 'New loan application'],
  [/^\/api\/user\/kyc\/request$/, 'New KYC upgrade request'],
  [/^\/api\/user\/kyc\/details$/, 'KYC details submitted'],
  [/^\/api\/user\/cards$/, 'New card request'],
  [/^\/api\/user\/upgrades$/, 'New upgrade request'],
  [/^\/api\/user\/transfers$/, 'New transfer request'],
  [/^\/api\/user\/withdraw\/(bank|crypto)$/, 'New withdrawal request']
];

function onDone(req) {
  const path = req.originalUrl.split('?')[0];
  const b = req.body || {};
  let m;

  for (const [re, table, label] of DECISIONS) {
    if ((m = re.exec(path))) {
      const ok = m[2] === 'approve';
      const uid = ownerOf(table, m[1]);
      if (!uid) return;
      const why = b.reason || b.message || '';
      const title = cap(label) + (ok ? ' approved' : ' declined');
      let body = ok
        ? (table === 'loans' ? 'Congratulations! Your loan application has been approved.' : 'Your ' + label + ' has been approved.')
        : 'Your ' + label + ' was declined.';
      if (why) body += (ok ? ' ' : ' Reason: ') + why;
      return notify('user', uid, title, body);
    }
  }
  if ((m = /^\/api\/admin\/kyc\/([^/]+)\/(approve-upgrade|verify|reject)$/.exec(path))) {
    const uid = ownerOf('kyc_requests', m[1]);
    if (!uid) return;
    if (m[2] === 'approve-upgrade') return notify('user', uid, 'KYC upgrade approved', 'Please open KYC Verification and submit your details.');
    if (m[2] === 'verify') return notify('user', uid, 'Account verified', 'Your account is now verified.');
    return notify('user', uid, 'KYC upgrade rejected', 'Reason: ' + (b.reason || 'see your dashboard'));
  }
  if ((m = /^\/api\/admin\/users\/([^/]+)\/credit-usd$/.exec(path))) {
    return notify('user', m[1], 'Account credited', '$' + b.amount + ' USD was added to your account.');
  }
  if ((m = /^\/api\/admin\/users\/([^/]+)\/credit$/.exec(path))) {
    return notify('user', m[1], 'Account credited', b.amount + ' ' + b.coin + ' was added to your account.');
  }
  if (path === '/api/public/applications') {
    return notify('admin', null, 'New account application', (b.fullName || 'Someone') + ' applied for an account.');
  }
  for (const [re, title] of USER_EVENTS) {
    if (re.test(path) && req.auth && req.auth.userId) {
      return notify('admin', null, title, nameOf(req.auth.userId) + ' sent a request.');
    }
  }
}

module.exports = function (app) {
  // watch successful requests and create notifications automatically
  app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      res.on('finish', () => { if (res.statusCode < 400) { try { onDone(req); } catch (e) {} } });
    }
    next();
  });

  app.get('/api/push/key', (req, res) => res.json({ key: pushOn ? PUB : '' }));

  const list = (audience) => (req, res) => {
    const uid = audience === 'user' ? req.auth.userId : null;
    const where = audience === 'user' ? "audience='user' AND userId=?" : "audience='admin'";
    const args = audience === 'user' ? [uid] : [];
    const rows = db.prepare(`SELECT id,title,body,url,createdAt,readAt FROM notifications WHERE ${where} ORDER BY id DESC LIMIT 50`).all(...args);
    const unread = db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE ${where} AND readAt IS NULL`).get(...args).c;
    res.json({ list: rows, unread, latestId: rows.length ? rows[0].id : 0 });
  };
  const markRead = (audience) => (req, res) => {
    if (audience === 'user') db.prepare("UPDATE notifications SET readAt=? WHERE audience='user' AND userId=? AND readAt IS NULL").run(Date.now(), req.auth.userId);
    else db.prepare("UPDATE notifications SET readAt=? WHERE audience='admin' AND readAt IS NULL").run(Date.now());
    res.json({ ok: true });
  };
  const subscribe = (role) => (req, res) => {
    const s = req.body && req.body.subscription;
    if (!s || !s.endpoint || !s.keys) return res.status(400).json({ error: 'Bad subscription' });
    db.prepare(`INSERT INTO push_subscriptions (endpoint,role,userId,p256dh,auth,createdAt) VALUES (?,?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET role=excluded.role,userId=excluded.userId,p256dh=excluded.p256dh,auth=excluded.auth`)
      .run(s.endpoint, role, role === 'user' ? req.auth.userId : null, s.keys.p256dh, s.keys.auth, Date.now());
    res.json({ ok: true });
  };

  app.get('/api/user/notifications', requireUser, list('user'));
  app.post('/api/user/notifications/read', requireUser, markRead('user'));
  app.post('/api/user/push/subscribe', requireUser, subscribe('user'));
  app.get('/api/admin/notifications', requireAdmin, list('admin'));
  app.post('/api/admin/notifications/read', requireAdmin, markRead('admin'));
  app.post('/api/admin/push/subscribe', requireAdmin, subscribe('admin'));
};