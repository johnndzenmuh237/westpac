// Reference data for the demo. Prices are static/simulated - no real market feed,
// no real blockchain networks. Nothing here moves real funds.

const COINS = {
  BTC:   { name: 'Bitcoin',  networks: ['BTC'],                              price: 75709.00, icon: 'btc' },
  ETH:   { name: 'Ethereum', networks: ['ERC20'],                            price: 2393.84,  icon: 'eth' },
  USDT:  { name: 'Tether',   networks: ['ERC20', 'TRC20', 'BEP20', 'SOL'],   price: 1.00,     icon: 'usdt' },
  USDC:  { name: 'USD Coin', networks: ['ERC20', 'TRC20', 'BEP20', 'SOL'],   price: 1.00,     icon: 'usdc' },
  BNB:   { name: 'BNB',      networks: ['BEP20'],                            price: 719.12,   icon: 'bnb' },
  TRX:   { name: 'TRON',     networks: ['TRC20'],                            price: 0.12,     icon: 'trx' },
  SOL:   { name: 'Solana',   networks: ['SOL'],                              price: 97.56,    icon: 'sol' },
  MATIC: { name: 'Polygon',  networks: ['MATIC'],                            price: 0.85,     icon: 'matic' }
};

// Which native "gas" coin is required to move a coin on a given network.
// null means the network is native and needs no separate gas coin (e.g. BTC).
const GAS_COIN = {
  BTC: null,
  ERC20: 'ETH',
  TRC20: 'TRX',
  BEP20: 'BNB',
  SOL: 'SOL',
  MATIC: 'MATIC'
};

// Flat simulated network fee, denominated in the gas coin, charged on every
// swap-to-USD or crypto withdrawal that moves a coin on that network.
const NETWORK_FEE = {
  BTC: 0,
  ERC20: 0.0025,
  TRC20: 6,
  BEP20: 0.012,
  SOL: 0.03,
  MATIC: 0.6
};

function holdingKey(coin, network) {
  return `${coin}_${network}`;
}

function isValidCoinNetwork(coin, network) {
  return !!COINS[coin] && COINS[coin].networks.includes(network);
}

// Options used by the admin's "create client" form.
const ACCOUNT_TYPES = ['Personal', 'Joint', 'Business', 'Corporate'];
const BUSINESS_ACCOUNT_TYPES = ['Business', 'Corporate']; // these need a business registration number
const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'AED', 'INR', 'NGN', 'GHS', 'KES', 'ZAR'];
const ID_TYPES = ['Passport', 'National ID card', "Driver's licence", 'Residence permit'];
const SOURCES_OF_FUNDS = [
  'Salary / employment income', 'Business income', 'Savings', 'Investments',
  'Inheritance', 'Sale of property', 'Pension / retirement', 'Other'
];

module.exports = {
  COINS, GAS_COIN, NETWORK_FEE, holdingKey, isValidCoinNetwork,
  ACCOUNT_TYPES, BUSINESS_ACCOUNT_TYPES, FIAT_CURRENCIES, ID_TYPES, SOURCES_OF_FUNDS
};
