/* admin-loans-kyc.js — include in admin.html AFTER admin.js.
   Adds "Loans" and "KYC Requests" pages to the admin panel. */
(function(){
  var LOAN_CLS = { pending:'status-pending', approved:'status-approved', declined:'status-rejected' };
  var KYC_LABEL = { requested:'Upgrade requested', details_needed:'Awaiting details', submitted:'Details submitted', verified:'Verified', rejected:'Rejected' };
  var KYC_CLS = { requested:'status-pending', details_needed:'status-pending', submitted:'status-pending', verified:'status-approved', rejected:'status-rejected' };
  var LOANS = [], KYCS = [];

  function addNav(key, icon, label, badgeId, afterEl){
    if(document.querySelector('.nav-item[data-view="'+key+'"]')) return null;
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('data-view', key);
    item.innerHTML = '<span class="ic"><i class="'+icon+'"></i></span> '+label+' <span class="hidden" id="'+badgeId+'" style="margin-left:auto;background:var(--gold);color:var(--navy-dark);font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:100px;"></span>';
    item.addEventListener('click', function(){ nav(key); });
    afterEl.parentNode.insertBefore(item, afterEl.nextSibling);
    return item;
  }
  function addView(id){
    if(document.getElementById(id)) return;
    var box = document.createElement('div');
    box.id = id; box.className = 'hidden';
    document.getElementById('view-users').parentNode.appendChild(box);
  }
  var anchor = document.querySelector('.nav-item[data-view="applications"]') || document.querySelector('.nav-item[data-view="users"]');
  if(anchor){
    var loansItem = addNav('loans', 'fa-solid fa-hand-holding-dollar', 'Loans', 'loanBadge', anchor);
    addNav('kycreq', 'fa-solid fa-id-card', 'KYC Requests', 'kycBadge', loansItem || anchor);
  }
  addView('view-loans'); addView('view-kycreq');

  function setBadge(id, n){
    var b = document.getElementById(id);
    if(b){ b.textContent = n; b.classList.toggle('hidden', n === 0); }
  }
  async function refreshBadges(){
    try{
      var lo = await api('/admin/loans'), kr = await api('/admin/kyc');
      setBadge('loanBadge', lo.filter(function(l){ return l.status === 'pending'; }).length);
      setBadge('kycBadge', kr.filter(function(k){ return k.status === 'requested' || k.status === 'submitted'; }).length);
    }catch(e){ /* routes not installed yet */ }
  }
  refreshBadges();
  setInterval(refreshBadges, 30000);

  /* ---------------- Loans ---------------- */
  window.renderLoans = async function(){
    var box = document.getElementById('view-loans');
    var list = [];
    try{ list = await api('/admin/loans'); }
    catch(e){ box.innerHTML = '<div class="card"><div class="empty-state">Could not load loan applications. Make sure loans-kyc-routes.js is installed.</div></div>'; return; }
    LOANS = list;
    var n = list.filter(function(l){ return l.status === 'pending'; }).length;
    setBadge('loanBadge', n);
    if(!list.length){ box.innerHTML = '<div class="card"><div class="empty-state">No loan applications yet.</div></div>'; return; }
    box.innerHTML = `
      <div class="card">
        <div class="card-title"><i class="fa-solid fa-hand-holding-dollar"></i> Loan Applications ${n?`<span class="pill pill-amber">${n} pending</span>`:''}</div>
        ${dt([
          {l:'Applicant',w:'minmax(0,1.4fr)',cls:'first'},{l:'Amount',w:'minmax(0,.9fr)',cls:'num'},{l:'Term',w:'80px'},
          {l:'Purpose',w:'minmax(0,1.6fr)'},{l:'Status',w:'90px'},{l:'Received',w:'minmax(0,1.1fr)'},{l:'',w:'176px',cls:'act'}
        ], list.map(function(l){
          var actions;
          if(l.status === 'pending'){
            actions = `<button class="btn btn-primary btn-sm" onclick="loanApprove('${l.id}')"><i class="fa-solid fa-check"></i> Approve</button>
                       <button class="btn btn-danger btn-sm" onclick="loanDeclineModal('${l.id}')"><i class="fa-solid fa-xmark"></i> Decline</button>`;
          } else if(l.status === 'declined'){
            actions = `<span class="sub" style="text-align:left;">${esc(l.adminMessage||'')}</span>`;
          } else {
            actions = '<span class="muted" style="font-size:12px;">Approved</span>';
          }
         return [
            `<span class="strong">${esc(l.name||'—')}</span><span class="sub mono">@${esc(l.username||'')}</span>`,
            fmtUSD(l.amount) + (l.monthlyPayment!=null ? '<span class="sub">'+esc(l.interestRate)+'% · '+fmtUSD(l.monthlyPayment)+'/mo</span>' : ''),
            esc(l.termMonths)+' mo',
            `<b>${esc(l.loanType||'')}</b> ${esc(l.purpose)}<span class="sub">${esc(l.employment||'')}${l.monthlyIncome!=null?' · income '+fmtUSD(l.monthlyIncome)+'/mo':''}</span>`,
            `<span class="status-chip ${LOAN_CLS[l.status]||''}">${esc(l.status)}</span>`,
            `<span class="muted">${fmtDate(l.createdAt)}</span>`,
            actions
          ];
        }))}
      </div>`;
  };
  window.loanApprove = async function(id){
    try{
      await api('/admin/loans/'+id+'/approve', { method:'POST' });
      toast('Loan approved — the user will see a confirmation','ok');
      await renderLoans();
    }catch(e){ toast(e.message,'err'); }
  };
  window.loanDeclineModal = function(id){
    openModal(`
      <h3>Decline Loan Application</h3>
      <p class="muted" style="font-size:13px;">This reason is shown to the user on their dashboard.</p>
      <div class="field"><label>Reason for declining</label><textarea id="loanReason" rows="4" placeholder="e.g. Your monthly income does not meet the minimum requirement for this loan amount."></textarea></div>
      <button class="btn btn-danger btn-block" onclick="loanDecline('${id}')">Decline Application</button>
    `);
  };
  window.loanDecline = async function(id){
    var reason = document.getElementById('loanReason').value.trim();
    if(!reason){ toast('Please write a reason','err'); return; }
    try{
      await api('/admin/loans/'+id+'/decline', { method:'POST', body:{ reason:reason } });
      closeModal(); toast('Application declined','ok'); await renderLoans();
    }catch(e){ toast(e.message,'err'); }
  };

  /* ---------------- KYC requests ---------------- */
  window.renderKycRequests = async function(){
    var box = document.getElementById('view-kycreq');
    var list = [];
    try{ list = await api('/admin/kyc'); }
    catch(e){ box.innerHTML = '<div class="card"><div class="empty-state">Could not load KYC requests. Make sure loans-kyc-routes.js is installed.</div></div>'; return; }
    KYCS = list;
    var n = list.filter(function(k){ return k.status === 'requested' || k.status === 'submitted'; }).length;
    setBadge('kycBadge', n);
    if(!list.length){ box.innerHTML = '<div class="card"><div class="empty-state">No KYC upgrade requests yet.</div></div>'; return; }
    box.innerHTML = `
      <div class="card">
        <div class="card-title"><i class="fa-solid fa-id-card"></i> KYC Upgrade Requests ${n?`<span class="pill pill-amber">${n} need action</span>`:''}</div>
        ${dt([
          {l:'User',w:'minmax(0,1.5fr)',cls:'first'},{l:'Stage',w:'minmax(0,1.3fr)'},{l:'Updated',w:'minmax(0,1.2fr)'},{l:'',w:'200px',cls:'act'}
        ], list.map(function(k){
          var actions;
          if(k.status === 'requested'){
            actions = `<button class="btn btn-primary btn-sm" onclick="kycApprove('${k.id}')"><i class="fa-solid fa-check"></i> Approve</button>
                       <button class="btn btn-danger btn-sm" onclick="kycRejectModal('${k.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>`;
          } else if(k.status === 'details_needed'){
            actions = `<button class="btn btn-danger btn-sm" onclick="kycRejectModal('${k.id}')">Reject</button>`;
          } else if(k.status === 'submitted'){
            actions = `<button class="btn btn-primary btn-sm" onclick="kycReview('${k.id}')">Review details</button>`;
          } else if(k.status === 'rejected'){
            actions = `<span class="sub" style="text-align:left;">${esc(k.adminMessage||'')}</span>`;
          } else {
            actions = '<span class="muted" style="font-size:12px;">Verified</span>';
          }
          return [
            `<span class="strong">${esc(k.name||'—')}</span><span class="sub mono">@${esc(k.username||'')} · ${esc(k.email||'')}</span>`,
            `<span class="status-chip ${KYC_CLS[k.status]||''}">${esc(KYC_LABEL[k.status]||k.status)}</span>`,
            `<span class="muted">${fmtDate(k.updatedAt)}</span>`,
            actions
          ];
        }))}
      </div>`;
  };
  window.kycApprove = async function(id){
    try{
      await api('/admin/kyc/'+id+'/approve-upgrade', { method:'POST' });
      toast('Upgrade approved — the user can now submit their details','ok');
      await renderKycRequests();
    }catch(e){ toast(e.message,'err'); }
  };
  window.kycRejectModal = function(id){
    openModal(`
      <h3>Reject KYC Upgrade</h3>
      <p class="muted" style="font-size:13px;">This message is shown to the user on their KYC page and dashboard.</p>
      <div class="field"><label>Message to the user</label><textarea id="kycReason" rows="4" placeholder="e.g. The ID details did not match the name on your account. Please apply again with matching details."></textarea></div>
      <button class="btn btn-danger btn-block" onclick="kycReject('${id}')">Reject &amp; Send Message</button>
    `);
  };
  window.kycReject = async function(id){
    var reason = document.getElementById('kycReason').value.trim();
    if(!reason){ toast('Please write a message','err'); return; }
    try{
      await api('/admin/kyc/'+id+'/reject', { method:'POST', body:{ reason:reason } });
      closeModal(); toast('Rejected and message sent','ok'); await renderKycRequests();
    }catch(e){ toast(e.message,'err'); }
  };
  window.kycReview = function(id){
    var k = KYCS.find(function(x){ return x.id === id; });
    if(!k) return;
    var row = function(l, v){ return '<div><dt>'+l+'</dt><dd>'+(esc(v)||'—')+'</dd></div>'; };
    openModal(`
      <h3>${esc(k.name||'User')} — KYC details</h3>
      <p class="muted mono" style="font-size:12.5px;">@${esc(k.username||'')} · ${esc(k.email||'')}</p>
      <dl class="detail-grid" style="margin:14px 0;">
        ${row('Legal name',k.fullName)}${row('Date of birth',k.dateOfBirth)}
        ${row('ID type',k.idType)}${row('ID number',k.idNumber)}
        ${row('Country of issue',k.idCountry)}${row('Address',k.address)}
        ${row('Note',k.note)}
      </dl>
      <div class="row gap-8">
        <button class="btn btn-primary btn-sm" onclick="kycVerify('${k.id}')"><i class="fa-solid fa-circle-check"></i> Verify account</button>
        <button class="btn btn-danger btn-sm" onclick="kycRejectModal('${k.id}')">Reject</button>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
      </div>
    `);
  };
  window.kycVerify = async function(id){
    try{
      await api('/admin/kyc/'+id+'/verify', { method:'POST' });
      closeModal(); toast('User verified','ok'); await renderKycRequests();
    }catch(e){ toast(e.message,'err'); }
  };
})();