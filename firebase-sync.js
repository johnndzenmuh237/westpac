/* firebase-sync.js: keeps a copy of the SQLite database in Firestore so data survives restarts. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('./config/db');

let firestore = null;
try {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  let account = null;
  const keyFile = path.join(__dirname, 'firebase-key.json');
  if (fs.existsSync(keyFile)) {
    account = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  if (account) {
    initializeApp({ credential: cert(account) });
    firestore = getFirestore();
  }
} catch (e) { console.error('Firebase sync disabled:', e.message); }

const COL = 'dbsnapshot';
const MAX_CHUNK = 700 * 1024; // stay under Firestore's 1 MiB document limit
const tables = () => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
const columns = (t) => db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
const hasUsers = () => tables().includes('users') && db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0;

function dump() {
  const out = {};
  for (const t of tables()) out[t] = db.prepare(`SELECT * FROM "${t}"`).all();
  return out;
}
function chunk(rows) {
  const chunks = []; let cur = [], size = 0;
  for (const r of rows) {
    const s = JSON.stringify(r).length;
    if (cur.length && size + s > MAX_CHUNK) { chunks.push(cur); cur = []; size = 0; }
    cur.push(r); size += s;
  }
  if (cur.length || !chunks.length) chunks.push(cur);
  return chunks;
}

let lastHash = '';
let saving = false;
async function save() {
  if (!firestore || saving) return;
  if (!hasUsers()) return; // never overwrite a good backup with an empty database
  saving = true;
  try {
    const data = dump();
    const hash = crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex');
    if (hash === lastHash) return;

    const meta = {};
    const writes = [];
    for (const [t, rows] of Object.entries(data)) {
      const parts = chunk(rows);
      meta[t] = parts.length;
      parts.forEach((p, i) => writes.push([`${t}__${i}`, { table: t, idx: i, rows: JSON.stringify(p) }]));
    }

    const col = firestore.collection(COL);
    const old = await col.get();
    const keep = new Set(writes.map(w => w[0]).concat('meta'));

    let batch = firestore.batch(), n = 0;
    const add = async (fn) => {
      fn(batch);
      if (++n >= 400) { await batch.commit(); batch = firestore.batch(); n = 0; }
    };
    for (const [id, doc] of writes) await add(b => b.set(col.doc(id), doc));
    await add(b => b.set(col.doc('meta'), { tables: meta, savedAt: Date.now() }));
    for (const d of old.docs) if (!keep.has(d.id)) await add(b => b.delete(d.ref));
    if (n) await batch.commit();

    lastHash = hash;
  } catch (e) { console.error('Firestore save failed:', e.message); }
  finally { saving = false; }
}

async function restore() {
  if (!firestore) { console.log('Firebase sync: not configured (set FIREBASE_SERVICE_ACCOUNT or add firebase-key.json).'); return; }
  try {
    if (hasUsers()) return; // local database already has data: do not overwrite it
    const metaDoc = await firestore.collection(COL).doc('meta').get();
    if (!metaDoc.exists) { console.log('Firebase sync: nothing to restore yet.'); return; }
    const meta = metaDoc.data().tables || {};
    const local = new Set(tables());
    for (const [t, count] of Object.entries(meta)) {
      if (!local.has(t)) continue;
      const cols = new Set(columns(t));
      for (let i = 0; i < count; i++) {
        const d = await firestore.collection(COL).doc(`${t}__${i}`).get();
        if (!d.exists) continue;
        for (const row of JSON.parse(d.data().rows)) {
          const keys = Object.keys(row).filter(k => cols.has(k));
          if (!keys.length) continue;
          db.prepare(`INSERT OR REPLACE INTO "${t}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
            .run(...keys.map(k => row[k]));
        }
      }
    }
    console.log('Firebase sync: database restored from Firestore.');
  } catch (e) { console.error('Firestore restore failed:', e.message); }
}

async function start() {
  await restore();
  if (firestore) {
    setInterval(save, 30000);
    const stop = async () => { await save(); process.exit(0); };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  }
}
module.exports = { start, save, restore };