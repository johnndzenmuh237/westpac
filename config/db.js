// Local, file-based database: no server to run, no network, no IP whitelist,
// no internet needed. Everything lives in ./data/west-pec-global.db (created
// automatically on first run). Delete that file to reset the app.
//
// Driver: uses better-sqlite3 when it installed fine; otherwise falls back to
// Node's built-in `node:sqlite` (Node 22.5+). So a native-build hiccup during
// `npm install` can never stop the app from running.
const path = require('path');
const fs = require('fs');

const DEFAULT_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DEFAULT_DIR, 'west-pec-global.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Earlier builds used a different file name - carry that data over automatically.
if (!process.env.DB_PATH) {
  for (const name of ['west-pec-global.db', 'cryptoguard.db']) {
    const legacy = path.join(DEFAULT_DIR, name);
    if (fs.existsSync(legacy) && !fs.existsSync(DB_PATH)) {
      for (const ext of ['', '-wal', '-shm']) {
        if (fs.existsSync(legacy + ext)) fs.renameSync(legacy + ext, DB_PATH + ext);
      }
    }
  }
}

let db;
let driver;
try {
  if (process.env.DB_DRIVER === 'node') throw new Error('node:sqlite forced via DB_DRIVER');
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  driver = 'better-sqlite3';
} catch (firstErr) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    driver = 'node:sqlite';
  } catch (secondErr) {
    console.error('\nCould not start the local database.');
    console.error(' - better-sqlite3:', firstErr.message);
    console.error(' - node:sqlite   :', secondErr.message);
    console.error('\nFix: use Node.js 22 or newer (https://nodejs.org), then run `npm install` again.\n');
    process.exit(1);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phoneNumber TEXT NOT NULL,
    country TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    kycStatus TEXT NOT NULL DEFAULT 'none',
    usdBalance REAL NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    accountType TEXT,
    preferredCurrencies TEXT,
    dateOfBirth TEXT,
    nationality TEXT,
    address TEXT,
    city TEXT,
    postcode TEXT,
    idType TEXT,
    idNumber TEXT,
    idCountry TEXT,
    occupation TEXT,
    employer TEXT,
    sourceOfFunds TEXT,
    expectedDeposit REAL,
    businessRegNumber TEXT,
    consentAccuracy INTEGER NOT NULL DEFAULT 0,
    consentTerms INTEGER NOT NULL DEFAULT 0,
    consentAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS holdings (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coin TEXT NOT NULL,
    network TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    UNIQUE(userId, coin, network)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    coin TEXT,
    network TEXT,
    amount REAL,
    usdAmount REAL,
    feeCoin TEXT,
    feeAmount REAL,
    toCoin TEXT,
    toNetwork TEXT,
    toAmount REAL,
    bankDetails TEXT,
    walletAddress TEXT,
    rejectionReason TEXT,
    seenByUser INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    resolvedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS deposit_addresses (
    id TEXT PRIMARY KEY,
    coin TEXT NOT NULL,
    network TEXT NOT NULL,
    address TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(coin, network)
  );

  CREATE TABLE IF NOT EXISTS support_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    email TEXT DEFAULT '',
    whatsapp TEXT DEFAULT ''
  );
`);

// Upgrade databases created by earlier builds: add any columns they lack.
(function migrate() {
  const have = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
  const wanted = {
    accountType: 'TEXT', preferredCurrencies: 'TEXT', dateOfBirth: 'TEXT', nationality: 'TEXT',
    address: 'TEXT', city: 'TEXT', postcode: 'TEXT', idType: 'TEXT', idNumber: 'TEXT', idCountry: 'TEXT',
    occupation: 'TEXT', employer: 'TEXT', sourceOfFunds: 'TEXT', expectedDeposit: 'REAL',
    businessRegNumber: 'TEXT', consentAccuracy: 'INTEGER NOT NULL DEFAULT 0',
    consentTerms: 'INTEGER NOT NULL DEFAULT 0', consentAt: 'INTEGER'
  };
  for (const [col, type] of Object.entries(wanted)) {
    if (!have.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
  }
})();

// All-or-nothing wrapper: if anything inside throws, every change is rolled
// back, so balances can never end up half-updated.
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw err;
  }
}

module.exports = { db, transaction, driver, DB_PATH };
