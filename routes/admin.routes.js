const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const DepositAddress = require('../models/DepositAddress');
const SupportSettings = require('../models/SupportSettings');
const { transaction } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const {
  COINS, GAS_COIN, NETWORK_FEE, isValidCoinNetwork,
  ACCOUNT_TYPES, BUSINESS_ACCOUNT_TYPES, FIAT_CURRENCIES, ID_TYPES, SOURCES_OF_FUNDS
} = require('../utils/constants');
const { parseClientDetails } = require('../utils/clientDetails');
const { getLivePrices } = require('../utils/marketPrices');
const { generateUniqueUsername, generatePassword } = require('../utils/credentials');
const HttpError = require('../utils/httpError');

const router = express.Router();
router.use(requireAdmin);

function serializeUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phoneNumber: u.phoneNumber, country: u.country,
    username: u.username, usdBalance: u.usdBalance, kycStatus: u.kycStatus || 'none',
    holdings: u.holdings, createdAt: u.createdAt,
    accountType: u.accountType || '', preferredCurrencies: u.preferredCurrencies || [],
    dateOfBirth: u.dateOfBirth || '', nationality: u.nationality || '', address: u.address || '',
    city: u.city || '', postcode: u.postcode || '', idType: u.idType || '', idNumber: u.idNumber || '',
    idCountry: u.idCountry || '', occupation: u.occupation || '', employer: u.employer || '',
    sourceOfFunds: u.sourceOfFunds || '', expectedDeposit: u.expectedDeposit ?? null,
    businessRegNumber: u.businessRegNumber || '',
    consentAccuracy: !!u.consentAccuracy, consentTerms: !!u.consentTerms, consentAt: u.consentAt || null
  };
}
function mustFindUser(id) {
  const user = User.findById(id);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}
const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e);

// GET /api/admin/reference  -> coins/networks/fees with live prices
router.get('/reference', async (req, res) => {
  const live = await getLivePrices();
  const coins = {};
  for (const [symbol, meta] of Object.entries(COINS)) {
    coins[symbol] = { ...meta, price: live[symbol]?.price ?? meta.price, change24h: live[symbol]?.change24h ?? 0, live: !!live[symbol]?.live };
  }
  res.json({
    coins, gasCoin: GAS_COIN, networkFee: NETWORK_FEE,
    options: {
      accountTypes: ACCOUNT_TYPES, businessAccountTypes: BUSINESS_ACCOUNT_TYPES, fiatCurrencies: FIAT_CURRENCIES,
      idTypes: ID_TYPES, sourcesOfFunds: SOURCES_OF_FUNDS
    }
  });
});

/* ---------------- Users ---------------- */
router.get('/users', (req, res) => res.json(User.findAll().map(serializeUser)));
router.get('/users/:id', (req, res) => res.json(serializeUser(mustFindUser(req.params.id))));

// POST /api/admin/users  - open a client account (full details + consent). The
// login username & password are generated and shown to the admin once.
router.post('/users', async (req, res) => {
  const details = parseClientDetails(req.body, { requireConsent: true });
  const username = await generateUniqueUsername(details.name, async (u) => !!User.findByUsername(u));
  const password = generatePassword();
  const user = User.create({ ...details, username, passwordHash: await bcrypt.hash(password, 10), usdBalance: 0 });
  res.status(201).json({ user: serializeUser(user), credentials: { username, password } });
});

// PUT /api/admin/users/:id  - update a client's details (same rules as creation)
router.put('/users/:id', (req, res) => {
  mustFindUser(req.params.id);
  const { consentAccuracy, consentTerms, consentAt, ...details } = parseClientDetails(req.body, { requireConsent: false });
  res.json(serializeUser(User.update(req.params.id, details)));
});

router.post('/users/:id/reset-password', async (req, res) => {
  const user = mustFindUser(req.params.id);
  const password = generatePassword();
  User.update(user.id, { passwordHash: await bcrypt.hash(password, 10) });
  res.json({ username: user.username, password });
});

// POST /api/admin/users/:id/impersonate -> short-lived user token so the admin
// can open that user's dashboard in one click (admin session is untouched).
router.post('/users/:id/impersonate', (req, res) => {
  const user = mustFindUser(req.params.id);
  const token = jwt.sign({ role: 'user', userId: user.id, impersonatedBy: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, name: user.name });
});

/* ---------------- Crediting ---------------- */
// POST /api/admin/users/:id/credit  { coin, network, amount }
router.post('/users/:id/credit', (req, res) => {
  const { coin, network, amount } = req.body;
  const amt = Number(amount);
  if (!isValidCoinNetwork(coin, network)) throw new HttpError(400, 'Invalid coin/network combination');
  if (!amt || amt <= 0) throw new HttpError(400, 'Amount must be greater than 0');
  const user = mustFindUser(req.params.id);
  transaction(() => {
    User.addToHolding(user.id, coin, network, amt);
    Transaction.create({ userId: user.id, type: 'credit', status: 'completed', coin, network, amount: amt });
  });
  res.json(serializeUser(User.findById(user.id)));
});

// POST /api/admin/users/:id/credit-usd  { amount }  (logged as a deposit)
router.post('/users/:id/credit-usd', (req, res) => {
  const amt = Number(req.body.amount);
  if (!amt || amt <= 0) throw new HttpError(400, 'Amount must be greater than 0');
  const user = mustFindUser(req.params.id);
  transaction(() => {
    User.update(user.id, { usdBalance: user.usdBalance + amt });
    Transaction.create({ userId: user.id, type: 'credit', status: 'completed', usdAmount: amt });
  });
  res.json(serializeUser(User.findById(user.id)));
});

// PUT /api/admin/users/:id/holdings  { coin, network, balance }  (exact override, no history entry)
router.put('/users/:id/holdings', (req, res) => {
  const { coin, network, balance } = req.body;
  const bal = Number(balance);
  if (!isValidCoinNetwork(coin, network)) throw new HttpError(400, 'Invalid coin/network combination');
  if (isNaN(bal) || bal < 0) throw new HttpError(400, 'Balance must be 0 or greater');
  const user = mustFindUser(req.params.id);
  User.setHolding(user.id, coin, network, bal);
  res.json(serializeUser(User.findById(user.id)));
});

// PUT /api/admin/users/:id/usd  { balance }  (exact override, no history entry)
router.put('/users/:id/usd', (req, res) => {
  const bal = Number(req.body.balance);
  if (isNaN(bal) || bal < 0) throw new HttpError(400, 'Balance must be 0 or greater');
  const user = mustFindUser(req.params.id);
  res.json(serializeUser(User.update(user.id, { usdBalance: bal })));
});

/* ---------------- Transactions / withdrawals ---------------- */
router.get('/transactions', (req, res) => res.json(Transaction.list({ status: req.query.status })));

router.post('/withdrawals/:txId/approve', (req, res) => {
  const tx = Transaction.findById(req.params.txId);
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.status !== 'pending') throw new HttpError(400, 'Transaction is not pending');
  res.json(Transaction.update(tx.id, { status: 'approved', resolvedAt: Date.now() }));
});

// Rejecting refunds everything that was held when the request was made
// (the withdrawn amount and the network fee) and records the admin's reason.
router.post('/withdrawals/:txId/reject', (req, res) => {
  const reason = (req.body.reason || '').trim();
  if (!reason) throw new HttpError(400, 'A rejection reason is required');

  const result = transaction(() => {
    const tx = Transaction.findById(req.params.txId);
    if (!tx) throw new HttpError(404, 'Transaction not found');
    if (tx.status !== 'pending') throw new HttpError(400, 'Transaction is not pending');
    const user = User.findById(tx.userId);
    if (tx.type === 'withdraw_bank') {
      User.update(user.id, { usdBalance: user.usdBalance + tx.usdAmount });
    } else if (tx.type === 'withdraw_crypto') {
      User.addToHolding(user.id, tx.coin, tx.network, tx.amount);
      if (tx.feeCoin && tx.feeAmount) User.addToHolding(user.id, tx.feeCoin, tx.network, tx.feeAmount);
    }
    return Transaction.update(tx.id, { status: 'rejected', rejectionReason: reason, resolvedAt: Date.now() });
  });
  res.json(result);
});

/* ---------------- Deposit addresses ---------------- */
router.get('/deposit-addresses', (req, res) => res.json(DepositAddress.list()));
router.put('/deposit-addresses', (req, res) => {
  const { coin, network, address } = req.body;
  if (!isValidCoinNetwork(coin, network)) throw new HttpError(400, 'Invalid coin/network combination');
  if (!address || !address.trim()) throw new HttpError(400, 'Address is required');
  res.json(DepositAddress.upsert({ coin, network, address: address.trim() }));
});
router.delete('/deposit-addresses/:id', (req, res) => {
  if (!DepositAddress.remove(req.params.id)) throw new HttpError(404, 'Address not found');
  res.json({ ok: true });
});

/* ---------------- Support contact details ---------------- */
router.get('/support-settings', (req, res) => res.json(SupportSettings.get()));
router.put('/support-settings', (req, res) => res.json(SupportSettings.set(req.body)));

module.exports = router;
