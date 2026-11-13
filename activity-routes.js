const { db } = require('./config/db');
const { requireAdmin } = require('./middleware/auth');

function safe(fn) { try { return fn(); } catch (e) { return []; } }
const withUser = (table, select) => safe(() => db.prepare(
  `SELECT ${select}, u.name AS userName, u.username AS username FROM ${table} r LEFT JOIN users u ON u.id = r.userId WHERE r.status != 'pending'`
).all());

module.exports = function (app) {
  app.get('/api/admin/activity', requireAdmin, (req, res) => {
    const rows = []
      .concat(withUser('loans', "r.id, 'Loan' AS kind, r.amount, r.status, r.adminMessage, r.decidedAt AS at").map(r => r))
      .concat(withUser('card_requests', "r.id, 'Card' AS kind, r.cardType AS amount, r.status, r.adminMessage, r.decidedAt AS at"))
      .concat(withUser('upgrade_requests', "r.id, 'Upgrade' AS kind, r.tier AS amount, r.status, r.adminMessage, r.decidedAt AS at"))
      .concat(withUser('transfer_requests', "r.id, 'Transfer' AS kind, r.amount, r.status, r.adminMessage, r.decidedAt AS at"))
      .concat(withUser('kyc_requests', "r.id, 'KYC' AS kind, r.status AS amount, r.status, r.adminMessage, r.updatedAt AS at"))
      .concat(safe(() => db.prepare(
        `SELECT t.id, 'Withdrawal' AS kind, t.usdAmount AS amount, t.status, t.rejectionReason AS adminMessage, t.createdAt AS at,
                u.name AS userName, u.username AS username
         FROM transactions t LEFT JOIN users u ON u.id = t.userId
         WHERE t.type IN ('withdraw_bank','withdraw_crypto') AND t.status != 'pending'`
      ).all()));
    rows.sort((a, b) => (b.at || 0) - (a.at || 0));
    res.json(rows.slice(0, 300));
  });
};