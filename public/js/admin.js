if (!Session.token || Session.role !== 'admin') {
  window.location.href = '/admin-login.html';
}

let REF = { coins: {}, gasCoin: {}, networkFee: {} };
let currentView = null;
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
  if(t.type==='credit') return t.coin ? 'Deposit (Admin Credit)' : 'Deposit (USD)';
  if(t.type==='withdraw_bank') return 'Withdraw to Bank';
  if(t.type==='withdraw_crypto') return 'Withdraw to Crypto';
  if(t.type==='swap') return 'Swap';
  return t.type;
}
function txAmountLabel(t){
  if(t.type==='withdraw_bank') return fmtUSD(t.usdAmount);
  if(t.type==='withdraw_crypto') return fmtCoin(t.amount)+' '+t.coin+' ('+t.network+')';
  if(t.type==='swap') return t.toCoin
    ? fmtCoin(t.amount)+' '+t.coin+' ('+t.network+') → '+fmtCoin(t.toAmount)+' '+t.toCoin+' ('+t.toNetwork+')'
    : fmtCoin(t.amount)+' '+t.coin+' → '+fmtUSD(t.usdAmount);
  if(t.type==='credit') return t.coin ? '+'+fmtCoin(t.amount)+' '+t.coin+' ('+t.network+')' : '+'+fmtUSD(t.usdAmount);
  return '—';
}
function openModal(html){
  document.getElementById('modalRoot').innerHTML = `<div class="modal-overlay" id="ov"><div class="modal">${html}</div></div>`;
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
  ['overview','createuser','users','edituser','deposits','support','withdrawals'].forEach(v=>document.getElementById('view-'+v).classList.toggle('hidden', v!==view));
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
  await refreshBadge();
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
  const [users, allTx] = await Promise.all([api('/admin/users'), api('/admin/transactions')]);
  const totalUSD = users.reduce((a,u)=>a+u.usdBalance,0);
  const totalCrypto = users.reduce((a,u)=>a+Object.values(u.holdings).reduce((s,h)=>s+h.balance*(REF.coins[h.coin]?.price||0),0),0);
  const pending = allTx.filter(t=>t.status==='pending').length;
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
    <div class="grid-3" style="margin-bottom:20px;">
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
      ${feed.length ? `<table><thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>When</th></tr></thead><tbody>${
        feed.map(t=>`<tr><td>${t.user?.name||'—'}<div class="mono">@${t.user?.username||''}</div></td><td>${txTypeLabel(t)}</td><td>${txAmountLabel(t)}</td><td><span class="status-chip status-${t.status}">${t.status}</span></td><td class="muted">${fmtDate(t.createdAt)}</td></tr>`).join('')
      }</tbody></table>` : '<div class="empty-state">No activity yet. Create a user and credit a balance to get started.</div>'}
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
  const picked = v.preferredCurrencies || [];
  const isBiz = (o.businessAccountTypes||[]).includes(v.accountType);
  return `
    <div class="form-section">
      <h3><i class="fa-solid fa-id-badge"></i> Account</h3>
      <div class="field"><label for="cf_accountType">Account type</label>${selectHTML('cf_accountType', o.accountTypes, v.accountType||'', 'Select account type…')}</div>
      <div class="field"><label>Preferred currencies <span class="muted" style="font-weight:500;">(choose at least one)</span></label>
        <div class="group-label">Fiat</div><div class="chip-group">${chipsHTML(o.fiatCurrencies, picked)}</div>
        <div class="group-label">Digital</div><div class="chip-group">${chipsHTML(Object.keys(REF.coins), picked)}</div>
      </div>
    </div>

    <div class="form-section">
      <h3><i class="fa-solid fa-user"></i> Personal details</h3>
      <div class="two-col">
        ${inputHTML('cf_legalName','Legal name (as on ID)', v.name, { placeholder:'e.g. Winifred Anne Eagle' })}
        ${inputHTML('cf_dateOfBirth','Date of birth', v.dateOfBirth, { type:'date' })}
        <div class="field"><label for="cf_nationality">Nationality</label>${selectHTML('cf_nationality', COUNTRIES, v.nationality||'', 'Select…')}</div>
        <div class="field"><label for="cf_residenceCountry">Country of residence</label>${selectHTML('cf_residenceCountry', COUNTRIES, v.country||'', 'Select…')}</div>
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
        <div class="field"><label for="cf_idCountry">Country of issue</label>${selectHTML('cf_idCountry', COUNTRIES, v.idCountry||'', 'Select…')}</div>
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
  try{
    const { credentials } = await api('/admin/users', { method:'POST', body:data });
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
      <table>
        <thead><tr><th>Name</th><th>Username</th><th>USD Balance</th><th>Crypto Value</th><th></th></tr></thead>
        <tbody>
        ${users.map(u=>{
          const cryptoVal = Object.values(u.holdings).reduce((s,h)=>s+h.balance*(REF.coins[h.coin]?.price||0),0);
          return `<tr>
            <td>${u.name}<div class="mono">${u.email}</div>${u.accountType?`<span class="pill pill-purple" style="margin-top:4px;padding:2px 9px;font-size:11px;">${u.accountType}</span>`:''}</td>
            <td class="mono">@${u.username}</td>
            <td>${fmtUSD(u.usdBalance)}</td>
            <td>${fmtUSD(cryptoVal)}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button class="btn btn-primary btn-sm" onclick="openUserDashboard('${u.id}')" title="Open this user's dashboard"><i class="fa-solid fa-arrow-up-right-from-square"></i> Dashboard</button>
              <button class="btn btn-outline btn-sm" onclick="openManageUser('${u.id}')">Manage</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openManageUser(userId){
  const u = await api('/admin/users/'+userId);
  const holdingsRows = Object.values(u.holdings).map(h=>`
    <div class="list-row">
      <div class="row gap-8">
        ${coinIconHTML(h.coin, 30)}
        <div>
          <div style="font-weight:600;">${h.coin} <span class="muted" style="font-weight:500;">· ${h.network}</span></div>
          <div class="mono">${fmtCoin(h.balance)} ${h.coin} ≈ ${fmtUSD(h.balance*(REF.coins[h.coin]?.price||0))}</div>
        </div>
      </div>
      <div class="row gap-8">
        <input type="number" step="any" id="editBal_${h.coin}_${h.network}" value="${h.balance}" style="width:100px;background:var(--bg-soft);border:1px solid var(--border-solid);color:var(--text);padding:7px 9px;border-radius:7px;font-size:13px;">
        <button class="btn btn-outline btn-sm" onclick="setHoldingBalance('${u.id}','${h.coin}','${h.network}')">Set</button>
      </div>
    </div>`).join('') || '<div class="empty-state" style="padding:16px;">No crypto credited yet.</div>';

  const coinOptions = Object.keys(REF.coins).map(c=>`<option value="${c}">${c} — ${REF.coins[c].name}</option>`).join('');
  const countryOptions = COUNTRIES.map(c=>`<option value="${c}" ${c===u.country?'selected':''}>${c}</option>`).join('');

  openModal(`
    <h3>Manage: ${u.name}</h3>
    <p class="muted mono" style="font-size:12.5px;margin-top:-4px;">@${u.username} · ${u.email}</p>
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
      </div>

      <div id="creditPane_usd">
        <div class="field"><label>Amount to Add (USD)</label><input type="number" step="0.01" id="usdCreditAmount" placeholder="e.g. 500.00"></div>
        <button class="btn btn-primary btn-block btn-sm" onclick="creditUsd('${u.id}')">Credit USD (logged as a deposit)</button>
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
      <div class="row gap-8">
        <input type="number" step="0.01" id="usdEdit" value="${u.usdBalance}" style="flex:1;background:var(--panel);border:1px solid var(--border-solid);color:var(--text);padding:9px 11px;border-radius:8px;">
        <button class="btn btn-outline btn-sm" onclick="setUsdBalance('${u.id}')">Override (no history entry)</button>
      </div>
    </div>

    <div class="card" style="padding:16px;background:var(--bg-soft);">
      <div class="card-title" style="font-size:13.5px;margin-bottom:6px;"><i class="fa-solid fa-coins"></i> Existing Holdings</div>
      ${holdingsRows}
    </div>

    <button class="btn btn-outline btn-block" style="margin-top:16px;" onclick="closeModal()">Close</button>
  `);
  refreshCreditNetworks();
}
function setCreditType(type){
  document.getElementById('creditTab_usd').classList.toggle('active', type==='usd');
  document.getElementById('creditTab_crypto').classList.toggle('active', type==='crypto');
  document.getElementById('creditPane_usd').classList.toggle('hidden', type!=='usd');
  document.getElementById('creditPane_crypto').classList.toggle('hidden', type!=='crypto');
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
  const coinOptions = Object.keys(REF.coins).map(c=>`<option value="${c}">${c} — ${REF.coins[c].name}</option>`).join('');

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
      ${addresses.length ? `<table><thead><tr><th>Coin</th><th>Network</th><th>Address</th><th></th></tr></thead><tbody>${
        addresses.map(a=>`<tr>
          <td>${a.coin}</td><td>${a.network}</td>
          <td class="mono">${shortAddr(a.address)}</td>
          <td style="text-align:right;"><button class="btn btn-danger btn-sm" onclick="deleteDepositAddress('${a._id}')">Remove</button></td>
        </tr>`).join('')
      }</tbody></table>` : '<div class="empty-state">No deposit addresses configured yet. Users will see "not yet configured" until you add one per coin/network.</div>'}
    </div>
  `;
  refreshDaNetworks();
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

/* ---------------- Support Settings (contact info shown to users) ---------------- */
async function renderSupportSettings(){
  const settings = await api('/admin/support-settings');
  document.getElementById('view-support').innerHTML = `
    <div class="card" style="max-width:480px;">
      <div class="card-title"><i class="fa-solid fa-headset"></i> Support Contact Details</div>
      <p class="muted" style="font-size:13px;margin-top:-8px;">These are shown to every user on their Support page, with clickable email and WhatsApp buttons.</p>
      <div class="field"><label>Support Email</label><input id="suppEmail" value="${settings.email||''}" placeholder="support@example.com"></div>
      <div class="field"><label>WhatsApp Number</label><input id="suppWhatsapp" value="${settings.whatsapp||''}" placeholder="+1 555 123 4567"></div>
      <button class="btn btn-primary btn-block" onclick="saveSupportSettings()">Save Contact Details</button>
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
      <table>
        <thead><tr><th>User</th><th>Type</th><th>Details</th><th>Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${rows.map(t=>{
          let details = '';
          if(t.type==='withdraw_bank'){
            const b=t.bankDetails||{};
            details = `${b.bankName||''}<br><span class="mono">${b.accountNumber||''}</span><br>${b.accountName||''}`;
          } else {
            details = `${t.coin} · ${t.network}<br><span class="mono">${shortAddr(t.walletAddress)}</span>`;
          }
          let actions = '';
          if(t.status==='pending'){
            actions = `<button class="btn btn-primary btn-sm" onclick="approveWithdrawal('${t._id}')"><i class="fa-solid fa-check"></i> Approve</button>
                       <button class="btn btn-danger btn-sm" onclick="openRejectModal('${t._id}')"><i class="fa-solid fa-xmark"></i> Reject</button>`;
          } else if(t.status==='rejected'){
            actions = `<span class="mono" style="font-size:11.5px;">${(t.rejectionReason||'').slice(0,40)}</span>`;
          } else {
            actions = '<span class="muted" style="font-size:12px;">Resolved</span>';
          }
          return `<tr>
            <td>${t.user?.name||'—'}<div class="mono">@${t.user?.username||''}</div></td>
            <td>${txTypeLabel(t)}</td>
            <td style="font-size:12.5px;">${details}</td>
            <td>${txAmountLabel(t)}</td>
            <td><span class="status-chip status-${t.status}">${t.status}</span></td>
            <td style="text-align:right;">${actions}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
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

(async function init(){
  REF = await api('/admin/reference');
  await nav('overview');
})();
