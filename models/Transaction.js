const crypto = require('crypto');
const { db } = require('../config/db');

const SELECT = `SELECT t.*, u.name AS userName, u.username AS userUsername
                FROM transactions t JOIN users u ON u.id = t.userId`;

function format(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.userId,
    user: { _id: row.userId, name: row.userName, username: row.userUsername },
    type: row.type,
    status: row.status,
    coin: row.coin || undefined,
    network: row.network || undefined,
    amount: row.amount ?? undefined,
    usdAmount: row.usdAmount ?? undefined,
    feeCoin: row.feeCoin || undefined,
    feeAmount: row.feeAmount ?? undefined,
    toCoin: row.toCoin || undefined,
    toNetwork: row.toNetwork || undefined,
    toAmount: row.toAmount ?? undefined,
    bankDetails: row.bankDetails ? JSON.parse(row.bankDetails) : undefined,
    walletAddress: row.walletAddress || undefined,
    rejectionReason: row.rejectionReason || undefined,
    seenByUser: !!row.seenByUser,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt || undefined
  };
}

const n = (v) => (v === undefined ? null : v);

const Transaction = {
  create(f) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO transactions
      (id, userId, type, status, coin, network, amount, usdAmount, feeCoin, feeAmount, toCoin, toNetwork, toAmount,
       bankDetails, walletAddress, seenByUser, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(id, f.userId, f.type, f.status || 'completed', n(f.coin), n(f.network), n(f.amount), n(f.usdAmount),
        n(f.feeCoin), n(f.feeAmount), n(f.toCoin), n(f.toNetwork), n(f.toAmount),
        f.bankDetails ? JSON.stringify(f.bankDetails) : null, n(f.walletAddress), Date.now());
    return Transaction.findById(id);
  },
  findById(id) {
    return format(db.prepare(`${SELECT} WHERE t.id = ?`).get(id));
  },
  findForUser(id, userId) {
    return format(db.prepare(`${SELECT} WHERE t.id = ? AND t.userId = ?`).get(id, userId));
  },
  list({ userId, status } = {}) {
    const where = [];
    const params = [];
    if (userId) { where.push('t.userId = ?'); params.push(userId); }
    if (status) { where.push('t.status = ?'); params.push(status); }
    const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.createdAt DESC`;
    return db.prepare(sql).all(...params).map(format);
  },
  update(id, fields) {
    const allowed = ['status', 'rejectionReason', 'resolvedAt', 'seenByUser'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (keys.length) {
      const sets = keys.map((k) => `${k} = ?`).join(', ');
      const vals = keys.map((k) => (k === 'seenByUser' ? (fields[k] ? 1 : 0) : fields[k]));
      db.prepare(`UPDATE transactions SET ${sets} WHERE id = ?`).run(...vals, id);
    }
    return Transaction.findById(id);
  },
  markAllRejectedSeen(userId) {
    db.prepare(`UPDATE transactions SET seenByUser = 1 WHERE userId = ? AND status = 'rejected' AND seenByUser = 0`).run(userId);
  }
};

module.exports = Transaction;
