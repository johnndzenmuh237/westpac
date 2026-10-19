if (!Session.token || Session.role !== 'admin') {
  window.location.href = '/admin-login.html';
}

let REF = { coins: {}, gasCoin: {}, networkFee: {} };
let currentView = null;
/* Worldwide ISO-style fiat currency choices. Existing account logic is preserved. */
const WORLD_FIAT_CURRENCIES = [
  'AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD',
  'CAD','CDF','CHF','CLP','CNY','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD',
  'HKD','HNL','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD',
  'MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR',
  'RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS',
  'UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XOF','XPF','YER','ZAR','ZMW','ZWL'
];
function allFiatCurrencies(){
  const existing = (REF && REF.options && Array.isArray(REF.options.fiatCurrencies)) ? REF.options.fiatCurrencies : [];
  return [...new Set([...existing, ...WORLD_FIAT_CURRENCIES])].sort();
}
function localCurrencyForCountry(country){
  const c=String(country||'').trim().toLowerCase();
  const m={
    'cameroon':'XAF','india':'INR','united states':'USD','united states of america':'USD','usa':'USD','australia':'AUD','canada':'CAD','united kingdom':'GBP','great britain':'GBP',
    'france':'EUR','germany':'EUR','italy':'EUR','spain':'EUR','portugal':'EUR','netherlands':'EUR','belgium':'EUR','ireland':'EUR','austria':'EUR','finland':'EUR','greece':'EUR','luxembourg':'EUR','cyprus':'EUR','estonia':'EUR','latvia':'EUR','lithuania':'EUR','malta':'EUR','slovakia':'EUR','slovenia':'EUR','croatia':'EUR',
    'nigeria':'NGN','ghana':'GHS','south africa':'ZAR','kenya':'KES','uganda':'UGX','tanzania':'TZS','rwanda':'RWF','senegal':'XOF','ivory coast':'XOF',"cote d'ivoire":'XOF','benin':'XOF','togo':'XOF','burkina faso':'XOF','mali':'XOF','niger':'XOF','gabon':'XAF','chad':'XAF','central african republic':'XAF','equatorial guinea':'XAF','republic of the congo':'XAF','democratic republic of the congo':'CDF','zambia':'ZMW','zimbabwe':'ZWL','botswana':'BWP','namibia':'NAD','mozambique':'MZN','angola':'AOA','ethiopia':'ETB','egypt':'EGP','morocco':'MAD','algeria':'DZD','tunisia':'TND',
    'china':'CNY','japan':'JPY','south korea':'KRW','singapore':'SGD','hong kong':'HKD','new zealand':'NZD','switzerland':'CHF','sweden':'SEK','norway':'NOK','denmark':'DKK','poland':'PLN','czech republic':'CZK','czechia':'CZK','hungary':'HUF','romania':'RON','bulgaria':'BGN','turkey':'TRY','russia':'RUB','brazil':'BRL','mexico':'MXN','argentina':'ARS','chile':'CLP','colombia':'COP','peru':'PEN','uruguay':'UYU','venezuela':'VES','saudi arabia':'SAR','united arab emirates':'AED','qatar':'QAR','kuwait':'KWD','israel':'ILS','thailand':'THB','indonesia':'IDR','malaysia':'MYR','philippines':'PHP','pakistan':'PKR','bangladesh':'BDT','sri lanka':'LKR','nepal':'NPR','vietnam':'VND'
  };
  return m[c] || 'USD';
}
function defaultCurrenciesForCountry(country){ return [...new Set(['USD','AUD','CAD','EUR',localCurrencyForCountry(country)])]; }
function countryInputHTML(id,value){
  return `<div class="field"><label for="${id}">${id==='cf_residenceCountry'?'Country of residence':id==='cf_nationality'?'Nationality':'Country of issue'}</label><input id="${id}" list="${id}_list" value="${String(value||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" placeholder="Type to search countries…" autocomplete="off"><datalist id="${id}_list">${COUNTRIES.map(c=>`<option value="${String(c).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></option>`).join('')}</datalist></div>`;
}
const COIN_COLORS = { BTC:'#f7931a', ETH:'#8296ee', USDT:'#26a17b', USDC:'#2775ca', BNB:'#f3ba2f', TRX:'#ff0013', SOL:'#9945ff', MATIC:'#8247e5' };
const ICON_BASE = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@0.18.1/svg/color';

function coinIconHTML(coin, size){
  size = size || 34;
  const color = COIN_COLORS[coin] || '#8b8da3';
  const slug = (REF.coins[coin] && REF.coins[coin].icon) || coin.toLowerCase();
  return `<div class="coin-ic" style="background:${color}22;color:${color};width:${size}px;height:${size}px;position:relative;">
    <span>${coin[0]}</span>
    <img src="${ICON_BASE}/${slug}.svg" alt="" style="position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:contain;background:#fff;" onerror="this.style.display='none'">
  </div>`;
}

function toast(msg, type){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type==='err'?' err':type==='ok'?' ok':'');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>el.remove(), 3600);
}
function fmtUSD(n){ return '$'+(Math.round((n+Number.EPSILON)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtCoin(n){ n=Number(n)||0; return (Math.round(n*1e6)/1e6).toString(); }
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' · '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); }
function shortAddr(a){ if(!a) return ''; return a.length>18 ? a.slice(0,8)+'…'+a.slice(-6) : a; }
function txTypeLabel(t){
  if(t.currency && t.type==='admin_credit') return 'Fiat account credit';
  if(t.currency && t.type==='admin_debit') return 'Fiat account debit';
  if(t.currency && t.type==='fiat_swap') return 'Fiat currency swap';
  if(t.type==='credit') return t.coin ? 'Deposit' : 'Deposit (USD)';
  if(t.type==='withdraw_bank') return 'Withdraw to Bank';
  if(t.type==='withdraw_crypto') return 'Withdraw to Crypto';
  if(t.type==='swap') return 'Swap';
  return t.type;
}
function txAmountLabel(t){
  if(t.currency){ const n=Number(t.amount)||0; return (n>0?'+':n<0?'−':'')+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8})+' '+t.currency; }
  if(t.type==='withdraw_bank') return fmtUSD(t.usdAmount);
  if(t.type==='withdraw_crypto') return fmtCoin(t.amount)+' '+t.coin+' ('+t.network+')';
  if(t.type==='swap') return t.toCoin
    ? fmtCoin(t.amount)+' '+t.coin+' ('+t.network+') → '+fmtCoin(t.toAmount)+' '+t.toCoin+' ('+t.toNetwork+')'
    : fmtCoin(t.amount)+' '+t.coin+' → '+fmtUSD(t.usdAmount);
  if(t.type==='credit') return t.coin ? '+'+fmtCoin(t.amount)+' '+t.coin+' ('+t.network+')' : '+'+fmtUSD(t.usdAmount);
  return '—';
}
function esc(x){ const d=document.createElement('div'); d.textContent=(x==null?'':String(x)); return d.innerHTML; }
/* Clean data list. cols: [{l:'Label', w:'1fr', cls:'first|num|act'}], rows: arrays of cell HTML */
function dt(cols, rows){
  const tpl = cols.map(c=>c.w||'minmax(0,1fr)').join(' ');
  const head = cols.map(c=>`<div class="${c.cls||''}">${c.l}</div>`).join('');
  const body = rows.map(r=>`<div class="dt-row">${cols.map((c,i)=>{
    const cls = c.cls||'';
    const inner = (cls.includes('first')||cls.includes('act')) ? r[i] : `<span class="v">${r[i]}</span>`;
    return `<div class="dt-c ${cls}" data-label="${c.l}">${inner}</div>`;
  }).join('')}</div>`).join('');
  return `<div class="dt" style="--cols:${tpl}"><div class="dt-head">${head}</div>${body}</div>`;
}
function openModal(html, wide){
  document.getElementById('modalRoot').innerHTML = `<div class="modal-overlay" id="ov"><div class="modal${wide?' wide':''}">${html}</div></div>`;
  document.getElementById('ov').addEventListener('click', e=>{ if(e.target.id==='ov') closeModal(); });
}
function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }
function logout(){ Session.clear(); window.location.href='/admin-login.html'; }
function toggleSidebar(open){
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('scrim').classList.toggle('hidden', !open);
}

async function nav(view, arg){
  currentView = view;
['overview','createuser','users','edituser','deposits','support','withdrawals','cards','upgrades','transfers','loans','kycreq','applications'].forEach(v=>{
  const el = document.getElementById('view-'+v);
  if(el) el.classList.toggle('hidden', v!==view);
});
  const highlight = view==='edituser' ? 'users' : view;
  document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active', el.dataset.view===highlight));
  toggleSidebar(false);
  if(view==='edituser') await renderEditUser(arg);
  if(view==='overview') await renderOverview();
  if(view==='createuser') renderCreateUser();
  if(view==='users') await renderUsers();
  if(view==='deposits') await renderDepositAddresses();
  if(view==='support') await renderSupportSettings();
  if(view==='withdrawals') await renderWithdrawals();
  if(view==='applications') await renderApplications();
  if(view==='loans') await renderLoans();
  if(view==='kycreq') await renderKycRequests();
  if(view==='cards') await window.renderCardRequests();
  if(view==='upgrades') await window.renderUpgradeRequests();
  if(view==='transfers') await window.renderTransferRequests();
  if(typeof refreshAppBadge==='function') refreshAppBadge();
}
setInterval(()=>{ if(currentView==='overview') renderOverview(); }, 30000);
async function refreshBadge(){
  const pending = await api('/admin/transactions?status=pending');
  const badge = document.getElementById('pendingBadge');
  if(pending.length>0){ badge.textContent = pending.length; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

async function renderOverview(){
  REF = await api('/admin/reference');
  const [users, regularTx, fiatTx] = await Promise.all([
    api('/admin/users'), api('/admin/transactions'), api('/admin/fiat-transactions').catch(()=>[])
  ]);
  const allTx=[...regularTx,...fiatTx].sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  const totalUSD = users.reduce((a,u)=>a+u.usdBalance,0);
  const totalCrypto = users.reduce((a,u)=>a+Object.values(u.holdings).reduce((s,h)=>s+h.balance*(REF.coins[h.coin]?.price||0),0),0);
  const pending = regularTx.filter(t=>t.status==='pending').length;
  const feed = allTx.slice(0,10);

  const marketHtml = Object.keys(REF.coins).map(c=>{
    const meta = REF.coins[c];
    const change = meta.change24h || 0;
    const up = change >= 0;
    return `<div class="market-tile">
      <div class="row gap-8">${coinIconHTML(c,34)}
        <div><div style="font-weight:600;font-size:13.5px;">${meta.name}</div><div class="coin-meta">${c}</div></div></div>
      <div style="text-align:right;">
        <div style="font-weight:700;font-size:13.5px;">${fmtUSD(meta.price)}</div>
        <div style="font-size:11.5px;color:${up?'var(--green)':'var(--red)'}">${up?'+':''}${change.toFixed(2)}%</div>
      </div>
    </div>`;
  }).join('');
  const liveAny = Object.values(REF.coins).some(c=>c.live);

  document.getElementById('view-overview').innerHTML = `
    <div class="stats" style="margin-bottom:20px;">
      <div class="card"><div class="muted" style="font-size:12.5px;margin-bottom:8px;">Total Users</div><div style="font-size:26px;font-weight:800;">${users.length}</div></div>
      <div class="card"><div class="muted" style="font-size:12.5px;margin-bottom:8px;">Total USD Balances</div><div style="font-size:26px;font-weight:800;color:var(--green);">${fmtUSD(totalUSD)}</div></div>
      <div class="card"><div class="muted" style="font-size:12.5px;margin-bottom:8px;">Total Crypto Value</div><div style="font-size:26px;font-weight:800;color:var(--cyan);">${fmtUSD(totalCrypto)}</div></div>
    </div>

    <div class="section-label">Market Overview</div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-title"><i class="fa-solid fa-chart-line"></i> All Coins ${liveAny ? '<span class="pill pill-cyan"><span class="badge-dot"></span> Live</span>' : '<span class="pill pill-amber">Offline prices</span>'}</div>
      <div class="grid-2">${marketHtml}</div>
    </div>

    <div class="card">
      <div class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Recent Activity ${pending>0?`<span class="pill pill-amber">${pending} pending</span>`:''}</div>
      ${feed.length ? dt([
        {l:'User',w:'minmax(0,1.3fr)',cls:'first'},{l:'Type',w:'minmax(0,1.2fr)'},{l:'Amount',w:'minmax(0,1.6fr)'},{l:'Status',w:'90px'},{l:'When',w:'minmax(0,1.3fr)'}
      ], feed.map(t=>[
        `<span class="strong">${esc(t.user?.name||'—')}</span><span class="sub mono">@${esc(t.user?.username||'')}</span>`,
        txTypeLabel(t), txAmountLabel(t),
        `<span class="status-chip status-${t.status}">${t.status}</span>`,
        `<span class="muted">${fmtDate(t.createdAt)}</span>`
      ])) : '<div class="empty-state">No activity yet. Create a user and credit a balance to get started.</div>'}
    </div>
  `;
}

/* ---------------- Client account form (create + edit) ---------------- */
function selectHTML(id, list, value, placeholder){
  const items = list.slice();
  if(value && !items.includes(value)) items.push(value); // keep unusual legacy values selectable
  return `<select id="${id}">${placeholder ? `<option value="">${placeholder}</option>` : ''}${
    items.map(i=>`<option value="${i}" ${i===value?'selected':''}>${i}</option>`).join('')}</select>`;
}
function inputHTML(id, label, value, { type='text', placeholder='', hint='', required=true } = {}){
  return `<div class="field"><label for="${id}">${label}${required?'':' <span class="muted" style="font-weight:500;">(optional)</span>'}</label>
    <input id="${id}" type="${type}" value="${String(value ?? '').replace(/"/g,'&quot;')}" placeholder="${placeholder}">${hint?`<div class="hint">${hint}</div>`:''}</div>`;
}
function chipsHTML(list, selected){
  return list.map(c=>`<label class="chip"><input type="checkbox" name="cf_currency" value="${c}" ${selected.includes(c)?'checked':''}> ${c}</label>`).join('');
}

function clientFormHTML(v, mode){
  const o = REF.options;
  const picked = (v.preferredCurrencies && v.preferredCurrencies.length) ? v.preferredCurrencies : (mode==='create' ? ['USD','AUD','CAD','EUR'] : []);
  const isBiz = (o.businessAccountTypes||[]).includes(v.accountType);
  return `
    <div class="form-section">
      <h3><i class="fa-solid fa-id-badge"></i> Account</h3>
      <div class="field"><label for="cf_accountType">Account type</label>${selectHTML('cf_accountType', o.accountTypes, v.accountType||'', 'Select account type…')}</div>
      <div class="field"><label>Preferred currencies <span class="muted" style="font-weight:500;">(choose at least one)</span></label>
        <div class="group-label">Fiat</div><div class="chip-group">${chipsHTML(allFiatCurrencies(), picked)}</div>
        <div class="group-label">Digital</div><div class="chip-group">${chipsHTML(Object.keys(REF.coins), picked)}</div>
      </div>
    </div>

    <div class="form-section">
      <h3><i class="fa-solid fa-user"></i> Personal details</h3>
      <div class="two-col">
        ${inputHTML('cf_legalName','Legal name (as on ID)', v.name, { placeholder:'e.g. Winifred Anne Eagle' })}
        ${inputHTML('cf_dateOfBirth','Date of birth', v.dateOfBirth, { type:'date' })}
        ${countryInputHTML('cf_nationality',v.nationality||'')}
        ${countryInputHTML('cf_residenceCountry',v.country||'')}
      </div>
      ${inputHTML('cf_address','Residential address', v.address, { placeholder:'Street address' })}
      <div class="two-col">
        ${inputHTML('cf_city','City', v.city)}
        ${inputHTML('cf_postcode','Postcode', v.postcode)}
      </div>
    </div>

    <div class="form-section">
      <h3><i class="fa-solid fa-address-book"></i> Contact details</h3>
      <div class="two-col">
        ${inputHTML('cf_email','Email address', v.email, { type:'email', placeholder:'name@example.com' })}
        ${inputHTML('cf_phoneNumber','Phone number', v.phoneNumber, { placeholder:'+1 555 123 4567' })}
      </div>
    </div>

    <div class="form-section">
      <h3><i class="fa-solid fa-passport"></i> Identification</h3>
      <div class="three-col">
        <div class="field"><label for="cf_idType">ID type</label>${selectHTML('cf_idType', o.idTypes, v.idType||'', 'Select…')}</div>
        ${inputHTML('cf_idNumber','ID number', v.idNumber)}
        ${countryInputHTML('cf_idCountry',v.idCountry||'')}
      </div>
    </div>

    <div class="form-section">
      <h3><i class="fa-solid fa-briefcase"></i> Financial &amp; employment</h3>
      <div class="two-col">
        ${inputHTML('cf_occupation','Occupation', v.occupation)}
        ${inputHTML('cf_employer','Employer', v.employer, { required:false })}
        <div class="field"><label for="cf_sourceOfFunds">Source of funds</label>${selectHTML('cf_sourceOfFunds', o.sourcesOfFunds, v.sourceOfFunds||'', 'Select…')}</div>
        ${inputHTML('cf_expectedDeposit','Expected deposit (USD)', v.expectedDeposit ?? '', { type:'number', placeholder:'0.00', hint:'Information only — this does not add any funds.' })}
      </div>
      <div id="cf_bizWrap" class="${isBiz?'':'hidden'}">
        ${inputHTML('cf_businessRegNumber','Business registration number', v.businessRegNumber, { hint:'Required for Business and Corporate accounts.' })}
      </div>
    </div>

    ${mode==='create' ? `
    <div class="form-section">
      <h3><i class="fa-solid fa-file-signature"></i> Consent</h3>
      <label class="consent-row"><input type="checkbox" id="cf_consentAccuracy"><span>I confirm that the information provided above is accurate and complete to the best of my knowledge.</span></label>
      <label class="consent-row"><input type="checkbox" id="cf_consentTerms"><span>I have read and agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a> and the <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
    </div>` : ''}
  `;
}
function onAccountTypeChange(){
  const type = document.getElementById('cf_accountType').value;
  document.getElementById('cf_bizWrap').classList.toggle('hidden', !(REF.options.businessAccountTypes||[]).includes(type));
}
function wireClientForm(){
  document.getElementById('cf_accountType').addEventListener('change', onAccountTypeChange);
  const country=document.getElementById('cf_residenceCountry');
  if(country) country.addEventListener('change',()=>{
    for(const code of defaultCurrenciesForCountry(country.value)){
      const box=[...document.querySelectorAll('input[name="cf_currency"]')].find(x=>x.value===code);
      if(box) box.checked=true;
    }
  });
}
function collectClientForm(mode){
  const val = (id)=>document.getElementById(id).value.trim();
  const data = {
    accountType: val('cf_accountType'),
    preferredCurrencies: [...document.querySelectorAll('input[name="cf_currency"]:checked')].map(c=>c.value),
    legalName: val('cf_legalName'), dateOfBirth: val('cf_dateOfBirth'), nationality: val('cf_nationality'),
    residenceCountry: val('cf_residenceCountry'), address: val('cf_address'), city: val('cf_city'), postcode: val('cf_postcode'),
    email: val('cf_email'), phoneNumber: val('cf_phoneNumber'),
    idType: val('cf_idType'), idNumber: val('cf_idNumber'), idCountry: val('cf_idCountry'),
    occupation: val('cf_occupation'), employer: val('cf_employer'), sourceOfFunds: val('cf_sourceOfFunds'),
    expectedDeposit: val('cf_expectedDeposit'), businessRegNumber: val('cf_businessRegNumber')
  };
  if(mode==='create'){
    data.consentAccuracy = document.getElementById('cf_consentAccuracy').checked;
    data.consentTerms = document.getElementById('cf_consentTerms').checked;
  }
  return data;
}

function renderCreateUser(){
  document.getElementById('view-edituser').innerHTML = ''; // both forms share field IDs - keep only one in the page
  document.getElementById('view-createuser').innerHTML = `
    <div class="card form-card">
      <div class="card-title"><i class="fa-solid fa-user-plus"></i> Open a Client Account</div>
      <p class="muted" style="font-size:13px;margin:-8px 0 20px;">Enter the client's details below. A username and password are generated for them when you submit.</p>
      ${clientFormHTML({}, 'create')}
      <button class="btn btn-primary btn-block" onclick="createUser()"><i class="fa-solid fa-circle-check"></i> Open Account &amp; Generate Login</button>
    </div>
  `;
  wireClientForm();
}
async function createUser(){
  const data = collectClientForm('create');
  data.preferredCurrencies=[...new Set([...data.preferredCurrencies,...defaultCurrenciesForCountry(data.residenceCountry)])];
  try{
    const created = await api('/admin/users', { method:'POST', body:data });
    const credentials = created.credentials;
    const newUserId = created.user?.id || created.id || created.user?._id;
    if(newUserId) { try { await api('/admin/fiat-ensure-user',{method:'POST',body:{userId:newUserId}}); } catch(e) { /* defaults are already submitted with the account form */ } }
    openModal(`
      <h3><i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Account Opened</h3>
      <p class="muted" style="font-size:13.5px;">Give these sign-in details to <b>${data.legalName}</b>. The password is only ever shown once — it is not stored in readable form.</p>
      <div class="creds-box">
        <div class="creds-line"><span class="muted">Username</span><span class="val">${credentials.username}</span></div>
        <div class="creds-line"><span class="muted">Password</span><span class="val">${credentials.password}</span></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="closeModal()">Done</button>
    `);
    renderCreateUser();
    window.scrollTo(0,0);
  }catch(e){ toast(e.message,'err'); }
}

async function openEditUser(userId){
  closeModal();
  await nav('edituser', userId);
}
async function renderEditUser(userId){
  const u = await api('/admin/users/'+userId);
  document.getElementById('view-createuser').innerHTML = ''; // both forms share field IDs - keep only one in the page
  document.getElementById('view-edituser').innerHTML = `
    <div class="card form-card">
      <div class="card-title"><i class="fa-solid fa-pen-to-square"></i> Edit Client Details <span class="muted mono" style="font-weight:500;">@${u.username}</span></div>
      ${clientFormHTML(u, 'edit')}
      <div class="row gap-8">
        <button class="btn btn-primary" onclick="saveClientDetails('${u.id}')"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
        <button class="btn btn-outline" onclick="nav('users')">Cancel</button>
      </div>
    </div>
  `;
  wireClientForm();
  window.scrollTo(0,0);
}
async function saveClientDetails(userId){
  try{
    await api(`/admin/users/${userId}`, { method:'PUT', body:collectClientForm('edit') });
    toast('Client details saved','ok');
    await nav('users');
  }catch(e){ toast(e.message,'err'); }
}

// One click: opens that user's real dashboard in a new tab. The admin's own
// login in this tab is untouched (the new tab gets its own private session).
async function openUserDashboard(userId){
  const tab = window.open('', '_blank'); // opened synchronously so popup blockers allow it
  try{
    const { token, name } = await api(`/admin/users/${userId}/impersonate`, { method:'POST' });
    const url = `/user.html#imp=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`;
    if(tab){ tab.location.href = url; } else { window.location.href = url; }
  }catch(e){
    if(tab) tab.close();
    toast(e.message,'err');
  }
}

async function renderUsers(){
  const users = await api('/admin/users');
  if(users.length===0){
    document.getElementById('view-users').innerHTML = '<div class="card"><div class="empty-state">No clients yet. Go to "Create User" to open the first account.</div></div>';
    return;
  }
  document.getElementById('view-users').innerHTML = `
    <div class="card">
      <div class="card-title"><i class="fa-solid fa-users"></i> All Users</div>
      ${dt([
        {l:'Name',w:'minmax(0,2fr)',cls:'first'},{l:'Username',w:'minmax(0,1.2fr)'},
        {l:'USD Balance',w:'minmax(0,1fr)',cls:'num'},{l:'Crypto Value',w:'minmax(0,1fr)',cls:'num'},{l:'',w:'220px',cls:'act'}
      ], users.map(u=>{
        const cryptoVal = Object.values(u.holdings).reduce((s,h)=>s+h.balance*(REF.coins[h.coin]?.price||0),0);
        return [
          `<span class="strong">${esc(u.name)}</span><span class="sub mono">${esc(u.email)}</span>${u.accountType?`<span class="pill pill-purple" style="margin-top:6px;padding:2px 9px;font-size:11px;">${esc(u.accountType)}</span>`:''}`,
          `<span class="mono">@${esc(u.username)}</span>`, fmtUSD(u.usdBalance), fmtUSD(cryptoVal),
          `<button class="btn btn-primary btn-sm" onclick="openUserDashboard('${u.id}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> Dashboard</button>
           <button class="btn btn-outline btn-sm" onclick="openManageUser('${u.id}')">Manage</button>`
        ];
      }))}
    </div>
  `;
}

async function openManageUser(userId){
  const u = await api('/admin/users/'+userId);
  const holdingsRows = Object.values(u.holdings).map(h=>`
    <div class="holding-edit">
      <div class="who">
        ${coinIconHTML(h.coin, 32)}
        <div>
          <div style="font-weight:600;">${h.coin} <span class="muted" style="font-weight:500;">· ${h.network}</span></div>
          <div class="mono">${fmtCoin(h.balance)} ${h.coin} ≈ ${fmtUSD(h.balance*(REF.coins[h.coin]?.price||0))}</div>
        </div>
      </div>
      <div class="set">
        <input type="number" step="any" id="editBal_${h.coin}_${h.network}" value="${h.balance}">
        <button class="btn btn-outline btn-sm" onclick="setHoldingBalance('${u.id}','${h.coin}','${h.network}')">Set</button>
      </div>
    </div>`).join('') || '<div class="empty-state" style="padding:16px;">No crypto credited yet.</div>';

  const coinOptions = Object.keys(REF.coins).map(c=>`<option value="${c}">${c} — ${REF.coins[c].name}</option>`).join('');
  const countryOptions = COUNTRIES.map(c=>`<option value="${c}" ${c===u.country?'selected':''}>${c}</option>`).join('');

  openModal(`
    <h3>Manage: ${u.name}</h3>
    <p class="muted mono" style="font-size:12.5px;margin-top:-4px;">@${esc(u.username)} · ${esc(u.email)}</p>
    <button class="btn btn-primary btn-block btn-sm" onclick="openUserDashboard('${u.id}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open ${u.name.split(' ')[0]}'s Dashboard</button>

    <div class="card" style="padding:16px;margin:14px 0;background:var(--bg-soft);">
      <div class="card-title" style="font-size:13.5px;margin-bottom:12px;"><i class="fa-solid fa-id-card"></i> Client Details</div>
      <dl class="detail-grid">
        <div><dt>Account type</dt><dd>${u.accountType||'—'}</dd></div>
        <div><dt>Preferred currencies</dt><dd>${(u.preferredCurrencies||[]).join(', ')||'—'}</dd></div>
        <div><dt>Date of birth</dt><dd>${u.dateOfBirth||'—'}</dd></div>
        <div><dt>Nationality</dt><dd>${u.nationality||'—'}</dd></div>
        <div><dt>Residence</dt><dd>${[u.address,u.city,u.postcode,u.country].filter(Boolean).join(', ')||'—'}</dd></div>
        <div><dt>Contact</dt><dd>${u.email}<br>${u.phoneNumber||''}</dd></div>
        <div><dt>Identification</dt><dd>${u.idType?`${u.idType} · ${u.idNumber} (${u.idCountry})`:'—'}</dd></div>
        <div><dt>Occupation</dt><dd>${u.occupation||'—'}${u.employer?` · ${u.employer}`:''}</dd></div>
        <div><dt>Source of funds</dt><dd>${u.sourceOfFunds||'—'}</dd></div>
        <div><dt>Expected deposit</dt><dd>${u.expectedDeposit!=null?fmtUSD(u.expectedDeposit):'—'}</dd></div>
        ${u.businessRegNumber?`<div><dt>Business reg. no.</dt><dd>${u.businessRegNumber}</dd></div>`:''}
        <div><dt>Consent recorded</dt><dd>${u.consentAt?fmtDate(u.consentAt):'—'}</dd></div>
      </dl>
      <div class="row gap-8" style="margin-top:12px;">
        <button class="btn btn-outline btn-sm" onclick="openEditUser('${u.id}')"><i class="fa-solid fa-pen"></i> Edit details</button>
        <button class="btn btn-outline btn-sm" onclick="resetPassword('${u.id}')"><i class="fa-solid fa-key"></i> Reset password</button>
      </div>
    </div>

    <div class="card" style="padding:16px;margin-bottom:14px;background:var(--bg-soft);">
      <div class="card-title" style="font-size:13.5px;margin-bottom:10px;"><i class="fa-solid fa-sliders"></i> Credit Balance</div>
      <div class="role-tabs" style="margin-bottom:14px;">
        <div class="role-tab active" id="creditTab_usd" onclick="setCreditType('usd')">USD Balance</div>
        <div class="role-tab" id="creditTab_crypto" onclick="setCreditType('crypto')">Crypto Asset</div>
        <div class="role-tab" id="creditTab_fiat" onclick="setCreditType('fiat')">Fiat Currency</div>
      </div>

      <div id="creditPane_usd">
        <div class="field"><label>Amount to Add (USD)</label><input type="number" step="0.01" id="usdCreditAmount" placeholder="e.g. 500.00"></div>
        <button class="btn btn-primary btn-block btn-sm" onclick="creditUsd('${u.id}')">Credit USD (logged as a deposit)</button>
      </div>

      <div id="creditPane_fiat" class="hidden">
        <div class="field"><label>Currency assigned to this user</label><select id="fiatCreditCurrency">${allFiatCurrencies().filter(c=>(u.preferredCurrencies||[]).includes(c)).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Amount to add</label><input type="number" min="0.01" step="0.01" id="fiatCreditAmount" placeholder="e.g. 250.00"></div>
        <div class="field"><label>Internal note</label><input id="fiatCreditNote" maxlength="240" placeholder="Reason for this account credit"></div>
        <div class="hint" style="margin-bottom:10px;">Recorded as an administrator credit with a unique reference and timestamp. It does not represent a verified bank transfer.</div>
        <button class="btn btn-primary btn-block btn-sm" onclick="creditFiat('${u.id}')"><i class="fa-solid fa-plus"></i> Credit Fiat Balance</button>
        <div class="divider" style="margin:14px 0;"></div>
        <div class="field"><label>Amount to deduct</label><input type="number" min="0.01" step="0.01" id="fiatDebitAmount" placeholder="e.g. 50.00"></div>
        <div class="field"><label>Debit note</label><input id="fiatDebitNote" maxlength="240" placeholder="Reason for this account debit"></div>
        <button class="btn btn-outline btn-block btn-sm" onclick="debitFiat('${u.id}')"><i class="fa-solid fa-minus"></i> Debit Fiat Balance</button>
      </div>
      <div id="creditPane_crypto" class="hidden">
        <div class="field" style="margin-bottom:10px;"><label>Coin</label><select id="creditCoin" onchange="refreshCreditNetworks()">${coinOptions}</select></div>
        <div class="field" style="margin-bottom:10px;"><label>Network</label><select id="creditNetwork"></select></div>
        <div class="field" style="margin-bottom:10px;"><label>Amount</label><input type="number" step="any" min="0" id="creditAmount" placeholder="e.g. 0.5"></div>
        <div class="hint" id="creditGasHint" style="margin-bottom:10px;"></div>
        <button class="btn btn-primary btn-block btn-sm" onclick="creditCrypto('${u.id}')">Credit Crypto (logged as a deposit)</button>
      </div>
    </div>

    <div class="card" style="padding:16px;margin-bottom:14px;background:var(--bg-soft);">
      <div class="card-title" style="font-size:13.5px;margin-bottom:8px;"><i class="fa-solid fa-dollar-sign"></i> Current USD Balance</div>
      <div class="inline-form">
        <input type="number" step="0.01" id="usdEdit" value="${u.usdBalance}">
        <button class="btn btn-outline btn-sm" onclick="setUsdBalance('${u.id}')">Override</button>
      </div>
      <div style="font-size:12px;color:var(--text-faint);margin-top:8px;">Overrides the balance directly — no history entry is created.</div>
    </div>

    <div class="card" style="padding:16px;background:var(--bg-soft);">
      <div class="card-title" style="font-size:13.5px;margin-bottom:6px;"><i class="fa-solid fa-coins"></i> Existing Holdings</div>
      ${holdingsRows}
    </div>

    <button class="btn btn-outline btn-block" style="margin-top:16px;" onclick="closeModal()">Close</button>
  `, true);
  refreshCreditNetworks();
}
function setCreditType(type){
  document.getElementById('creditTab_usd').classList.toggle('active', type==='usd');
  document.getElementById('creditTab_crypto').classList.toggle('active', type==='crypto');
  if(document.getElementById('creditTab_fiat')) document.getElementById('creditTab_fiat').classList.toggle('active', type==='fiat');
  document.getElementById('creditPane_usd').classList.toggle('hidden', type!=='usd');
  document.getElementById('creditPane_crypto').classList.toggle('hidden', type!=='crypto');
  if(document.getElementById('creditPane_fiat')) document.getElementById('creditPane_fiat').classList.toggle('hidden', type!=='fiat');
}
function refreshCreditNetworks(){
  const coin = document.getElementById('creditCoin').value;
  const sel = document.getElementById('creditNetwork');
  sel.innerHTML = REF.coins[coin].networks.map(n=>`<option value="${n}">${n}${REF.gasCoin[n]?' (gas: '+REF.gasCoin[n]+')':' (native)'}</option>`).join('');
  updateCreditGasHint();
  sel.onchange = updateCreditGasHint;
}
function updateCreditGasHint(){
  const network = document.getElementById('creditNetwork').value;
  const gas = REF.gasCoin[network];
  document.getElementById('creditGasHint').textContent = gas
    ? `Users need some ${gas} on ${network} in their wallet to pay network fees before they can swap or withdraw this coin. Credit ${gas} too if you want this to be usable immediately.`
    : `${network} is a native network — no separate gas coin required.`;
}
async function creditUsd(userId){
  const amount = parseFloat(document.getElementById('usdCreditAmount').value);
  if(!amount || amount<=0){ toast('Enter a valid amount','err'); return; }
  try{
    await api(`/admin/users/${userId}/credit-usd`, { method:'POST', body:{ amount } });
    toast(`Credited ${fmtUSD(amount)} USD`,'ok');
    await openManageUser(userId);
  }catch(e){ toast(e.message,'err'); }
}
async function creditFiat(userId){
  const currency = document.getElementById('fiatCreditCurrency')?.value;
  const amount = Number(document.getElementById('fiatCreditAmount')?.value);
  const description = document.getElementById('fiatCreditNote')?.value.trim() || 'Account balance adjustment by administrator';
  if(!currency){ toast('Assign a currency to this user first','err'); return; }
  if(!Number.isFinite(amount) || amount<=0){ toast('Enter a valid amount','err'); return; }
  try{
    const result = await api('/admin/fiat-credit', {method:'POST',body:{userId,currency,amount,description}});
    toast(`Credited ${amount.toLocaleString()} ${currency} · ${result.reference}`,'ok');
    await openManageUser(userId);
  }catch(e){ toast(e.message,'err'); }
}

async function debitFiat(userId){
  const currency=document.getElementById('fiatCreditCurrency')?.value;
  const amount=Number(document.getElementById('fiatDebitAmount')?.value);
  const description=document.getElementById('fiatDebitNote')?.value.trim()||'Account balance adjustment by administrator';
  if(!currency){toast('Assign a currency to this user first','err');return;}
  if(!Number.isFinite(amount)||amount<=0){toast('Enter a valid debit amount','err');return;}
  try{const result=await api('/admin/fiat-debit',{method:'POST',body:{userId,currency,amount,description}});toast(`Debited ${amount.toLocaleString()} ${currency} · ${result.reference}`,'ok');await openManageUser(userId);}
  catch(e){toast(e.message,'err');}
}

async function creditCrypto(userId){
  const coin = document.getElementById('creditCoin').value;
  const network = document.getElementById('creditNetwork').value;
  const amount = parseFloat(document.getElementById('creditAmount').value);
  if(!amount || amount<=0){ toast('Enter a valid amount','err'); return; }
  try{
    await api(`/admin/users/${userId}/credit`, { method:'POST', body:{ coin, network, amount } });
    toast(`Credited ${amount} ${coin} (${network})`,'ok');
    await openManageUser(userId);
  }catch(e){ toast(e.message,'err'); }
}
async function setHoldingBalance(userId, coin, network){
  const val = parseFloat(document.getElementById(`editBal_${coin}_${network}`).value);
  if(isNaN(val) || val<0){ toast('Enter a valid balance','err'); return; }
  try{
    await api(`/admin/users/${userId}/holdings`, { method:'PUT', body:{ coin, network, balance: val } });
    toast('Balance updated','ok');
    await openManageUser(userId);
  }catch(e){ toast(e.message,'err'); }
}
async function setUsdBalance(userId){
  const val = parseFloat(document.getElementById('usdEdit').value);
  if(isNaN(val) || val<0){ toast('Enter a valid USD amount','err'); return; }
  try{
    await api(`/admin/users/${userId}/usd`, { method:'PUT', body:{ balance: val } });
    toast('USD balance updated','ok');
    await openManageUser(userId);
  }catch(e){ toast(e.message,'err'); }
}
async function resetPassword(userId){
  try{
    const { username, password } = await api(`/admin/users/${userId}/reset-password`, { method:'POST' });
    openModal(`
      <h3><i class="fa-solid fa-key"></i> Password Reset</h3>
      <p class="muted" style="font-size:13.5px;">Give this new password to the user — it won't be shown again.</p>
      <div class="creds-box">
        <div class="creds-line"><span class="muted">Username</span><span class="val">${username}</span></div>
        <div class="creds-line"><span class="muted">New Password</span><span class="val">${password}</span></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="closeModal()">Done</button>
    `);
  }catch(e){ toast(e.message,'err'); }
}

/* ---------------- Deposit Addresses (platform-wide, admin-configured) ---------------- */
async function renderDepositAddresses(){
  const addresses = await api('/admin/deposit-addresses');
  let receivingDetails = [];
  try { receivingDetails = await api('/admin/fiat-receiving-details'); } catch(e) { /* older server: crypto deposits remain available */ }
  const coinOptions = Object.keys(REF.coins).map(c=>`<option value="${c}">${c} — ${REF.coins[c].name}</option>`).join('');
  const fiatOptions = allFiatCurrencies().map(c=>`<option value="${c}">${c}</option>`).join('');

  document.getElementById('view-deposits').innerHTML = `
    <div class="card" style="max-width:560px;margin-bottom:20px;">
      <div class="card-title"><i class="fa-solid fa-qrcode"></i> Add / Update Deposit Address</div>
      <p class="muted" style="font-size:13px;margin-top:-8px;">This is the wallet address users will see and copy when they choose to deposit a given coin on a given network. Paste any placeholder address you like — no real funds are involved.</p>
      <div class="field" style="margin-bottom:10px;"><label>Coin</label><select id="daCoin" onchange="refreshDaNetworks()">${coinOptions}</select></div>
      <div class="field" style="margin-bottom:10px;"><label>Network</label><select id="daNetwork"></select></div>
      <div class="field"><label>Wallet Address</label><input id="daAddress" placeholder="Paste an address for this coin/network"></div>
      <button class="btn btn-primary btn-block" onclick="saveDepositAddress()">Save Address</button>
    </div>

    <div class="card">
      <div class="card-title"><i class="fa-solid fa-list"></i> Configured Addresses</div>
      ${addresses.length ? dt([
        {l:'Coin',w:'minmax(0,.8fr)',cls:'first'},{l:'Network',w:'minmax(0,1fr)'},{l:'Address',w:'minmax(0,2.2fr)'},{l:'',w:'100px',cls:'act'}
      ], addresses.map(a=>[
        `<span class="strong">${esc(a.coin)}</span>`, esc(a.network), `<span class="mono">${esc(shortAddr(a.address))}</span>`,
        `<button class="btn btn-danger btn-sm" onclick="deleteDepositAddress('${a._id}')">Remove</button>`
      ])) : '<div class="empty-state">No deposit addresses configured yet. Users will see "not yet configured" until you add one per coin/network.</div>'}
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-title"><i class="fa-solid fa-building-columns"></i> Fiat Receiving Details</div>
      <p class="muted" style="font-size:13px;margin-top:-8px;">Add bank details that you have actually received from your banking/payment provider. Users see details only for their selected currencies. Leave a currency unconfigured until real details are available.</p>
      <div class="two-col">
        <div class="field"><label>Currency</label><select id="frCurrency">${fiatOptions}</select></div>
        <div class="field"><label>Bank / Provider name</label><input id="frBankName" placeholder="Bank or licensed provider"></div>
        <div class="field"><label>Account holder name</label><input id="frAccountName" placeholder="Exact beneficiary name"></div>
        <div class="field"><label>Account number</label><input id="frAccountNumber" placeholder="Provider-issued account number"></div>
        <div class="field"><label>IBAN (if applicable)</label><input id="frIban" placeholder="IBAN"></div>
        <div class="field"><label>SWIFT / BIC</label><input id="frSwift" placeholder="SWIFT / BIC"></div>
        <div class="field"><label>Routing / sort / branch code</label><input id="frRouting" placeholder="Local bank code"></div>
        <div class="field"><label>Bank address</label><input id="frBankAddress" placeholder="Branch / bank address"></div>
      </div>
      <div class="field"><label>Payment reference / instructions</label><input id="frInstructions" placeholder="Reference or transfer instructions (optional)"></div>
      <button class="btn btn-primary" onclick="saveFiatReceivingDetails()"><i class="fa-solid fa-floppy-disk"></i> Save Currency Details</button>
      <div style="margin-top:18px;">
        ${receivingDetails.length ? dt([
          {l:'Currency',w:'90px',cls:'first'},{l:'Bank / Provider',w:'minmax(0,1.4fr)'},{l:'Account holder',w:'minmax(0,1.4fr)'},{l:'Account number',w:'minmax(0,1.3fr)'},{l:'',w:'90px',cls:'act'}
        ], receivingDetails.map(d=>[
          `<span class="strong">${esc(d.currency)}</span>`,esc(d.bankName||''),esc(d.accountName||''),`<span class="mono">${esc(d.accountNumber||d.iban||'')}</span>`,
          `<button class="btn btn-danger btn-sm" onclick="deleteFiatReceivingDetails('${esc(d.currency)}')">Remove</button>`
        ])) : '<div class="empty-state">No fiat receiving details configured yet. Users will see “Pending setup” for their selected fiat currencies.</div>'}
      </div>
    </div>
  `;
  refreshDaNetworks();
}
async function saveFiatReceivingDetails(){
  const data = {
    currency: document.getElementById('frCurrency').value,
    bankName: document.getElementById('frBankName').value.trim(),
    accountName: document.getElementById('frAccountName').value.trim(),
    accountNumber: document.getElementById('frAccountNumber').value.trim(),
    iban: document.getElementById('frIban').value.trim(),
    swift: document.getElementById('frSwift').value.trim(),
    routing: document.getElementById('frRouting').value.trim(),
    bankAddress: document.getElementById('frBankAddress').value.trim(),
    instructions: document.getElementById('frInstructions').value.trim()
  };
  if(!data.currency || !data.bankName || !data.accountName || (!data.accountNumber && !data.iban)){
    toast('Enter currency, provider, account holder and an account number or IBAN','err'); return;
  }
  try { await api('/admin/fiat-receiving-details', {method:'PUT', body:data}); toast('Fiat receiving details saved','ok'); await renderDepositAddresses(); }
  catch(e){ toast(e.message,'err'); }
}
async function deleteFiatReceivingDetails(currency){
  try { await api('/admin/fiat-receiving-details/'+encodeURIComponent(currency), {method:'DELETE'}); toast('Fiat details removed','ok'); await renderDepositAddresses(); }
  catch(e){ toast(e.message,'err'); }
}
function refreshDaNetworks(){
  const coin = document.getElementById('daCoin').value;
  document.getElementById('daNetwork').innerHTML = REF.coins[coin].networks.map(n=>`<option value="${n}">${n}</option>`).join('');
}
async function saveDepositAddress(){
  const coin = document.getElementById('daCoin').value;
  const network = document.getElementById('daNetwork').value;
  const address = document.getElementById('daAddress').value.trim();
  if(!address){ toast('Enter an address','err'); return; }
  try{
    await api('/admin/deposit-addresses', { method:'PUT', body:{ coin, network, address } });
    toast(`Saved deposit address for ${coin} (${network})`,'ok');
    await renderDepositAddresses();
  }catch(e){ toast(e.message,'err'); }
}
async function deleteDepositAddress(id){
  try{
    await api('/admin/deposit-addresses/'+id, { method:'DELETE' });
    toast('Address removed','ok');
    await renderDepositAddresses();
  }catch(e){ toast(e.message,'err'); }
}

/* ---------------- Support Settings + Tawk.to live chat ---------------- */
async function renderSupportSettings(){
  const settings = await api('/admin/support-settings');
  let tawk = { url:'' };
  try{ tawk = await api('/admin/tawk'); }catch(e){ /* tawk route not available yet */ }
  document.getElementById('view-support').innerHTML = `
    <div class="card" style="max-width:480px;margin-bottom:20px;">
      <div class="card-title"><i class="fa-solid fa-headset"></i> Support Contact Details</div>
      <p class="muted" style="font-size:13px;margin-top:-8px;">Saved contact details for the platform.</p>
      <div class="field"><label>Support Email</label><input id="suppEmail" value="${esc(settings.email||'')}" placeholder="support@example.com"></div>
      <div class="field"><label>WhatsApp Number</label><input id="suppWhatsapp" value="${esc(settings.whatsapp||'')}" placeholder="+1 555 123 4567"></div>
      <button class="btn btn-primary btn-block" onclick="saveSupportSettings()">Save Contact Details</button>
    </div>

    <div class="card" style="max-width:480px;">
      <div class="card-title"><i class="fa-solid fa-comments"></i> Tawk.to Live Chat</div>
      <p class="muted" style="font-size:13px;margin-top:-8px;">Paste your Tawk widget address (looks like <span class="mono">https://embed.tawk.to/PROPERTY_ID/WIDGET_ID</span>). Leave empty to turn the chat off.</p>
      <div class="field"><label>Tawk widget address</label><input id="tawkUrl" value="${esc(tawk.url||'')}" placeholder="https://embed.tawk.to/xxxxxxxx/xxxxxxxx"></div>
      <button class="btn btn-primary btn-block" onclick="saveTawk()">Save Tawk Address</button>
    </div>
  `;
}
async function saveSupportSettings(){
  const email = document.getElementById('suppEmail').value.trim();
  const whatsapp = document.getElementById('suppWhatsapp').value.trim();
  try{
    await api('/admin/support-settings', { method:'PUT', body:{ email, whatsapp } });
    toast('Support contact details saved','ok');
  }catch(e){ toast(e.message,'err'); }
}
async function saveTawk(){
  const url = document.getElementById('tawkUrl').value.trim();
  try{
    await api('/admin/tawk', { method:'PUT', body:{ url } });
    toast(url ? 'Tawk live chat saved' : 'Tawk live chat turned off','ok');
  }catch(e){ toast(e.message,'err'); }
}

/* ---------------- Withdrawals ---------------- */
async function renderWithdrawals(){
  const rows = (await api('/admin/transactions')).filter(t=>t.type==='withdraw_bank'||t.type==='withdraw_crypto');
  rows.sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1) || new Date(b.createdAt)-new Date(a.createdAt));

  if(rows.length===0){
    document.getElementById('view-withdrawals').innerHTML = '<div class="card"><div class="empty-state">No withdrawal requests yet.</div></div>';
    return;
  }
  document.getElementById('view-withdrawals').innerHTML = `
    <div class="card">
      <div class="card-title"><i class="fa-solid fa-building-columns"></i> Withdrawal Requests</div>
      ${dt([
        {l:'User',w:'minmax(0,1.3fr)',cls:'first'},{l:'Type',w:'minmax(0,1fr)'},{l:'Details',w:'minmax(0,1.5fr)'},
        {l:'Amount',w:'minmax(0,1.1fr)'},{l:'Status',w:'90px'},{l:'',w:'176px',cls:'act'}
      ], rows.map(t=>{
        let details;
        if(t.type==='withdraw_bank'){
          const b=t.bankDetails||{};
          details = `${esc(b.bankName||'')}<span class="sub mono">${esc(b.accountNumber||'')}</span><span class="sub">${esc(b.accountName||'')}</span>`;
        } else {
          details = `${esc(t.coin)} · ${esc(t.network)}<span class="sub mono">${esc(shortAddr(t.walletAddress))}</span>`;
        }
        let actions = '';
        if(t.status==='pending'){
          actions = `<button class="btn btn-primary btn-sm" onclick="approveWithdrawal('${t._id}')"><i class="fa-solid fa-check"></i> Approve</button>
                     <button class="btn btn-danger btn-sm" onclick="openRejectModal('${t._id}')"><i class="fa-solid fa-xmark"></i> Reject</button>`;
        } else if(t.status==='rejected'){
          actions = `<span class="sub" style="text-align:left;">${esc(t.rejectionReason||'')}</span>`;
        } else {
          actions = '<span class="muted" style="font-size:12px;">Resolved</span>';
        }
        return [
          `<span class="strong">${esc(t.user?.name||'—')}</span><span class="sub mono">@${esc(t.user?.username||'')}</span>`,
          txTypeLabel(t), details, txAmountLabel(t),
          `<span class="status-chip status-${t.status}">${t.status}</span>`, actions
        ];
      }))}
    </div>
  `;
}
async function approveWithdrawal(txId){
  try{
    await api(`/admin/withdrawals/${txId}/approve`, { method:'POST' });
    toast('Withdrawal approved','ok');
    await renderWithdrawals();
    await refreshBadge();
  }catch(e){ toast(e.message,'err'); }
}
function openRejectModal(txId){
  openModal(`
    <h3>Reject Withdrawal</h3>
    <p class="muted" style="font-size:13px;">This reason will be shown clearly to the user on their dashboard so they know how to proceed.</p>
    <div class="field"><label>Reason for rejection</label><textarea id="rejectReason" rows="4" placeholder="e.g. Bank account name does not match the name on file. Please resubmit with a matching account holder name."></textarea></div>
    <button class="btn btn-danger btn-block" onclick="confirmReject('${txId}')">Reject Transaction</button>
  `);
}
async function confirmReject(txId){
  const reason = document.getElementById('rejectReason').value.trim();
  if(!reason){ toast('Please provide a reason','err'); return; }
  try{
    await api(`/admin/withdrawals/${txId}/reject`, { method:'POST', body:{ reason } });
    closeModal();
    toast('Transaction rejected and funds returned to user','ok');
    await renderWithdrawals();
    await refreshBadge();
  }catch(e){ toast(e.message,'err'); }
}

/* ---------------- Applications inbox (website "Open an Account" requests) ---------------- */
const APP_LABEL = { new:'New', in_review:'In review', approved:'Approved', declined:'Declined' };
const APP_CLS = { new:'status-pending', in_review:'status-pending', approved:'status-approved', declined:'status-rejected' };
let APPS = [];
function appId(a){ return a.id || a._id; }
function injectApplicationsUI(){
  const usersItem = document.querySelector('.nav-item[data-view="users"]');
  if(usersItem && !document.querySelector('.nav-item[data-view="applications"]')){
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('data-view','applications');
    item.innerHTML = '<span class="ic"><i class="fa-solid fa-inbox"></i></span> Applications <span class="hidden" id="appBadge" style="margin-left:auto;background:var(--gold);color:var(--navy-dark);font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:100px;"></span>';
    item.addEventListener('click', ()=>nav('applications'));
    usersItem.parentNode.insertBefore(item, usersItem.nextSibling);
  }
  if(!document.getElementById('view-applications')){
    const box = document.createElement('div');
    box.id = 'view-applications'; box.className = 'hidden';
    document.getElementById('view-users').parentNode.appendChild(box);
  }
}
async function refreshAppBadge(){
  try{
    const list = await api('/admin/applications');
    const n = list.filter(a=>a.status==='new').length;
    const b = document.getElementById('appBadge');
    if(b){ b.textContent = n; b.classList.toggle('hidden', n===0); }
  }catch(e){ /* inbox not available yet */ }
}
async function renderApplications(){
  const box = document.getElementById('view-applications');
  let list = [];
  try{ list = await api('/admin/applications'); }catch(e){ box.innerHTML = '<div class="card"><div class="empty-state">Could not load applications. Make sure the server routes are installed.</div></div>'; return; }
  APPS = list.slice().sort((a,b)=>((a.status==='new'?0:1)-(b.status==='new'?0:1)) || new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  const b = document.getElementById('appBadge');
  const n = list.filter(a=>a.status==='new').length;
  if(b){ b.textContent = n; b.classList.toggle('hidden', n===0); }
  if(!APPS.length){
    box.innerHTML = '<div class="card"><div class="empty-state">No account applications yet. Requests from the website\'s "Open an Account" form will appear here.</div></div>';
    return;
  }
  box.innerHTML = `
    <div class="card">
      <div class="card-title"><i class="fa-solid fa-inbox"></i> Account Applications ${n?`<span class="pill pill-amber">${n} new</span>`:''}</div>
      ${dt([
        {l:'Applicant',w:'minmax(0,1.8fr)',cls:'first'},{l:'Account',w:'minmax(0,1.1fr)'},{l:'Deposit',w:'minmax(0,.9fr)',cls:'num'},
        {l:'Status',w:'90px'},{l:'Received',w:'minmax(0,1.3fr)'},{l:'',w:'80px',cls:'act'}
      ], APPS.map(a=>{
        const st = a.status||'new';
        return [
          `<span class="strong">${esc(a.fullName)}</span><span class="sub mono">${esc(a.email)}</span>`,
          esc(a.acctType), (a.deposit!==''&&a.deposit!=null) ? fmtUSD(Number(a.deposit)||0) : '—',
          `<span class="status-chip ${APP_CLS[st]||''}">${esc(APP_LABEL[st]||st)}</span>`,
          `<span class="muted">${fmtDate(a.date||a.createdAt)}</span>`,
          `<button class="btn btn-primary btn-sm" onclick="openApplication('${esc(appId(a))}')">View</button>`
        ];
      }))}
    </div>`;
}
function openApplication(id){
  const a = APPS.find(x=>String(appId(x))===String(id));
  if(!a) return;
  const row = (l,v)=>`<div><dt>${l}</dt><dd>${esc(v)||'—'}</dd></div>`;
  openModal(`
    <h3>${esc(a.fullName)}</h3>
    <p class="muted" style="font-size:12.5px;">Received ${fmtDate(a.date||a.createdAt)}</p>
    <dl class="detail-grid" style="margin:14px 0;">
      ${row('Account type',a.acctType)}${row('Currencies',a.currencies)}${row('Date of birth',a.dob)}${row('Nationality',a.nationality)}
      ${row('Residence',[a.address,a.city,a.postcode,a.residence].filter(Boolean).join(', '))}
      ${row('Email',a.email)}${row('Phone',a.phone)}
      ${row('Identification',a.idType?`${a.idType} · ${a.idNumber} (${a.idCountry})`:'')}
      ${row('Occupation',a.occupation+(a.employer?' · '+a.employer:''))}${row('Source of funds',a.sourceFunds)}
      ${row('Expected deposit',a.deposit?fmtUSD(Number(a.deposit)||0):'')}${a.bizReg?row('Business reg. no.',a.bizReg):''}
    </dl>
    <div class="field"><label>Status</label><select id="appStatus">${Object.keys(APP_LABEL).map(k=>`<option value="${k}" ${k===(a.status||'new')?'selected':''}>${APP_LABEL[k]}</option>`).join('')}</select></div>
    <div class="row gap-8">
      <button class="btn btn-primary btn-sm" onclick="saveAppStatus('${esc(appId(a))}')">Save status</button>
      <button class="btn btn-outline btn-sm" onclick="createFromApplication('${esc(appId(a))}')">Create client account</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
    </div>`, true);
}
async function saveAppStatus(id){
  try{
    await api('/admin/applications/'+id+'/status', { method:'POST', body:{ status:document.getElementById('appStatus').value } });
    toast('Application updated','ok'); closeModal(); await renderApplications();
  }catch(e){ toast(e.message,'err'); }
}
function pickOption(sel, text){
  if(!sel || !text) return;
  const t = String(text).toLowerCase(), first = t.split(/[\s(&]+/)[0];
  let found = [...sel.options].find(o=>o.value && o.value.toLowerCase()===t);
  if(!found && first.length>2) found = [...sel.options].find(o=>o.value && o.value.toLowerCase().includes(first));
  if(found){ sel.value = found.value; sel.dispatchEvent(new Event('change')); }
}
async function createFromApplication(id){
  const a = APPS.find(x=>String(appId(x))===String(id));
  if(!a) return;
  closeModal();
  await nav('createuser');
  const set = (i,v)=>{ const el=document.getElementById(i); if(el && v!=null) el.value=v; };
  const sel = (i,v)=>pickOption(document.getElementById(i), v);
  sel('cf_accountType',a.acctType); set('cf_legalName',a.fullName); set('cf_dateOfBirth',a.dob);
  sel('cf_nationality',a.nationality); sel('cf_residenceCountry',a.residence);
  set('cf_address',a.address); set('cf_city',a.city); set('cf_postcode',a.postcode);
  set('cf_email',a.email); set('cf_phoneNumber',a.phone);
  sel('cf_idType',a.idType); set('cf_idNumber',a.idNumber); sel('cf_idCountry',a.idCountry);
  set('cf_occupation',a.occupation); set('cf_employer',a.employer); sel('cf_sourceOfFunds',a.sourceFunds);
  set('cf_expectedDeposit',a.deposit); set('cf_businessRegNumber',a.bizReg);
  const wanted = String(a.currencies||'').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  document.querySelectorAll('input[name="cf_currency"]').forEach(c=>{ c.checked = wanted.includes(c.value.toUpperCase()); });
  toast('Form pre-filled from the application — review, tick consent and submit','ok');
  window.scrollTo(0,0);
}
setInterval(refreshAppBadge, 30000);

(async function init(){
  injectApplicationsUI();
  REF = await api('/admin/reference');
  await nav('overview');
})();