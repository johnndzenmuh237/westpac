/* server-routes.js — Express routes for the two new features.
   I could not see your server code, so this is written against common
   assumptions (Express + Mongoose, JSON body parsing, your own auth
   middleware). Adapt the three `deps` to match your project.

   In your server:
     require('./server-routes')(app, { requireUser, requireAdmin, getSupportSettings });

   - requireUser / requireAdmin : your existing auth middlewares
   - getSupportSettings()       : async () => ({ email, whatsapp })  (what /admin/support-settings stores)
   - Optional: set ANTHROPIC_API_KEY in your environment for AI answers. Without it,
     a built-in keyword FAQ answers instead (and unknown questions go to email).
   - Mount path: if your api() helper prefixes "/api", the routes below are
     /api/public/applications, /api/admin/applications..., /api/user/support/chat. */
const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  status: { type: String, default: 'new', enum: ['new','in_review','approved','declined'] },
  acctType:String, currencies:String, fullName:String, dob:String, nationality:String, residence:String,
  address:String, city:String, postcode:String, email:String, phone:String,
  idType:String, idNumber:String, idCountry:String, occupation:String, employer:String,
  sourceFunds:String, deposit:String, bizReg:String
}, { timestamps:true });
const Application = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);

const FIELDS = ['acctType','currencies','fullName','dob','nationality','residence','address','city','postcode','email','phone',
  'idType','idNumber','idCountry','occupation','employer','sourceFunds','deposit','bizReg'];
const REQUIRED = ['acctType','currencies','fullName','dob','nationality','residence','address','city','postcode','email','phone','idType','idNumber','idCountry','occupation','sourceFunds','deposit'];

// tiny in-memory rate limit for the public form: 5 submissions / IP / hour
const hits = new Map();
function limited(ip){
  const now = Date.now(), win = 3600e3;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 5;
}

const FAQ = [
  [/reject|declin/i, "If a withdrawal was rejected, the exact reason is shown on your Transactions page and the funds are returned to your balance. Fix the issue (for example the bank account name must match the name on file) and submit it again."],
  [/deposit|credit|not showing|didn.?t arrive/i, "Deposits are credited manually by the administrator after you send funds to the address shown on the Deposit page. Once you've sent them, notify the support team so they can credit your balance."],
  [/swap|fee|gas|network/i, "Swaps and crypto withdrawals need a small amount of the network's gas coin (for example ETH on Ethereum) in your wallet to pay the network fee. The fee is shown before you confirm."],
  [/verif|kyc|identity|upgrade/i, "Open the Verification page and press Upgrade Now. Once your request is reviewed, your withdrawal limits increase."],
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
    "You are the customer support assistant inside the West Pac Global client dashboard (deposits, withdrawals, swaps, network gas fees, account details, verification).",
    "Facts: deposits are credited manually by an administrator after the user sends funds to the deposit address shown on the Deposit page; withdrawals are reviewed by an admin and rejections show a reason on the Transactions page, with funds returned; swaps and crypto withdrawals need the network's gas coin balance; passwords are reset only by an administrator.",
    "Be brief, friendly and accurate. Never ask for passwords, private keys or full ID numbers. Never invent account balances or statuses and do not promise outcomes.",
    "If you cannot fully resolve the issue, the question is about a specific account/transaction you cannot see, or the user seems unhappy, end your reply with the exact token [[ESCALATE]]."
  ].join(' ');
  const msgs = [];
  for(const h of (history||[]).slice(-10)){
    const role = h.role === 'assistant' ? 'assistant' : 'user';
    const text = String(h.text||'').slice(0,1000);
    if(!text) continue;
    if(msgs.length && msgs[msgs.length-1].role === role) msgs[msgs.length-1].content += '\n' + text;
    else msgs.push({ role, content:text });
  }
  if(msgs.length && msgs[0].role !== 'user') msgs.shift();
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

module.exports = function(app, { requireUser, requireAdmin }){
  // PUBLIC: website "Open an Account" form
  app.post('/api/public/applications', async (req, res) => {
    try{
      if(limited(req.ip)) return res.status(429).json({ error:'Too many submissions. Please try again later.' });
      const body = req.body || {};
      const doc = {};
      for(const f of FIELDS) doc[f] = String(body[f] == null ? '' : body[f]).trim().slice(0, 300);
      const missing = REQUIRED.filter(f => !doc[f]);
      if(missing.length) return res.status(400).json({ error:'Please complete all required fields.' });
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doc.email)) return res.status(400).json({ error:'Please enter a valid email address.' });
      await Application.create(doc);
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ error:'Could not save your application.' }); }
  });

  // ADMIN: inbox
  app.get('/api/admin/applications', requireAdmin, async (req, res) => {
    const list = await Application.find().sort({ createdAt:-1 }).limit(500).lean();
    res.json(list.map(a => ({ ...a, id:String(a._id), date:a.createdAt })));
  });
  app.post('/api/admin/applications/:id/status', requireAdmin, async (req, res) => {
    const status = req.body && req.body.status;
    if(!['new','in_review','approved','declined'].includes(status)) return res.status(400).json({ error:'Invalid status' });
    const a = await Application.findByIdAndUpdate(req.params.id, { status }, { new:true });
    if(!a) return res.status(404).json({ error:'Not found' });
    res.json({ ok:true });
  });

  // USER: support assistant
  app.post('/api/user/support/chat', requireUser, async (req, res) => {
    const message = String((req.body && req.body.message) || '').trim().slice(0, 1000);
    if(!message) return res.status(400).json({ error:'Empty message' });
    if(UNHAPPY.test(message)) return res.json({ reply:"Understood — let me connect you with our team.", escalate:true });
    try{
      res.json(await aiAnswer(message, req.body.history));
    }catch(e){
      res.json(faqAnswer(message));
    }
  });
};