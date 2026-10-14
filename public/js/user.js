// Admin "open user dashboard" tab: token arrives in the URL hash, is moved into
// this tab's own sessionStorage (admin's normal login is left untouched).
(function(){
  if (location.hash.startsWith('#imp=')) {
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('imp');
    if (token) Session.setImpersonation(token, params.get('name') || '');
    history.replaceState(null, '', location.pathname);
  }
})();
if (!Session.token || Session.role !== 'user') {
  window.location.href = Session.impersonating ? '/admin.html' : '/login.html';
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
function txTypeLabel(t){
  if(t.type==='credit') return t.coin ? 'Deposit' : 'Deposit (USD)';
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
function esc(x){ const d=document.createElement('div'); d.textContent=(x==null?'':String(x)); return d.innerHTML; }
function txAmountParts(t){
  if(t.type==='withdraw_bank') return { main: fmtUSD(t.usdAmount), sub:'' };
  if(t.type==='withdraw_crypto') return { main: fmtCoin(t.amount)+' '+t.coin, sub:t.network };
  if(t.type==='swap') return t.toCoin
    ? { main: fmtCoin(t.amount)+' '+t.coin+' → '+fmtCoin(t.toAmount)+' '+t.toCoin, sub:t.network+' → '+t.toNetwork }
    : { main: fmtCoin(t.amount)+' '+t.coin+' → '+fmtUSD(t.usdAmount), sub:t.network };
  if(t.type==='credit') return t.coin ? { main:'+'+fmtCoin(t.amount)+' '+t.coin, sub:t.network } : { main:'+'+fmtUSD(t.usdAmount), sub:'' };
  return { main:'—', sub:'' };
}
function txRowHTML(t){
  const p = txAmountParts(t);
  return `<div class="tx">
    <div class="m"><div class="t">${txTypeLabel(t)}</div><div class="d">${fmtDate(t.createdAt)}</div></div>
    <div class="a">${p.main}${p.sub?`<small>${p.sub}</small>`:''}</div>
    <div class="s"><span class="status-chip status-${t.status}">${t.status}</span></div>
    ${t.status==='rejected' ? `<div class="why reject-banner"><b>Rejected:</b> ${esc(t.rejectionReason)}</div>` : ''}
  </div>`;
}
function openModal(html){
  document.getElementById('modalRoot').innerHTML = `<div class="modal-overlay" id="ov"><div class="modal">${html}</div></div>`;
  document.getElementById('ov').addEventListener('click', e=>{ if(e.target.id==='ov') closeModal(); });
}
function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }
function logout(){
  if (Session.impersonating) {
    sessionStorage.clear();
    window.close();
    setTimeout(()=>{ window.location.href = '/admin.html'; }, 200);
    return;
  }
  Session.clear(); window.location.href='/login.html';
}
function toggleSidebar(open){
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('scrim').classList.toggle('hidden', !open);
}
function copyText(text, btnEl){
  navigator.clipboard.writeText(text).then(()=>{
    toast('Address copied to clipboard','ok');
    if(btnEl){ const orig = btnEl.innerHTML; btnEl.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(()=>btnEl.innerHTML = orig, 1400); }
  }).catch(()=> toast('Could not copy — select and copy manually','err'));
}

async function nav(view){
  currentView = view;
  ['dashboard','wallet','account','transactions','deposit','withdraw','buy','kyc','support','loans'].forEach(v=>{
    const el = document.getElementById('view-'+v);
    if(el) el.classList.toggle('hidden', v!==view);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active', el.dataset.view===view));
  toggleSidebar(false);
  // dashboard / kyc / support / loans go through window.* so the extra scripts
  // (user-loans-kyc.js, user-support-ai.js) can replace them after this file loads
  const fns = { dashboard:()=>window.renderDashboard(), wallet:renderWallet, account:renderAccount, transactions:renderTransactions,
    deposit:renderDeposit, withdraw:renderWithdraw, buy:renderBuy, kyc:()=>window.renderKyc(), support:()=>window.renderSupport(),
    loans:()=>window.renderLoans() };
  await fns[view]();
  await refreshNotifBadge();
}
setInterval(()=>{ if(currentView==='dashboard') window.renderDashboard(); }, 30000);

async function refreshNotifBadge(){
  const txs = await api('/user/transactions');
  const unseen = txs.filter(t=>t.status==='rejected' && !t.seenByUser).length;
  const badge = document.getElementById('notifBadge');
  if(unseen>0){ badge.textContent = unseen; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

function cryptoTotalUSD(u){ return Object.values(u.holdings).reduce((s,h)=>s+h.balance*(REF.coins[h.coin]?.price||0),0); }

async function renderDashboard(){
  REF = await api('/user/reference');
  const u = await api('/user/me');
  const txs = await api('/user/transactions');
  const cryptoVal = cryptoTotalUSD(u);
  const holdings = Object.values(u.holdings).filter(h=>h.balance>0);
  const unseenRejections = txs.filter(t=>t.status==='rejected' && !t.seenByUser);

  const notifHtml = unseenRejections.length ? `
    <div class="card" style="border-color:#f2c9d0;background:#fdf2f4;margin-bottom:18px;">
      <div class="card-title" style="color:#b4233a;"><i class="fa-solid fa-triangle-exclamation"></i> ${unseenRejections.length} Transaction${unseenRejections.length>1?'s':''} Rejected</div>
      ${unseenRejections.map(t=>`
        <div class="reject-banner" style="margin-bottom:8px;">
          <b>${txTypeLabel(t)} · ${txAmountLabel(t)} · ${fmtDate(t.createdAt)}:</b> ${t.rejectionReason}
        </div>
      `).join('')}
      <button class="btn btn-outline btn-sm" onclick="dismissAllNotifications()">Dismiss</button>
    </div>
  ` : '';

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

  const holdingsHtml = holdings.length ? holdings.map(h=>`
    <div class="holding-row">
      <div class="row gap-12">${coinIconHTML(h.coin,34)}
        <div><div style="font-weight:600;">${h.coin}</div><div class="coin-meta">${h.network}</div></div></div>
      <div style="text-align:right;">
        <div class="mono" style="color:var(--text);">${fmtCoin(h.balance)}</div>
        <div style="font-size:12px;color:var(--cyan);">${fmtUSD(h.balance*REF.coins[h.coin].price)}</div>
      </div>
    </div>`).join('') : '<div class="empty-state">No crypto assets yet. Your administrator will credit your account.</div>';

  const recent = txs.slice(0,5);
  const txHtml = recent.length ? recent.map(txRowHTML).join('') : '<div class="empty-state">No transactions yet.</div>';

  const donut = buildDonutSVG(holdings, u.usdBalance);

  document.getElementById('view-dashboard').innerHTML = `
    ${notifHtml}
    <div class="card">
      <div class="hero-balance">
        <div class="amt">${fmtUSD(cryptoVal + u.usdBalance)}</div>
        <div class="lbl">Total Account Value</div>
      </div>
      <div class="grid-2" style="margin-top:18px;">
        <div class="market-tile" style="justify-content:space-between;"><div><div class="coin-meta">Crypto Holdings</div><div style="font-weight:700;">${fmtUSD(cryptoVal)}</div></div><div style="font-size:20px;color:var(--cyan);"><i class="fa-solid fa-coins"></i></div></div>
        <div class="market-tile" style="justify-content:space-between;"><div><div class="coin-meta">USD Balance</div><div style="font-weight:700;color:var(--green);">${fmtUSD(u.usdBalance)}</div></div><div style="font-size:20px;color:var(--green);"><i class="fa-solid fa-dollar-sign"></i></div></div>
      </div>
      <div style="margin-top:18px;">${holdingsHtml}</div>
    </div>

    <div class="section-label">Market Overview</div>
    <div class="card"><div class="card-title"><i class="fa-solid fa-chart-line"></i> All Coins ${liveAny ? '<span class="pill pill-cyan"><span class="badge-dot"></span> Live</span>' : '<span class="pill pill-amber">Offline prices</span>'}</div><div class="grid-2">${marketHtml}</div></div>

    <div class="section-label">Quick Actions</div>
    <div class="grid-3">
      <div class="qa-tile" onclick="nav('deposit')"><div class="ic"><i class="fa-solid fa-arrow-down"></i></div><div class="lbl">Deposit</div></div>
      <div class="qa-tile" onclick="nav('withdraw')"><div class="ic"><i class="fa-solid fa-arrow-up"></i></div><div class="lbl">Withdraw</div></div>
      <div class="qa-tile" onclick="nav('transactions')"><div class="ic"><i class="fa-solid fa-file-invoice"></i></div><div class="lbl">Transactions</div></div>
      <div class="qa-tile" onclick="nav('wallet')"><div class="ic"><i class="fa-solid fa-right-left"></i></div><div class="lbl">Swap</div></div>
      <div class="qa-tile" onclick="nav('buy')"><div class="ic"><i class="fa-solid fa-cart-shopping"></i></div><div class="lbl">Buy Crypto</div></div>
      <div class="qa-tile" onclick="nav('account')"><div class="ic"><i class="fa-solid fa-user"></i></div><div class="lbl">My Account</div></div>
    </div>

    <div class="section-label">Recent Transactions</div>
    <div class="card">${txHtml}</div>

    <div class="section-label">Portfolio Overview</div>
    <div class="card">${donut}</div>
  `;
}
async function dismissAllNotifications(){
  try{
    await api('/user/transactions/mark-all-seen', { method:'POST' });
    await window.renderDashboard();
    await refreshNotifBadge();
  }catch(e){ toast(e.message,'err'); }
}

function buildDonutSVG(holdings, usdBalance){
  const cryptoVal = holdings.reduce((s,h)=>s+h.balance*REF.coins[h.coin].price,0);
  const total = cryptoVal + usdBalance;
  if(total<=0) return '<div class="empty-state">Nothing to show yet.</div>';
  let segments = holdings.map(h=>({label:h.coin, value:h.balance*REF.coins[h.coin].price, color:COIN_COLORS[h.coin]}));
  if(usdBalance>0) segments.push({label:'USD', value:usdBalance, color:'#0b2545'});
  segments = segments.filter(s=>s.value>0);
  let acc=0;
  const stops = segments.map(s=>{
    const start = acc/total*360; acc += s.value; const end = acc/total*360;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(', ');
  const legend = segments.map(s=>`<div class="legend-row"><span class="legend-sw" style="background:${s.color};"></span>${s.label} · ${((s.value/total)*100).toFixed(1)}%</div>`).join('');
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops});"></div><div class="legend">${legend}</div></div>`;
}

async function renderWallet(){
  const u = await api('/user/me');
  const holdings = Object.values(u.holdings);
  document.getElementById('view-wallet').innerHTML = `
    <div class="card">
      <div class="card-title"><i class="fa-solid fa-wallet"></i> Your Wallet</div>
      <div class="holding-row">
        <div class="row gap-12"><div class="coin-ic" style="background:#0b254514;color:#0b2545;"><i class="fa-solid fa-dollar-sign"></i></div><div><div style="font-weight:600;">USD Balance</div><div class="coin-meta">Cash — used for bank withdrawals</div></div></div>
        <div style="font-weight:700;color:var(--green);">${fmtUSD(u.usdBalance)}</div>
      </div>
      ${holdings.length ? holdings.map(h=>`
        <div class="holding-row">
          <div class="row gap-12">${coinIconHTML(h.coin,34)}
            <div><div style="font-weight:600;">${h.coin}</div><div class="coin-meta">${h.network}</div></div></div>
          <div class="row gap-8">
            <div style="text-align:right;margin-right:6px;"><div class="mono">${fmtCoin(h.balance)}</div><div style="font-size:12px;color:var(--cyan);">${fmtUSD(h.balance*REF.coins[h.coin].price)}</div></div>
            <button class="btn btn-primary btn-sm" onclick="openSwapModal('${h.coin}','${h.network}')"><i class="fa-solid fa-right-left"></i> Swap</button>
          </div>
        </div>`).join('') : '<div class="empty-state">No crypto assets yet.</div>'}
    </div>
  `;
}

async function openSwapModal(coin, network){
  REF = await api('/user/reference');
  const u = await api('/user/me');
  const h = u.holdings[`${coin}_${network}`];
  const gasCoin = REF.gasCoin[network];
  const fee = REF.networkFee[network] || 0;
  const gasBal = gasCoin && u.holdings[`${gasCoin}_${network}`] ? u.holdings[`${gasCoin}_${network}`].balance : 0;
  const sameHolding = gasCoin === coin;
  // Blocked outright when the wallet has no (or too little) fee coin
  const gasOk = !gasCoin || fee <= 0 || (sameHolding ? h.balance > fee : gasBal >= fee);
  const gasMsg = !gasCoin || fee <= 0 ? ''
    : gasOk
      ? `Network fee: ${fee} ${gasCoin} is deducted from your ${gasCoin} (${network}) balance.`
      : `${gasCoin} needed before swapping can work. You need at least ${fee} ${gasCoin} on ${network} to cover the network fee, but you currently have ${fmtCoin(gasBal)}.`;

  // Destination choices: USD cash, or any other listed coin/network
  const destOptions = ['<option value="USD">USD — cash balance</option>'];
  for (const c of Object.keys(REF.coins)) {
    for (const n of REF.coins[c].networks) {
      if (c === coin && n === network) continue;
      destOptions.push(`<option value="${c}|${n}">${c} — ${REF.coins[c].name} · ${n}</option>`);
    }
  }

  openModal(`
    <h3>Swap ${coin} <span class="muted" style="font-weight:500;font-size:14px;">· ${network}</span></h3>
    <p class="muted" style="font-size:13px;">Available: ${fmtCoin(h.balance)} ${coin} ≈ ${fmtUSD(h.balance*REF.coins[coin].price)}</p>
    ${gasOk ? '' : `<div class="warn-box"><i class="fa-solid fa-triangle-exclamation"></i> ${gasMsg}</div>`}
    ${gasOk ? `
      <div class="field"><label>Swap to</label><select id="swapDest" onchange="updateSwapEstimate('${coin}')">${destOptions.join('')}</select></div>
      <div class="field"><label>Amount to swap (${coin})</label><input type="number" id="swapAmount" step="any" min="0" max="${h.balance}" placeholder="0.00" oninput="updateSwapEstimate('${coin}')"></div>
      <div id="swapEstimate" class="creds-box" style="margin-top:0;padding:12px;font-size:13px;">Enter an amount to see what you'll receive.</div>
      ${gasMsg ? `<div class="hint" style="margin-top:8px;">${gasMsg}</div>` : ''}
      <div class="row gap-8" style="margin-top:14px;">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('swapAmount').value='${h.balance}';updateSwapEstimate('${coin}')">Max</button>
        <button class="btn btn-primary btn-block" onclick="doSwap('${coin}','${network}')">Confirm Swap</button>
      </div>` :
    `<button class="btn btn-outline btn-block" style="margin-top:6px;" onclick="closeModal()">Close</button>`}
  `);
}
function updateSwapEstimate(coin){
  const box = document.getElementById('swapEstimate');
  const amount = parseFloat(document.getElementById('swapAmount').value);
  const dest = document.getElementById('swapDest').value;
  if(!amount || amount<=0){ box.textContent = "Enter an amount to see what you'll receive."; return; }
  const usdValue = amount * REF.coins[coin].price;
  if(dest === 'USD'){
    box.innerHTML = `You'll receive about <b style="color:var(--green);">${fmtUSD(usdValue)}</b> in your USD balance.`;
  } else {
    const [toCoin, toNet] = dest.split('|');
    const received = usdValue / REF.coins[toCoin].price;
    box.innerHTML = `You'll receive about <b style="color:var(--cyan);">${fmtCoin(received)} ${toCoin}</b> <span class="muted">(${toNet})</span> at the current market rate.`;
  }
}
async function doSwap(coin, network){
  const amount = parseFloat(document.getElementById('swapAmount').value);
  if(!amount || amount<=0){ toast('Enter a valid amount','err'); return; }
  const dest = document.getElementById('swapDest').value;
  const body = { coin, network, amount };
  if(dest !== 'USD'){ const [toCoin, toNetwork] = dest.split('|'); body.toCoin = toCoin; body.toNetwork = toNetwork; }
  try{
    const { transaction } = await api('/user/swap', { method:'POST', body });
    closeModal();
    toast(transaction.toCoin
      ? `Swapped ${amount} ${coin} for ${fmtCoin(transaction.toAmount)} ${transaction.toCoin}`
      : `Swapped ${amount} ${coin} for ${fmtUSD(transaction.usdAmount)}`, 'ok');
    await renderWallet();
    await refreshNotifBadge();
  }catch(e){ toast(e.message,'err'); }
}

async function renderAccount(){
  const u = await api('/user/me');
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value || '—'}</dd></div>`;
  document.getElementById('view-account').innerHTML = `
    <div class="card" style="max-width:720px;margin-bottom:18px;">
      <div class="card-title"><i class="fa-solid fa-user"></i> My Account</div>
      <dl class="detail-grid">
        ${row('Account holder', u.name)}
        ${row('Account type', u.accountType)}
        ${row('Username', u.username)}
        ${row('Preferred currencies', (u.preferredCurrencies||[]).join(', '))}
        ${row('Date of birth', u.dateOfBirth)}
        ${row('Nationality', u.nationality)}
        ${row('Address', [u.address, u.city, u.postcode, u.country].filter(Boolean).join(', '))}
        ${row('Email', u.email)}
        ${row('Identification', u.idType ? `${u.idType} · ${u.idNumberMasked}` : '')}
      </dl>
      <div class="hint" style="margin-top:8px;">To change any of these details, please contact support.</div>
    </div>

    <div class="card" style="max-width:720px;">
      <div class="card-title"><i class="fa-solid fa-phone"></i> Contact Number</div>
      <div class="field"><label>Phone number</label><input id="accPhone" value="${(u.phoneNumber||'').replace(/"/g,'&quot;')}"></div>
      <button class="btn btn-primary" onclick="saveOwnPhone()">Update Number</button>
    </div>
  `;
}
async function saveOwnPhone(){
  const phoneNumber = document.getElementById('accPhone').value.trim();
  if(!phoneNumber){ toast('Enter your phone number','err'); return; }
  try{
    await api('/user/profile', { method:'PUT', body:{ phoneNumber } });
    toast('Contact number updated','ok');
  }catch(e){ toast(e.message,'err'); }
}

async function renderTransactions(){
  const txs = await api('/user/transactions');
  document.getElementById('view-transactions').innerHTML = `
    <div class="card">
      <div class="card-title"><i class="fa-solid fa-file-invoice"></i> Transaction History</div>
      ${txs.length ? txs.map(txRowHTML).join('') : '<div class="empty-state">No transactions yet.</div>'}
    </div>
  `;
  // Viewing the transactions page dismisses the rejection notifications.
  const unseenIds = txs.filter(t=>t.status==='rejected' && !t.seenByUser).map(t=>t._id);
  if(unseenIds.length){
    try{ await api('/user/transactions/mark-all-seen', { method:'POST' }); await refreshNotifBadge(); }catch(e){ /* non-critical */ }
  }
}

async function renderDeposit(){
  const addresses = await api('/user/deposit-addresses');
  const coinOptions = Object.keys(REF.coins).map(c=>`<option value="${c}">${c} — ${REF.coins[c].name}</option>`).join('');
  document.getElementById('view-deposit').innerHTML = `
    <div class="card" style="max-width:520px;">
      <div class="card-title"><i class="fa-solid fa-arrow-down"></i> Deposit</div>
      <p class="muted" style="font-size:13px;">Select a coin and network to deposit.</p>
      <div class="field"><label>Coin</label><select id="depCoin" onchange="refreshDepNetworks()">${coinOptions}</select></div>
      <div class="field"><label>Network</label><select id="depNetwork"></select></div>
      <div id="depAddressBox"></div>
    </div>
  `;
  window._depAddresses = addresses;
  refreshDepNetworks();
}
function refreshDepNetworks(){
  const coin = document.getElementById('depCoin').value;
  const sel = document.getElementById('depNetwork');
  sel.innerHTML = REF.coins[coin].networks.map(n=>`<option value="${n}">${n}</option>`).join('');
  sel.onchange = refreshDepAddress;
  refreshDepAddress();
}
function refreshDepAddress(){
  const coin = document.getElementById('depCoin').value;
  const network = document.getElementById('depNetwork').value;
  const match = (window._depAddresses||[]).find(a=>a.coin===coin && a.network===network);
  const box = document.getElementById('depAddressBox');
  if(match){
    box.innerHTML = `
      <div class="creds-box">
        <div class="coin-meta" style="margin-bottom:8px;">Send ${coin} (${network}) only to this address:</div>
        <div class="row gap-8" style="justify-content:space-between;">
          <div class="mono" style="word-break:break-all;color:var(--cyan);flex:1;">${match.address}</div>
          <button class="btn btn-outline btn-sm" onclick="copyText('${match.address}', this)"><i class="fa-solid fa-copy"></i></button>
        </div>
        <div class="hint" style="margin-top:10px;">Notify your administrator after sending so they can credit your balance.</div>
      </div>
    `;
  } else {
    box.innerHTML = `<div class="warn-box"><i class="fa-solid fa-triangle-exclamation"></i> No deposit address has been configured yet for ${coin} on ${network}.</div>`;
  }
}

async function renderWithdraw(){
  document.getElementById('view-withdraw').innerHTML = `
    <div class="card-title" style="margin-bottom:14px;"><i class="fa-solid fa-arrow-up"></i> Withdraw</div>
    <div class="grid-2">
      <div class="choice-card" onclick="showWithdrawForm('bank')"><div class="ic"><i class="fa-solid fa-building-columns"></i></div><h4>Withdraw to Bank</h4><p>Send your USD balance to a bank account. Requires a USD balance — swap crypto first if needed.</p></div>
      <div class="choice-card" onclick="showWithdrawForm('crypto')"><div class="ic"><i class="fa-solid fa-coins"></i></div><h4>Withdraw to Crypto</h4><p>Send a crypto asset to an external wallet address. Requires the network's gas coin.</p></div>
    </div>
    <div id="withdrawFormArea" style="margin-top:20px;"></div>
  `;
}
async function showWithdrawForm(kind){
  const u = await api('/user/me');
  const area = document.getElementById('withdrawFormArea');
  if(kind==='bank'){
    area.innerHTML = `
      <div class="card" style="max-width:480px;">
        <div class="card-title"><i class="fa-solid fa-building-columns"></i> Withdraw to Bank</div>
        <div class="hint" style="margin-bottom:14px;">Available USD balance: <b style="color:var(--green);">${fmtUSD(u.usdBalance)}</b>${u.usdBalance<=0 ? ' — swap some crypto to USD first (see the Wallet page).' : ''}</div>
        <div class="field"><label>Bank Name</label><input id="wbBank" placeholder="e.g. Chase Bank"></div>
        <div class="field"><label>Account Holder Name</label><input id="wbName" placeholder="Full name on the account"></div>
        <div class="field"><label>Account Number</label><input id="wbAcct" placeholder="Account number"></div>
        <div class="field"><label>Routing / SWIFT Code</label><input id="wbRouting" placeholder="Routing or SWIFT/BIC code"></div>
        <div class="field"><label>Amount (USD)</label><input id="wbAmount" type="number" step="0.01" min="0" max="${u.usdBalance}" placeholder="0.00"></div>
        <button class="btn btn-primary btn-block" onclick="submitBankWithdraw()">Submit Withdrawal Request</button>
      </div>
    `;
  } else {
    const holdings = Object.values(u.holdings).filter(h=>h.balance>0);
    const opts = holdings.map(h=>`<option value="${h.coin}_${h.network}">${h.coin} · ${h.network} (${fmtCoin(h.balance)} available)</option>`).join('');
    area.innerHTML = `
      <div class="card" style="max-width:480px;">
        <div class="card-title"><i class="fa-solid fa-coins"></i> Withdraw to Crypto</div>
        ${holdings.length===0 ? '<div class="empty-state">You have no crypto balances to withdraw.</div>' : `
        <div class="field"><label>Coin &amp; Network</label><select id="wcHolding" onchange="updateWcGasNote()">${opts}</select></div>
        <div id="wcGasNote" class="hint" style="margin-bottom:14px;"></div>
        <div class="field"><label>Destination Wallet Address</label><input id="wcAddress" placeholder="Paste the recipient wallet address"></div>
        <div class="field"><label>Amount</label><input id="wcAmount" type="number" step="any" min="0" placeholder="0.00"></div>
        <button class="btn btn-primary btn-block" id="wcSubmitBtn" onclick="submitCryptoWithdraw()">Submit Withdrawal Request</button>
        `}
      </div>
    `;
    if(holdings.length){ window._wcUser = u; updateWcGasNote(); }
  }
}
function updateWcGasNote(){
  const u = window._wcUser;
  const [coin,network] = document.getElementById('wcHolding').value.split('_');
  const gasCoin = REF.gasCoin[network];
  const fee = REF.networkFee[network]||0;
  const note = document.getElementById('wcGasNote');
  const btn = document.getElementById('wcSubmitBtn');
  if(!gasCoin){ note.innerHTML = `${network} is a native network — no separate gas coin required.`; btn.disabled=false; return; }
  const gasBal = u.holdings[`${gasCoin}_${network}`] ? u.holdings[`${gasCoin}_${network}`].balance : 0;
  if(gasBal >= fee){ note.innerHTML = `Network fee: ${fee} ${gasCoin} will be deducted from your ${gasCoin} balance on ${network}.`; btn.disabled=false; }
  else { note.innerHTML = `<span style="color:var(--amber);"><i class="fa-solid fa-triangle-exclamation"></i> ${gasCoin} needed before withdrawal can work. You need at least ${fee} ${gasCoin} on ${network} (you have ${fmtCoin(gasBal)}).</span>`; btn.disabled=true; }
}
async function submitBankWithdraw(){
  const amount = parseFloat(document.getElementById('wbAmount').value);
  const bankDetails = {
    bankName: document.getElementById('wbBank').value.trim(),
    accountName: document.getElementById('wbName').value.trim(),
    accountNumber: document.getElementById('wbAcct').value.trim(),
    routing: document.getElementById('wbRouting').value.trim()
  };
  if(!bankDetails.bankName || !bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.routing){ toast('Please fill in all bank details','err'); return; }
  if(!amount || amount<=0){ toast('Enter a valid amount','err'); return; }
  try{
    await api('/user/withdraw/bank', { method:'POST', body:{ amount, bankDetails } });
    toast('Withdrawal request submitted for admin review','ok');
    await nav('transactions');
  }catch(e){ toast(e.message,'err'); }
}
async function submitCryptoWithdraw(){
  const [coin,network] = document.getElementById('wcHolding').value.split('_');
  const walletAddress = document.getElementById('wcAddress').value.trim();
  const amount = parseFloat(document.getElementById('wcAmount').value);
  if(!walletAddress){ toast('Enter a destination wallet address','err'); return; }
  if(!amount || amount<=0){ toast('Enter a valid amount','err'); return; }
  try{
    await api('/user/withdraw/crypto', { method:'POST', body:{ coin, network, amount, walletAddress } });
    toast('Withdrawal request submitted for admin review','ok');
    await nav('transactions');
  }catch(e){ toast(e.message,'err'); }
}

async function renderBuy(){
  const coinOptions = Object.keys(REF.coins).map(c=>`<option value="${c}">${c} — ${REF.coins[c].name}</option>`).join('');
  document.getElementById('view-buy').innerHTML = `
    <div class="card" style="max-width:480px;">
      <div class="card-title"><i class="fa-solid fa-cart-shopping"></i> Buy Crypto</div>
      <p class="muted" style="font-size:13px;">Buying with a real card or bank transfer isn't wired up on this platform. In a production build, this is where you'd hand off to a payment/on-ramp provider.</p>
      <div class="field"><label>Coin</label><select id="buyCoin">${coinOptions}</select></div>
      <div class="field"><label>Amount (USD)</label><input id="buyAmount" type="number" min="0" step="1" placeholder="e.g. 100"></div>
      <a href="https://www.coingecko.com/en/exchanges" target="_blank" rel="noopener" class="btn btn-primary btn-block">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> Continue to Payment
      </a>
      <div class="hint" style="margin-top:8px;">This link is illustrative only — for testing, ask your administrator to credit crypto to your account instead.</div>
    </div>
  `;
}
async function renderKyc(){
  const u = await api('/user/me');
  const status = u.kycStatus || 'none';
  const statusPill = status==='verified' ? '<span class="pill pill-green"><i class="fa-solid fa-circle-check"></i> Verified</span>'
    : status==='pending' ? '<span class="pill pill-amber"><i class="fa-solid fa-clock"></i> Pending Review</span>'
    : '<span class="pill pill-red">Not Verified</span>';

  const actionArea = status==='none' ? `
      <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="requestKycUpgrade()">
        <i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Now
      </button>
    ` : status==='pending' ? `
      <div class="warn-box" style="margin-top:16px;">
        <i class="fa-solid fa-hourglass-half"></i> Your account upgrade request has been received. This is a simulated platform, so no real documents are processed — in a production build, our team would review your ID here within 24-48 hours.
      </div>
    ` : `
      <div class="reject-banner" style="border-color:#bfe3cd;background:#e9f6ee;color:#1e7a46;margin-top:16px;">
        <i class="fa-solid fa-circle-check"></i> Your account is fully verified.
      </div>
    `;

  document.getElementById('view-kyc').innerHTML = `
    <div class="card" style="max-width:480px;">
      <div class="card-title"><i class="fa-solid fa-id-card"></i> KYC Verification</div>
      <div class="row gap-8" style="margin-bottom:14px;">${statusPill}</div>
      <p class="muted" style="font-size:13px;">Upgrading your account unlocks higher withdrawal limits. This is a simulated platform for testing — no real identity documents are collected or verified.</p>
      ${actionArea}
    </div>
  `;
}
async function requestKycUpgrade(){
  try{
    await api('/user/kyc/request', { method:'POST' });
    toast('Upgrade request submitted','ok');
    await renderKyc();
  }catch(e){ toast(e.message,'err'); }
}

/* ---------------- Support: AI assistant with WhatsApp hand-off ---------------- */
const SUPPORT_WHATSAPP = '+16028740409';   // change the number here if it ever changes
let SUPPORT = { hist:[], busy:false };
async function renderSupport(){
  SUPPORT.hist = []; SUPPORT.busy = false;
  const chips = ['My withdrawal was rejected','Deposit not showing','How do swaps and fees work?','Account verification'];
  document.getElementById('view-support').innerHTML = `
    <div class="card chat-card">
      <div class="chat-head"><div class="ai-dot"><i class="fa-solid fa-headset"></i></div>
        <div><b>Support Assistant</b><span>Instant answers · a human is one WhatsApp message away</span></div></div>
      <div class="chat-log" id="chatLog"></div>
      <div class="chat-chips" id="chatChips">${chips.map(q=>`<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="chat-input"><textarea id="chatText" rows="1" placeholder="Type your question…"></textarea>
        <button class="btn btn-primary" id="chatSend" type="button"><i class="fa-solid fa-paper-plane"></i></button></div>
      <div class="chat-foot">Not satisfied? <a href="#" id="chatHuman"><i class="fa-brands fa-whatsapp"></i> Chat with our team on WhatsApp</a>.</div>
    </div>`;
  chatAdd('bot', "Hi! I'm the support assistant. Ask me about deposits, withdrawals, swaps, network fees or your account. If I can't solve it, I'll connect you with our team on WhatsApp.");
  const ta = document.getElementById('chatText');
  document.getElementById('chatSend').addEventListener('click', ()=>chatAsk(ta.value));
  ta.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); chatAsk(ta.value); } });
  document.getElementById('chatChips').addEventListener('click', e=>{ const q = e.target.getAttribute && e.target.getAttribute('data-q'); if(q) chatAsk(q); });
  document.getElementById('chatHuman').addEventListener('click', e=>{ e.preventDefault(); chatOfferWhatsApp(true); });
}
function chatAdd(role, text){
  const log = document.getElementById('chatLog');
  const el = document.createElement('div');
  el.className = 'msg ' + (role==='me' ? 'me' : 'bot');
  el.textContent = text;
  log.appendChild(el); log.scrollTop = log.scrollHeight;
  return el;
}
function chatOfferWhatsApp(manual){
  const log = document.getElementById('chatLog');
  const convo = SUPPORT.hist.slice(-8).map(m=>(m.role==='user'?'Me: ':'Assistant: ')+m.text).join('\n\n') || '(please describe your issue here)';
  const msg = 'Hello Support, I need help with the following:\n\n' + convo;
  const link = 'https://wa.me/' + SUPPORT_WHATSAPP.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent(msg);
  chatAdd('bot', manual
    ? "Sure — tap the button below to chat with our team on WhatsApp."
    : "I'm sorry I couldn't fully solve this. Our team can help you personally on WhatsApp. The button below opens a chat with our conversation already included.");
  const wrap = document.createElement('div');
  wrap.className = 'chat-actions';
  wrap.innerHTML = `<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="${link}"><i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp (${esc(SUPPORT_WHATSAPP)})</a>`;
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}
async function chatAsk(text){
  text = (text||'').trim();
  if(!text || SUPPORT.busy) return;
  SUPPORT.busy = true;
  document.getElementById('chatText').value = '';
  const chips = document.getElementById('chatChips'); if(chips) chips.style.display = 'none';
  chatAdd('me', text);
  const history = SUPPORT.hist.slice(-10);
  SUPPORT.hist.push({ role:'user', text });
  const typing = chatAdd('bot', 'Typing…'); typing.classList.add('typing');
  let reply, escalate = false;
  try{
    const r = await api('/user/support/chat', { method:'POST', body:{ message:text, history } });
    reply = r.reply; escalate = !!r.escalate;
  }catch(e){ reply = "I'm having trouble answering right now."; escalate = true; }
  typing.remove();
  chatAdd('bot', reply);
  SUPPORT.hist.push({ role:'assistant', text:reply });
  if(escalate) chatOfferWhatsApp(false);
  SUPPORT.busy = false;
}

(async function init(){
  const u = await api('/user/me');
  REF = await api('/user/reference');
  document.getElementById('welcome').innerHTML = `Welcome back, <span>${u.name}</span>!`;
  document.getElementById('avatar').textContent = u.name.trim()[0].toUpperCase();
  if (Session.impersonating) {
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#fdf6e8;border:1px solid var(--gold-light);color:#6b5520;padding:10px 16px;border-radius:10px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13.5px;';
    bar.innerHTML = `<span><i class="fa-solid fa-user-shield"></i> Admin view — you're looking at <b>${u.name}</b>'s dashboard (@${u.username}).</span><button class="btn btn-outline btn-sm" onclick="logout()">Exit view</button>`;
    document.querySelector('.main').prepend(bar);
  }
  await nav('dashboard');
})();