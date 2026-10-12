const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const DepositAddress = require('../models/DepositAddress');
const SupportSettings = require('../models/SupportSettings');
const { transaction } = require('../config/db');
const { requireUser } = require('../middleware/auth');
const { COINS, GAS_COIN, NETWORK_FEE, isValidCoinNetwork } = require('../utils/constants');
const { getLivePrices } = require('../utils/marketPrices');
const HttpError = require('../utils/httpError');

const router = express.Router();
router.use(requireUser);

const maskId = (v) => (v ? '•'.repeat(Math.max(0, v.length - 4)) + v.slice(-4) : '');
function serializeUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phoneNumber: u.phoneNumber, country: u.country,
    username: u.username, usdBalance: u.usdBalance, kycStatus: u.kycStatus || 'none', holdings: u.holdings,
    accountType: u.accountType || '', preferredCurrencies: u.preferredCurrencies || [],
    dateOfBirth: u.dateOfBirth || '', nationality: u.nationality || '', address: u.address || '',
    city: u.city || '', postcode: u.postcode || '', idType: u.idType || '', idNumberMasked: maskId(u.idNumber)
  };
}
function mustLoadSelf(req) {
  const user = User.findById(req.auth.userId);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

// Network-fee rule used by swaps AND crypto withdrawals: the fee is always
// paid in the network's gas coin (TRC20->TRX, BEP20->BNB, ERC20->ETH, SOL->SOL,
// MATIC->MATIC). If the wallet doesn't have enough of it, the action is blocked.
// Must be called inside a transaction(); it deducts the fee when it passes.
function chargeNetworkFee(userId, coin, network, amount, action) {
  const gasCoin = GAS_COIN[network];
  const fee = NETWORK_FEE[network] || 0;
  if (!gasCoin || fee <= 0) return {};

  const sameHolding = gasCoin === coin; // e.g. moving TRX on TRC20: fee comes from the same balance
  const available = User.getHoldingBalance(userId, gasCoin, network);
  const enough = sameHolding ? available >= amount + fee : available >= fee;
  if (!enough) {
    throw new HttpError(
      400,
      sameHolding
        ? `Not enough ${coin} to cover the amount plus the ${fee} ${gasCoin} network fee`
        : `${gasCoin} needed before ${action} can work`,
      { code: 'GAS_COIN_REQUIRED', gasCoin, required: fee, available }
    );
  }
  User.addToHolding(userId, gasCoin, network, -fee);
  return { feeCoin: gasCoin, feeAmount: fee };
}

/* ---------------- Reference / profile ---------------- */
router.get('/reference', async (req, res) => {
  const live = await getLivePrices();
  const coins = {};
  for (const [symbol, meta] of Object.entries(COINS)) {
    coins[symbol] = { ...meta, price: live[symbol]?.price ?? meta.price, change24h: live[symbol]?.change24h ?? 0, live: !!live[symbol]?.live };
  }
  res.json({ coins, gasCoin: GAS_COIN, networkFee: NETWORK_FEE });
});

router.get('/me', (req, res) => res.json(serializeUser(mustLoadSelf(req))));

// Clients can keep their contact number up to date. Everything else about the
// account (legal name, address, ID, password...) is managed by the bank.
router.put('/profile', (req, res) => {
  const user = mustLoadSelf(req);
  const phoneNumber = String(req.body.phoneNumber || '').trim();
  if (phoneNumber.replace(/\D/g, '').length < 6) throw new HttpError(400, 'Enter a valid phone number');
  res.json(serializeUser(User.update(user.id, { phoneNumber })));
});

/* ---------------- Transactions / notifications ---------------- */
router.get('/transactions', (req, res) => res.json(Transaction.list({ userId: req.auth.userId })));

router.post('/transactions/mark-all-seen', (req, res) => {
  Transaction.markAllRejectedSeen(req.auth.userId);
  res.json({ ok: true });
});
router.post('/transactions/:id/seen', (req, res) => {
  const tx = Transaction.findForUser(req.params.id, req.auth.userId);
  if (!tx) throw new HttpError(404, 'Transaction not found');
  Transaction.update(tx.id, { seenByUser: true });
  res.json({ ok: true });
});

/* ---------------- Deposit / support / KYC ---------------- */
router.get('/deposit-addresses', (req, res) => res.json(DepositAddress.list()));
router.get('/support-settings', (req, res) => res.json(SupportSettings.get()));
router.post('/kyc/request', (req, res) => {
  const user = mustLoadSelf(req);
  const updated = user.kycStatus === 'none' ? User.update(user.id, { kycStatus: 'pending' }) : user;
  res.json({ kycStatus: updated.kycStatus });
});

/* ---------------- Swap ---------------- */
// POST /api/user/swap  { coin, network, amount, toCoin?, toNetwork? }
//   toCoin omitted or "USD"  -> crypto -> USD cash balance
//   toCoin + toNetwork       -> crypto -> another crypto (any listed coin/network)
// The source coin is debited, the destination credited at the live market
// rate, and the network fee is paid from the source network's gas coin.
router.post('/swap', async (req, res) => {
  const { coin, network, amount, toCoin, toNetwork } = req.body;
  const amt = Number(amount);
  if (!isValidCoinNetwork(coin, network)) throw new HttpError(400, 'Invalid coin/network combination');
  if (!amt || amt <= 0) throw new HttpError(400, 'Enter a valid amount');

  const toUsd = !toCoin || toCoin === 'USD';
  if (!toUsd) {
    if (!isValidCoinNetwork(toCoin, toNetwork)) throw new HttpError(400, 'Invalid destination coin/network');
    if (toCoin === coin && toNetwork === network) throw new HttpError(400, 'Choose a different coin or network to swap into');
  }

  const live = await getLivePrices();
  const fromPrice = live[coin]?.price ?? COINS[coin].price;
  const toPrice = toUsd ? 1 : (live[toCoin]?.price ?? COINS[toCoin].price);

  const tx = transaction(() => {
    const user = mustLoadSelf(req);
    if (User.getHoldingBalance(user.id, coin, network) < amt) throw new HttpError(400, 'Amount exceeds available balance');

    const fee = chargeNetworkFee(user.id, coin, network, amt, 'swapping');
    User.addToHolding(user.id, coin, network, -amt);

    const usdValue = amt * fromPrice;
    if (toUsd) {
      User.update(user.id, { usdBalance: user.usdBalance + usdValue });
      return Transaction.create({ userId: user.id, type: 'swap', status: 'approved', coin, network, amount: amt, usdAmount: usdValue, ...fee });
    }
    const received = usdValue / toPrice;
    User.addToHolding(user.id, toCoin, toNetwork, received);
    return Transaction.create({
      userId: user.id, type: 'swap', status: 'approved', coin, network, amount: amt, usdAmount: usdValue,
      toCoin, toNetwork, toAmount: received, ...fee
    });
  });

  res.json({ user: serializeUser(mustLoadSelf(req)), transaction: tx });
});

/* ---------------- Withdrawals ---------------- */
// Bank withdrawals only ever touch the USD balance (swap crypto -> USD first).
// The amount is held immediately and returned automatically if admin rejects.
router.post('/withdraw/bank', (req, res) => {
  const { amount, bankDetails } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new HttpError(400, 'Enter a valid amount');
  if (!bankDetails || !bankDetails.bankName || !bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.routing) {
    throw new HttpError(400, 'Full bank details are required');
  }
  const tx = transaction(() => {
    const user = mustLoadSelf(req);
    if (amt > user.usdBalance) throw new HttpError(400, 'Amount exceeds your USD balance. Swap some crypto to USD first.');
    User.update(user.id, { usdBalance: user.usdBalance - amt });
    return Transaction.create({ userId: user.id, type: 'withdraw_bank', status: 'pending', usdAmount: amt, bankDetails });
  });
  res.status(201).json({ user: serializeUser(mustLoadSelf(req)), transaction: tx });
});

// Crypto withdrawals need the network's gas coin; the amount and the fee are
// both held immediately and refunded automatically if admin rejects.
router.post('/withdraw/crypto', (req, res) => {
  const { coin, network, amount, walletAddress } = req.body;
  const amt = Number(amount);
  if (!isValidCoinNetwork(coin, network)) throw new HttpError(400, 'Invalid coin/network combination');
  if (!amt || amt <= 0) throw new HttpError(400, 'Enter a valid amount');
  if (!walletAddress || !walletAddress.trim()) throw new HttpError(400, 'Destination wallet address is required');

  const tx = transaction(() => {
    const user = mustLoadSelf(req);
    if (User.getHoldingBalance(user.id, coin, network) < amt) throw new HttpError(400, 'Amount exceeds available balance');
    const fee = chargeNetworkFee(user.id, coin, network, amt, 'withdrawal');
    User.addToHolding(user.id, coin, network, -amt);
    return Transaction.create({
      userId: user.id, type: 'withdraw_crypto', status: 'pending', coin, network, amount: amt,
      walletAddress: walletAddress.trim(), ...fee
    });
  });
  res.status(201).json({ user: serializeUser(mustLoadSelf(req)), transaction: tx });
});

module.exports = router;
