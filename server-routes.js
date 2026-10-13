/* server-routes.js  (project root, next to server.js)
   Adds, using YOUR existing SQLite database and login middleware:
     - POST /api/public/applications           website "Open an Account" form -> saved
     - GET  /api/admin/applications            admin inbox
     - POST /api/admin/applications/:id/status admin updates status
     - POST /api/user/support/chat             support AI (falls back to a built-in FAQ)
   Optional: set ANTHROPIC_API_KEY in Render's Environment tab for AI answers.
   No new npm packages needed. */
const crypto = require('crypto');
const { db } = require('./config/db');
const { requireUser, requireAdmin } = require('./middleware/auth');

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
  [/password|login|sign in|locked/i, "For security, passwords can only be reset by the administrator. Please email the support team and they will issue a new one."]
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
    "You are the customer support assistant inside the West Pac Global client dashboard (deposits, withdrawals, swaps, network gas fees, account details, KYC verification).",
    "Facts: deposits are credited manually by an administrator after the user sends funds to the deposit address shown on the Deposit page; withdrawals are reviewed by an admin and rejections show a reason on the Transactions page, with funds returned; swaps and crypto withdrawals need the network's gas coin balance; passwords are reset only by an administrator.",
    "Be brief, friendly and accurate. Never ask for passwords, private keys or full ID numbers. Never invent balances or statuses and do not promise outcomes.",
    "If you cannot fully resolve the issue, the question is about a specific account or transaction you cannot see, or the user seems unhappy, end your reply with the exact token [[ESCALATE]]."
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

module.exports = function(app){
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
    if(UNHAPPY.test(message)) return res.json({ reply:"Understood - let me connect you with our team.", escalate:true });
    try{ res.json(await aiAnswer(message, req.body.history)); }
    catch(e){ res.json(faqAnswer(message)); }
  });
};
