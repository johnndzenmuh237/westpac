const crypto = require('crypto');
const { db } = require('../config/db');

// Add receipt fields safely to existing databases. Existing transaction rows remain intact.
const RECEIPT_COLUMNS = {
  reference: 'TEXT',
  description: 'TEXT',
  currency: 'TEXT',
  txHash: 'TEXT',
  confirmations: 'INTEGER',
  requiredConfirmations: 'INTEGER',
  fromWallet: 'TEXT',
  toWallet: 'TEXT',
  recipient: 'TEXT',
  bankName: 'TEXT',
  accountNumber: 'TEXT',
  paymentReference: 'TEXT'
};
try {
  const existing = new Set(db.prepare('PRAGMA table_info(transactions)').all().map(c => c.name));
  for (const [name, type] of Object.entries(RECEIPT_COLUMNS)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE transactions ADD COLUMN ${name} ${type}`);
  }
} catch (err) {
  // If migrations fail, don't silently pretend the extra receipt fields are stored.
  console.error('Transaction receipt field migration failed:', err.message);
}

const SELECT = `SELECT t.*, u.name AS userName, u.username AS userUsername
                FROM transactions t JOIN users u ON u.id = t.userId`;
const n = (v) => (v === undefined ? null : v);

function format(row) {
  if (!row) return null;
  let bankDetails;
  try { bankDetails = row.bankDetails ? JSON.parse(row.bankDetails) : undefined; }
  catch (_) { bankDetails = undefined; }
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
    bankDetails,
    walletAddress: row.walletAddress || undefined,
    fromWallet: row.fromWallet || undefined,
    toWallet: row.toWallet || undefined,
    txHash: row.txHash || undefined,
    confirmations: row.confirmations ?? undefined,
    requiredConfirmations: row.requiredConfirmations ?? undefined,
    reference: row.reference || undefined,
    description: row.description || undefined,
    currency: row.currency || undefined,
    recipient: row.recipient || undefined,
    bankName: row.bankName || undefined,
    accountNumber: row.accountNumber || undefined,
    paymentReference: row.paymentReference || undefined,
    rejectionReason: row.rejectionReason || undefined,
    seenByUser: !!row.seenByUser,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt || undefined
  };
}

const Transaction = {
  create(f) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO transactions
      (id, userId, type, status, coin, network, amount, usdAmount, feeCoin, feeAmount, toCoin, toNetwork, toAmount,
       bankDetails, walletAddress, seenByUser, createdAt, reference, description, currency, txHash, confirmations,
       requiredConfirmations, fromWallet, toWallet, recipient, bankName, accountNumber, paymentReference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, f.userId, f.type, f.status || 'completed', n(f.coin), n(f.network), n(f.amount), n(f.usdAmount),
        n(f.feeCoin), n(f.feeAmount), n(f.toCoin), n(f.toNetwork), n(f.toAmount),
        f.bankDetails ? JSON.stringify(f.bankDetails) : null, n(f.walletAddress), Date.now(),
        n(f.reference || f.referenceNo), n(f.description), n(f.currency), n(f.txHash || f.transactionHash || f.hash),
        n(f.confirmations), n(f.requiredConfirmations || f.confirmationsRequired), n(f.fromWallet || f.fromAddress),
        n(f.toWallet || f.toAddress), n(f.recipient), n(f.bankName), n(f.accountNumber), n(f.paymentReference));
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
    const allowed = ['status', 'rejectionReason', 'resolvedAt', 'seenByUser', 'reference', 'description', 'currency',
      'txHash', 'confirmations', 'requiredConfirmations', 'fromWallet', 'toWallet', 'recipient', 'bankName',
      'accountNumber', 'paymentReference', 'walletAddress', 'bankDetails'];
    const keys = Object.keys(fields).filter(k => allowed.includes(k) && fields[k] !== undefined);
    if (keys.length) {
      const sets = keys.map(k => `${k} = ?`).join(', ');
      const vals = keys.map(k => {
        if (k === 'seenByUser') return fields[k] ? 1 : 0;
        if (k === 'bankDetails') return fields[k] ? JSON.stringify(fields[k]) : null;
        return fields[k];
      });
      db.prepare(`UPDATE transactions SET ${sets} WHERE id = ?`).run(...vals, id);
    }
    return Transaction.findById(id);
  },
  markAllRejectedSeen(userId) {
    db.prepare(`UPDATE transactions SET seenByUser = 1 WHERE userId = ? AND status = 'rejected' AND seenByUser = 0`).run(userId);
  }
};
module.exports = Transaction;
