/* server-routes.js  (project root, next to server.js)
   - POST /api/public/applications           website "Open an Account" form -> saved
   - GET  /api/admin/applications            admin inbox
   - POST /api/admin/applications/:id/status admin updates status
   - POST /api/user/support/chat             support AI (falls back to a built-in FAQ)
   - GET  /api/public/tawk, GET/PUT /api/admin/tawk   Tawk.to live chat address
   - Live crypto prices applied to any API response that contains a "coins" object
   Optional: set ANTHROPIC_API_KEY in your host's Environment settings for AI answers. */
const crypto = require('crypto');
const { db } = require('./config/db');
const { requireUser, requireAdmin } = require('./middleware/auth');

const SITE_NAME = 'Westpac Global'; // change here if you rename the platform

/* ---------- Live crypto prices (CoinGecko, free, no API key) ---------- */
const GECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin',
  BNB: 'binancecoin', TRX: 'tron', SOL: 'solana', MATIC: 'matic-network'
};
const livePrices = {};
let livePricesAt = 0;

async function refreshLivePrices(){
  try{
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + Object.values(GECKO_IDS).join(',')
      + '&vs_currencies=usd&include_24hr_change=true';
    const r = await fetch(url, { headers:{ accept:'application/json' } });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    for(const [coin, id] of Object.entries(GECKO_IDS)){
      if(data[id] && typeof data[id].usd === 'number'){
        livePrices[coin] = { price: data[id].usd, change24h: data[id].usd_24h_change || 0 };
      }
    }
    livePricesAt = Date.now();
  }catch(e){
    console.error('Live price refresh failed, keeping last known prices:', e.message);
  }
}
refreshLivePrices();
setInterval(refreshLivePrices, 60000);

function applyLivePrices(coins){
  const fresh = Date.now() - livePricesAt < 10 * 60 * 1000;
  for(const coin of Object.keys(coins)){
    const c = livePrices[coin];
    if(c && fresh){
      coins[coin].price = c.price;
      coins[coin].change24h = c.change24h;
      coins[coin].live = true;
    } else if(coins[coin]) {
      coins[coin].live = false;
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'new',
    acctType TEXT, currencies TEXT, fullName TEXT, dob TEXT, nationality TEXT, residence TEXT,
    address TEXT, city TEXT, postcode TEXT, email TEXT, phone TEXT,
    idType TEXT, idNumber TEXT, idCountry TEXT, occupation TEXT, employer TEXT,
    sourceFunds TEXT, deposit TEXT, bizReg TEXT,
    createdAt INTEGER NOT NULL
  );
`);

const FIELDS = ['acctType','currencies','fullName','dob','nationality','residence','address','city','postcode','email','phone',
  'idType','idNumber','idCountry','occupation','employer','sourceFunds','deposit','bizReg'];
const REQUIRED = ['acctType','currencies','fullName','dob','nationality','residence','address','city','postcode','email','phone','idType','idNumber','idCountry','occupation','sourceFunds','deposit'];
const STATUSES = ['new','in_review','approved','declined'];

// small in-memory limit for the public form: 5 submissions per IP per hour
const hits = new Map();
function limited(ip){
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 5;
}

const FAQ = [
  [/reject|declin/i, "If a withdrawal was rejected, the exact reason is shown on your Transactions page and the funds are returned to your balance. Fix the issue (for example the bank account name must match the name on file) and submit it again."],
  [/deposit|credit|not showing|didn.?t arrive/i, "Deposits are credited manually by the administrator after you send funds to the address shown on the Deposit page. Once you've sent them, notify the support team so they can credit your balance."],
  [/swap|fee|gas|network/i, "Swaps and crypto withdrawals need a small amount of the network's gas coin (for example ETH on Ethereum) in your wallet to pay the network fee. The fee is shown before you confirm."],
  [/verif|kyc|identity|upgrade/i, "Open the KYC Verification page and press Upgrade Now. Once your request is reviewed, your withdrawal limits increase."],
  [/password|login|sign in|locked/i, "For security, passwords can only be reset by the administrator. Please contact our team on WhatsApp and they will issue a new one."]
];
function faqAnswer(msg){
  for(const [re, ans] of FAQ) if(re.test(msg)) return { reply: ans, escalate: false };
  return { reply: "I'm not certain I can answer that accurately, so I'd rather not guess.", escalate: true };
}
const UNHAPPY = /not (satisfied|helpful|helping)|didn.?t help|useless|human|real person|agent|speak to (someone|support)|talk to (someone|support)|complain/i;

async function aiAnswer(message, history){
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return faqAnswer(message);
  const system = [
    "You are the customer support assistant inside the " + SITE_NAME + " client dashboard (deposits, withdrawals, swaps, network gas fees, account details, KYC verification, loans).",
    "Facts: deposits are credited manually by an administrator after the user sends funds to the deposit address shown on the Deposit page; withdrawals are reviewed by an admin and rejections show a reason on the Transactions page, with funds returned; swaps and crypto withdrawals need the network's gas coin balance; passwords are reset only by an administrator.",
    "Be brief, friendly and accurate. Never ask for passwords, private keys or full ID numbers. Never invent balances or statuses and do not promise outcomes.",
    "If you cannot fully resolve the issue, the question is about a specific account or transaction you cannot see, or the user seems unhappy, end your reply with the exact token [[ESCALATE]]. The platform will then show the user a WhatsApp button to reach the human team. Never tell users to email support."
  ].join(' ');
  const msgs = [];
  for(const h of (history||[]).slice(-10)){
    const role = h.role === 'assistant' ? 'assistant' : 'user';
    const text = String(h.text||'').slice(0,1000);
    if(!text) continue;
    if(msgs.length && msgs[msgs.length-1].role === role) msgs[msgs.length-1].content += '\n' + text;
    else msgs.push({ role, content:text });
  }
  while(msgs.length && msgs[0].role !== 'user') msgs.shift();
  if(msgs.length && msgs[msgs.length-1].role === 'user') msgs[msgs.length-1].content += '\n' + message;
  else msgs.push({ role:'user', content:message });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'x-api-key':key, 'anthropic-version':'2023-06-01', 'content-type':'application/json' },
    body: JSON.stringify({ model:'claude-sonnet-5-5', max_tokens:400, system, messages:msgs })
  });
  if(!r.ok) throw new Error('AI request failed: ' + r.status);
  const data = await r.json();
  let text = (data.content||[]).map(b => b.text||'').join('').trim();
  const escalate = text.includes('[[ESCALATE]]');
  text = text.replace('[[ESCALATE]]','').trim();
  return { reply: text || "Sorry, I couldn't come up with an answer.", escalate };
}

/* ---------- Tawk.to live chat setting (editable from the admin panel) ---------- */
db.exec(`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)`);
function getSetting(k){ const r = db.prepare('SELECT value FROM site_settings WHERE key=?').get(k); return r ? r.value : ''; }
function setSetting(k, v){ db.prepare('INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v); }
// Accepts the full widget snippet, the embed URL, the direct chat link, or "PROPERTYID/WIDGETID"
function normalizeTawk(input){
  const s = String(input || '').trim();
  if(!s) return '';
  const m = s.match(/(?:embed\.tawk\.to|tawk\.to\/chat)\/([a-z0-9]+)\/([a-z0-9]+)/i) || s.match(/^([a-z0-9]+)\/([a-z0-9]+)$/i);
  return m ? `https://embed.tawk.to/${m[1]}/${m[2]}` : null;
}

module.exports = function(app){
/* Multi-currency account support: worldwide fiat catalogue and admin-configured receiving details. */
const WORLD_FIAT_CURRENCIES = [
  'AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XOF','XPF','YER','ZAR','ZMW','ZWL'
];
const FIAT_RECEIVING_FIELDS = ['bankName','accountName','accountNumber','iban','swift','routing','bankAddress','instructions'];
try {
  db.exec(`CREATE TABLE IF NOT EXISTS fiat_receiving_details (
    currency TEXT PRIMARY KEY, bankName TEXT NOT NULL, accountName TEXT NOT NULL,
    accountNumber TEXT, iban TEXT, swift TEXT, routing TEXT, bankAddress TEXT, instructions TEXT,
    updatedAt INTEGER NOT NULL
  )`);
} catch(e) { console.error('Could not prepare fiat receiving details table:', e.message); }
function listFiatReceivingDetails(){
  return db.prepare('SELECT currency,bankName,accountName,accountNumber,iban,swift,routing,bankAddress,instructions,updatedAt FROM fiat_receiving_details ORDER BY currency').all()
    .map(d=>({...d,status:(d.accountNumber||d.iban)?'configured':'pending'}));
}
function safeFiatReceivingBody(body){
  const out = {};
  for(const field of FIAT_RECEIVING_FIELDS) out[field] = String(body[field] == null ? '' : body[field]).trim().slice(0,300);
  return out;
}
  // Make every API response that contains a "coins" price list use live prices
  app.use('/api', (req, res, next) => {
    const orig = res.json.bind(res);
    res.json = (body) => {
      try{
        if(body && body.coins && typeof body.coins === 'object') applyLivePrices(body.coins);
        if(body && body.options && Array.isArray(body.options.fiatCurrencies)) {
          body.options.fiatCurrencies = [...new Set([...body.options.fiatCurrencies, ...WORLD_FIAT_CURRENCIES])].sort();
        }
      }catch(e){ /* never break a response over prices/currency choices */ }
      return orig(body);
    };
    next();
  });

  // PUBLIC: the website loads this to know which Tawk widget to show
  app.get('/api/public/tawk', (req, res) => res.json({ url: getSetting('tawkUrl') }));

  // ADMIN: read / save the Tawk address
  app.get('/api/admin/tawk', requireAdmin, (req, res) => res.json({ url: getSetting('tawkUrl') }));
  app.put('/api/admin/tawk', requireAdmin, (req, res) => {
    const url = normalizeTawk(req.body && req.body.url);
    if(url === null) return res.status(400).json({ error:'That does not look like a Tawk.to widget address. Use the link that looks like https://embed.tawk.to/PROPERTY_ID/WIDGET_ID' });
    setSetting('tawkUrl', url);
    res.json({ ok:true, url });
  });

  // ADMIN: configure genuine provider-issued fiat receiving details per currency.
  app.get('/api/admin/fiat-receiving-details', requireAdmin, (req, res) => res.json(listFiatReceivingDetails()));
  app.put('/api/admin/fiat-receiving-details', requireAdmin, (req, res) => {
    const body = req.body || {};
    const currency = String(body.currency || '').trim().toUpperCase();
    if(!WORLD_FIAT_CURRENCIES.includes(currency)) return res.status(400).json({error:'Choose a supported fiat currency.'});
    const data = safeFiatReceivingBody(body);
    if(!data.bankName || !data.accountName || (!data.accountNumber && !data.iban))
      return res.status(400).json({error:'Bank/provider, account holder and account number or IBAN are required.'});
    db.prepare(`INSERT INTO fiat_receiving_details (currency,${FIAT_RECEIVING_FIELDS.join(',')},updatedAt)
      VALUES (${['?'].concat(FIAT_RECEIVING_FIELDS.map(()=>'?')).concat('?').join(',')})
      ON CONFLICT(currency) DO UPDATE SET ${FIAT_RECEIVING_FIELDS.map(f=>`${f}=excluded.${f}`).join(',')},updatedAt=excluded.updatedAt`)
      .run(currency, ...FIAT_RECEIVING_FIELDS.map(f=>data[f]), Date.now());
    res.json({ok:true,currency});
  });
  app.delete('/api/admin/fiat-receiving-details/:currency', requireAdmin, (req, res) => {
    const currency = String(req.params.currency || '').trim().toUpperCase();
    const result = db.prepare('DELETE FROM fiat_receiving_details WHERE currency=?').run(currency);
    if(!result.changes) return res.status(404).json({error:'No receiving details configured for that currency.'});
    res.json({ok:true});
  });
  // USER: return details only for currencies assigned to the authenticated user.
  app.get('/api/user/fiat-receiving-details', requireUser, (req, res) => {
    try {
      const userId = req.user && (req.user.id || req.user.userId || req.user.sub);
      if(!userId) return res.status(401).json({error:'Authentication required'});
      const row = db.prepare('SELECT preferredCurrencies FROM users WHERE id=?').get(userId);
      let currencies = [];
      try { const parsed = JSON.parse((row && row.preferredCurrencies) || '[]'); currencies = Array.isArray(parsed) ? parsed : []; } catch(e) {}
      const configured = listFiatReceivingDetails();
      return res.json(currencies.filter(c=>WORLD_FIAT_CURRENCIES.includes(String(c).toUpperCase())).map(c=>{
        const code = String(c).toUpperCase();
        return configured.find(d=>d.currency===code) || {currency:code,status:'pending'};
      }));
    } catch(e) {
      console.error('Could not load user fiat receiving details:',e.message);
      return res.status(500).json({error:'Could not load receiving details'});
    }
  });

  /* Multi-currency ledger. Admin credits are transparently labelled as admin credits, not bank-originated deposits. */
  db.exec(`CREATE TABLE IF NOT EXISTS fiat_account_balances (
    userId TEXT NOT NULL, currency TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0,
    updatedAt INTEGER NOT NULL, PRIMARY KEY(userId,currency)
  );
  CREATE TABLE IF NOT EXISTS fiat_account_transactions (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, currency TEXT NOT NULL, amount REAL NOT NULL,
    type TEXT NOT NULL, status TEXT NOT NULL, reference TEXT NOT NULL UNIQUE,
    description TEXT, createdAt INTEGER NOT NULL, source TEXT NOT NULL DEFAULT 'admin'
  );`);
  const fiatFxCache = { at:0, rates:null };
  async function getFiatFxRates(){
    if(fiatFxCache.rates && Date.now()-fiatFxCache.at < 5*60*1000) return fiatFxCache.rates;
    const r = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
    if(!r.ok) throw new Error('FX provider unavailable');
    const data = await r.json();
    fiatFxCache.rates = { base:'USD', date:data.date, rates:{USD:1,...data.rates}, provider:'Frankfurter', fetchedAt:Date.now() };
    fiatFxCache.at = Date.now();
    return fiatFxCache.rates;
  }
  app.get('/api/public/fx-rates', async (req,res)=>{
    try { res.json(await getFiatFxRates()); }
    catch(e) { res.status(503).json({error:'Live fiat exchange rates are temporarily unavailable.'}); }
  });
  app.get('/api/user/fiat-balances', requireUser, (req,res)=>{
    const userId = req.user && (req.user.id || req.user.userId || req.user.sub);
    if(!userId) return res.status(401).json({error:'Authentication required'});
    const rows = db.prepare('SELECT currency,balance,updatedAt FROM fiat_account_balances WHERE userId=? ORDER BY currency').all(String(userId));
    res.json(rows);
  });
  app.get('/api/user/fiat-transactions', requireUser, (req,res)=>{
    const userId = req.user && (req.user.id || req.user.userId || req.user.sub);
    if(!userId) return res.status(401).json({error:'Authentication required'});
    res.json(db.prepare('SELECT id,currency,amount,type,status,reference,description,createdAt,source FROM fiat_account_transactions WHERE userId=? ORDER BY createdAt DESC').all(String(userId)));
  });
  app.post('/api/admin/fiat-credit', requireAdmin, (req,res)=>{
    const body = req.body || {};
    const userId = String(body.userId || '').trim();
    const currency = String(body.currency || '').trim().toUpperCase();
    const amount = Number(body.amount);
    const description = String(body.description || 'Account balance adjustment by administrator').trim().slice(0,240);
    if(!userId || !WORLD_FIAT_CURRENCIES.includes(currency) || !Number.isFinite(amount) || amount<=0 || amount>1e12)
      return res.status(400).json({error:'Enter a valid user, assigned currency and positive amount.'});
    const user = db.prepare('SELECT id,preferredCurrencies FROM users WHERE id=?').get(userId);
    if(!user) return res.status(404).json({error:'User not found.'});
    let assigned=[]; try { const parsed=JSON.parse(user.preferredCurrencies||'[]'); assigned=Array.isArray(parsed)?parsed.map(x=>String(x).toUpperCase()):[]; } catch(e) {}
    if(!assigned.includes(currency)) return res.status(400).json({error:'That currency is not assigned to this user. Assign it in user settings first.'});
    const id = crypto.randomUUID();
    const reference = 'WPG-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const now = Date.now();
    const run = db.transaction(()=>{
      db.prepare(`INSERT INTO fiat_account_balances(userId,currency,balance,updatedAt) VALUES(?,?,?,?)
        ON CONFLICT(userId,currency) DO UPDATE SET balance=balance+excluded.balance,updatedAt=excluded.updatedAt`).run(userId,currency,amount,now);
      db.prepare(`INSERT INTO fiat_account_transactions(id,userId,currency,amount,type,status,reference,description,createdAt,source)
        VALUES(?,?,?,?,?,?,?,?,?,'admin')`).run(id,userId,currency,amount,'admin_credit','confirmed',reference,description,now);
    });
    run();
    res.json({ok:true,id,reference,currency,amount,status:'confirmed',createdAt:now,type:'admin_credit'});
  });

  // PUBLIC: website "Open an Account" form (no login needed)
  app.post('/api/public/applications', (req, res) => {
    if(limited(req.ip)) return res.status(429).json({ error:'Too many submissions. Please try again later.' });
    const body = req.body || {};
    const doc = {};
    for(const f of FIELDS) doc[f] = String(body[f] == null ? '' : body[f]).trim().slice(0, 300);
    if(REQUIRED.some(f => !doc[f])) return res.status(400).json({ error:'Please complete all required fields.' });
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doc.email)) return res.status(400).json({ error:'Please enter a valid email address.' });
    db.prepare(`INSERT INTO applications (id,status,${FIELDS.join(',')},createdAt) VALUES (?,?,${FIELDS.map(()=>'?').join(',')},?)`)
      .run(crypto.randomUUID(), 'new', ...FIELDS.map(f => doc[f]), Date.now());
    res.json({ ok:true });
  });

  // ADMIN: inbox
  app.get('/api/admin/applications', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM applications ORDER BY createdAt DESC LIMIT 500').all();
    res.json(rows.map(a => ({ ...a, date:a.createdAt })));
  });
  app.post('/api/admin/applications/:id/status', requireAdmin, (req, res) => {
    const status = req.body && req.body.status;
    if(!STATUSES.includes(status)) return res.status(400).json({ error:'Invalid status' });
    const r = db.prepare('UPDATE applications SET status=? WHERE id=?').run(status, req.params.id);
    if(!r.changes) return res.status(404).json({ error:'Not found' });
    res.json({ ok:true });
  });

  // USER: support assistant
  app.post('/api/user/support/chat', requireUser, async (req, res) => {
    const message = String((req.body && req.body.message) || '').trim().slice(0, 1000);
    if(!message) return res.status(400).json({ error:'Empty message' });
    if(UNHAPPY.test(message)) return res.json({ reply:"Understood — let me connect you with our team.", escalate:true });
    try{ res.json(await aiAnswer(message, req.body.history)); }
    catch(e){ res.json(faqAnswer(message)); }
  });
};
