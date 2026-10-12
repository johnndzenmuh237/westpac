const { COINS } = require('./constants');

// Maps our internal coin symbols to CoinGecko's asset ids.
const GECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  TRX: 'tron',
  SOL: 'solana',
  MATIC: 'matic-network'
};

let cache = { data: null, ts: 0 };
const CACHE_MS = 45 * 1000; // refresh at most every 45s to stay well within CoinGecko's free rate limit

// Returns { BTC: { price, change24h }, ... } using live prices where available,
// falling back to the static demo prices in constants.js if the network call
// fails (e.g. offline, rate-limited) so the app never breaks.
async function getLivePrices() {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_MS) return cache.data;

  try {
    const ids = Object.values(GECKO_IDS).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('CoinGecko request failed: ' + res.status);
    const json = await res.json();

    const result = {};
    for (const symbol of Object.keys(COINS)) {
      const geckoId = GECKO_IDS[symbol];
      const entry = geckoId && json[geckoId];
      result[symbol] = entry
        ? { price: entry.usd, change24h: entry.usd_24h_change || 0, live: true }
        : { price: COINS[symbol].price, change24h: 0, live: false };
    }
    cache = { data: result, ts: now };
    return result;
  } catch (err) {
    // Network issue or CoinGecko unavailable - fall back to static demo prices.
    const fallback = {};
    for (const symbol of Object.keys(COINS)) {
      fallback[symbol] = { price: COINS[symbol].price, change24h: 0, live: false };
    }
    return cache.data || fallback;
  }
}

module.exports = { getLivePrices };
