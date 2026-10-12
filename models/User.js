const crypto = require('crypto');
const { db } = require('../config/db');

const r8 = (n) => Math.round(n * 1e8) / 1e8; // avoid 0.30000000000004-style float noise

function loadHoldings(userId) {
  const rows = db.prepare('SELECT coin, network, balance FROM holdings WHERE userId = ?').all(userId);
  const holdings = {};
  for (const r of rows) holdings[`${r.coin}_${r.network}`] = { coin: r.coin, network: r.network, balance: r.balance };
  return holdings;
}
function withHoldings(row) {
  if (!row) return null;
  const user = { ...row };
  user.holdings = loadHoldings(row.id);
  try { user.preferredCurrencies = row.preferredCurrencies ? JSON.parse(row.preferredCurrencies) : []; }
  catch (e) { user.preferredCurrencies = []; }
  return user;
}

const User = {
  create(f) {
    const id = crypto.randomUUID();
    const s = (v) => (v === undefined || v === null ? '' : v);
    db.prepare(`INSERT INTO users
      (id, name, email, phoneNumber, country, username, passwordHash, kycStatus, usdBalance, createdAt,
       accountType, preferredCurrencies, dateOfBirth, nationality, address, city, postcode,
       idType, idNumber, idCountry, occupation, employer, sourceOfFunds, expectedDeposit, businessRegNumber,
       consentAccuracy, consentTerms, consentAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'none', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, f.name, String(f.email).toLowerCase(), f.phoneNumber, f.country, String(f.username).toLowerCase(),
        f.passwordHash, r8(f.usdBalance || 0), Date.now(),
        s(f.accountType), JSON.stringify(f.preferredCurrencies || []), s(f.dateOfBirth), s(f.nationality),
        s(f.address), s(f.city), s(f.postcode), s(f.idType), s(f.idNumber), s(f.idCountry),
        s(f.occupation), s(f.employer), s(f.sourceOfFunds), f.expectedDeposit ?? null, s(f.businessRegNumber),
        f.consentAccuracy ? 1 : 0, f.consentTerms ? 1 : 0, f.consentAt ?? null);
    return User.findById(id);
  },
  findById(id) {
    return withHoldings(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  },
  findByUsername(username) {
    return withHoldings(db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').toLowerCase()));
  },
  findAll() {
    return db.prepare('SELECT * FROM users ORDER BY createdAt DESC').all().map(withHoldings);
  },
  update(id, fields) {
    const allowed = ['name', 'email', 'phoneNumber', 'country', 'usdBalance', 'kycStatus', 'passwordHash',
      'accountType', 'preferredCurrencies', 'dateOfBirth', 'nationality', 'address', 'city', 'postcode',
      'idType', 'idNumber', 'idCountry', 'occupation', 'employer', 'sourceOfFunds', 'expectedDeposit', 'businessRegNumber'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
    if (keys.length) {
      const sets = keys.map((k) => `${k} = ?`).join(', ');
      const vals = keys.map((k) => {
        if (k === 'usdBalance') return r8(fields[k]);
        if (k === 'preferredCurrencies') return JSON.stringify(fields[k]);
        return fields[k];
      });
      db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...vals, id);
    }
    return User.findById(id);
  },
  getHoldingBalance(userId, coin, network) {
    const row = db.prepare('SELECT balance FROM holdings WHERE userId = ? AND coin = ? AND network = ?').get(userId, coin, network);
    return row ? row.balance : 0;
  },
  setHolding(userId, coin, network, balance) {
    const value = r8(balance);
    const existing = db.prepare('SELECT id FROM holdings WHERE userId = ? AND coin = ? AND network = ?').get(userId, coin, network);
    if (existing) {
      db.prepare('UPDATE holdings SET balance = ? WHERE id = ?').run(value, existing.id);
    } else {
      db.prepare('INSERT INTO holdings (id, userId, coin, network, balance) VALUES (?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), userId, coin, network, value);
    }
    return value;
  },
  addToHolding(userId, coin, network, amount) {
    return User.setHolding(userId, coin, network, User.getHoldingBalance(userId, coin, network) + amount);
  }
};

module.exports = User;
