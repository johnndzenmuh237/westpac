/* user-loans-kyc.js — include in user.html AFTER user.js.
   Adds the Loans page, the multi-step KYC flow, and dashboard notices. */
(function(){
  /* ---- sidebar item + page container ---- */
  var kycItem = document.querySelector('.nav-item[data-view="kyc"]');
  if(kycItem && !document.querySelector('.nav-item[data-view="loans"]')){
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('data-view', 'loans');
    item.innerHTML = '<span class="ic"><i class="fa-solid fa-hand-holding-dollar"></i></span> Loans';
    item.addEventListener('click', function(){ nav('loans'); });
    kycItem.parentNode.insertBefore(item, kycItem);
  }
  if(!document.getElementById('view-loans')){
    var box = document.createElement('div');
    box.id = 'view-loans'; box.className = 'hidden';
    document.getElementById('view-support').parentNode.appendChild(box);
  }

  var OK_STYLE = 'border-color:#bfe3cd;background:#e9f6ee;color:#1e7a46;';
  var BAD_STYLE = 'border-color:#f2c9d0;background:#fdf2f4;color:#b4233a;';

  /* ---------------- Loans page: types, terms, calculator, application ---------------- */
  var LT = { types:[], terms:[] };
  function loanCalc(P, apr, n){
    var r = apr / 1200;
    var m = r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
    return { monthly:m, total:m * n, interest:m * n - P };
  }

  var LOAN_CACHE = {};
  function loanItem(l){
    LOAN_CACHE[l.id] = l;
    var status;
    if(l.status === 'approved'){
      status = '<div class="reject-banner" style="'+OK_STYLE+'margin-top:10px;"><i class="fa-solid fa-circle-check"></i> <b>Congratulations!</b> Your loan application has been approved.</div>';
    } else if(l.status === 'declined'){
      status = '<div class="reject-banner" style="'+BAD_STYLE+'margin-top:10px;font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> <b>Declined:</b> '+esc(l.adminMessage||'No reason was given.')+'</div>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="loanReapply(\''+esc(l.id)+'\')"><i class="fa-solid fa-rotate-right"></i> Apply Again</button>';
    } else {
      status = '<div style="margin-top:10px;"><span class="pill pill-amber"><i class="fa-solid fa-clock"></i> Under review</span></div>';
    }
    var extra = l.monthlyPayment != null
      ? '<div class="muted" style="font-size:12.5px;margin-top:4px;">'+esc(l.interestRate)+'% APR · '+fmtUSD(l.monthlyPayment)+'/month · total repayment '+fmtUSD(l.totalRepayment)+'</div>' : '';
    return '<div style="padding:14px 0;border-bottom:1px solid var(--border,#e6e8ef);">' +
      '<div class="row gap-8" style="justify-content:space-between;"><div><b>'+esc(l.loanType||'Loan')+'</b> · '+fmtUSD(l.amount)+' <span class="muted">· '+esc(l.termMonths)+' months</span></div>' +
      '<div class="muted" style="font-size:12.5px;">'+fmtDate(l.createdAt)+'</div></div>' +
      '<div class="muted" style="font-size:13px;margin-top:4px;">'+esc(l.purpose)+'</div>' + extra + status + '</div>';
  }

  // "Apply Again": opens the Loans page with the declined application's details filled in
  window.loanReapply = async function(id){
    var l = LOAN_CACHE[id];
    await nav('loans');
    if(!l) return;
    var t = LT.types.find(function(x){ return x.name === l.loanType; });
    if(t){
      document.getElementById('loanType').value = t.id;
      loanTypeChanged();
    }
    var set = function(elId, v){ var el = document.getElementById(elId); if(el && v != null) el.value = v; };
    set('loanAmount', l.amount);
    set('loanTerm', String(l.termMonths));
    set('loanPurpose', l.purpose);
    set('loanEmployment', l.employment);
    set('loanIncome', l.monthlyIncome);
    loanRecalc();
    var form = document.getElementById('loanType');
    if(form) form.scrollIntoView({ behavior:'smooth', block:'center' });
    toast('Your previous details are filled in. Adjust them and submit again.','ok');
  };

  function termLabel(m){ return m >= 12 && m % 12 === 0 ? (m/12)+(m===12?' year':' years')+' ('+m+' months)' : m+' months'; }

  window.renderLoans = async function(){
    var loans = [];
    try{ LT = await api('/user/loan-types'); }
    catch(e){ console.error('Loan types failed', e); }
    try{ loans = await api('/user/loans'); }
    catch(e){ console.error('Loans failed', e); toast('Could not load your applications: ' + e.message, 'err'); }

    if(!LT.types || !LT.types.length){
      document.getElementById('view-loans').innerHTML =
        '<div class="card"><div class="empty-state">The loan options could not be loaded. Please refresh the page or try again later.</div></div>' +
        '<div class="card" style="margin-top:18px;"><div class="card-title"><i class="fa-solid fa-list"></i> My Loan Applications</div>' +
        (loans.length ? loans.map(loanItem).join('') : '<div class="empty-state">You have not applied for a loan yet.</div>') + '</div>';
      return;
    }

    var typeRows = LT.types.map(function(t){
      return '<tr style="border-bottom:1px solid var(--border,#e6e8ef);">' +
        '<td style="padding:10px 8px;"><b>'+esc(t.name)+'</b><div class="muted" style="font-size:12px;">'+esc(t.desc)+'</div></td>' +
        '<td style="padding:10px 8px;white-space:nowrap;">'+fmtUSD(t.min)+' – '+fmtUSD(t.max)+'</td>' +
        '<td style="padding:10px 8px;">'+t.rate+'%</td>' +
        '<td style="padding:10px 8px;">'+termLabel(t.maxTerm)+'</td>' +
        '<td style="padding:10px 8px;"><button class="btn btn-outline btn-sm" onclick="loanPick(\''+t.id+'\')">Select</button></td></tr>';
    }).join('');
    var typeOptions = LT.types.map(function(t){ return '<option value="'+t.id+'">'+esc(t.name)+'</option>'; }).join('');

    document.getElementById('view-loans').innerHTML =
      '<div class="card" style="margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-table-list"></i> Loan Types</div>' +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13.5px;text-align:left;">' +
        '<thead><tr class="muted" style="font-size:12px;"><th style="padding:8px;">Loan</th><th style="padding:8px;">Amount</th><th style="padding:8px;">Rate (APR)</th><th style="padding:8px;">Max term</th><th></th></tr></thead>' +
        '<tbody>'+typeRows+'</tbody></table></div></div>' +

      '<div class="card" style="margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-circle-info"></i> Loan Information &amp; Repayment Terms</div>' +
        '<ul class="muted" style="font-size:13.5px;line-height:1.8;padding-left:18px;margin:0;">' +
        '<li>Repayment is monthly, in equal instalments of principal plus interest.</li>' +
        '<li>Interest is charged on the reducing balance at the annual rate (APR) shown for each loan type.</li>' +
        '<li>Available terms: '+LT.terms.map(function(m){ return m+' mo'; }).join(', ')+' (each loan type has a maximum term).</li>' +
        '<li>Only one application can be under review at a time.</li>' +
        '<li>Our team reviews every application. You will see the decision on your dashboard, with a reason if it is declined.</li>' +
        '<li>Approval is subject to verification. Rates and limits may change.</li></ul></div>' +

      '<div class="grid-2" style="align-items:start;margin-bottom:18px;">' +
        '<div class="card"><div class="card-title"><i class="fa-solid fa-calculator"></i> Loan Calculator &amp; Application</div>' +
          '<div class="field"><label>Loan type</label><select id="loanType" onchange="loanTypeChanged()">'+typeOptions+'</select></div>' +
          '<div class="field"><label>Loan amount (USD)</label><input id="loanAmount" type="number" step="0.01" oninput="loanRecalc()"><div class="hint" id="loanAmtHint"></div></div>' +
          '<div class="field"><label>Repayment term</label><select id="loanTerm" onchange="loanRecalc()"></select></div>' +
          '<div class="field"><label>What is the loan for?</label><input id="loanPurpose" placeholder="e.g. Business equipment, home improvement"></div>' +
          '<div class="field"><label>Employment status</label><select id="loanEmployment">' +
            ['Employed','Self-employed','Business owner','Student','Retired','Other'].map(function(o){ return '<option>'+o+'</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Monthly income (USD) <span class="muted" style="font-weight:500;">(optional)</span></label><input id="loanIncome" type="number" min="0" step="0.01"></div>' +
        '</div>' +
        '<div class="card"><div class="card-title"><i class="fa-solid fa-file-invoice-dollar"></i> Your Repayment Summary</div>' +
          '<div class="field"><label>Interest rate (APR)</label><input id="loanRate" readonly></div>' +
          '<div class="field"><label>Monthly payment</label><input id="loanMonthly" readonly></div>' +
          '<div class="field"><label>Total interest</label><input id="loanInterest" readonly></div>' +
          '<div class="field"><label>Total repayment</label><input id="loanTotal" readonly></div>' +
          '<button class="btn btn-primary btn-block" onclick="submitLoan()"><i class="fa-solid fa-paper-plane"></i> Submit Application</button>' +
          '<div class="hint" style="margin-top:8px;">These figures are calculated automatically and confirmed by our system when you submit.</div>' +
          '<div style="margin-top:14px;"><a href="#" onclick="loanToggleSchedule();return false;">Show / hide repayment schedule</a>' +
            '<div id="loanSchedule" class="hidden" style="overflow-x:auto;margin-top:8px;"></div></div>' +
        '</div>' +
      '</div>' +

      '<div class="card"><div class="card-title"><i class="fa-solid fa-list"></i> My Loan Applications</div>' +
        (loans.length ? loans.map(loanItem).join('') : '<div class="empty-state">You have not applied for a loan yet.</div>') + '</div>';

    loanTypeChanged();   // fill the form without scrolling away on page load
  };

  function curType(){
    var el = document.getElementById('loanType');
    if(!el) return null;
    return LT.types.find(function(t){ return t.id === el.value; });
  }
  window.loanPick = function(id){
    document.getElementById('loanType').value = id;
    loanTypeChanged();
    document.getElementById('loanType').scrollIntoView({ behavior:'smooth', block:'center' });
  };
  window.loanTypeChanged = function(){
    var t = curType(); if(!t) return;
    var amt = document.getElementById('loanAmount');
    amt.min = t.min; amt.max = t.max;
    amt.value = Math.min(t.max, Math.max(t.min, Math.round((t.min + (t.max - t.min) * 0.1) / 100) * 100));
    document.getElementById('loanAmtHint').textContent = 'Between ' + fmtUSD(t.min) + ' and ' + fmtUSD(t.max) + '.';
    var sel = document.getElementById('loanTerm');
    var allowed = LT.terms.filter(function(m){ return m <= t.maxTerm; });
    var pick = allowed.indexOf(12) >= 0 ? 12 : allowed[allowed.length - 1];
    sel.innerHTML = allowed.map(function(m){ return '<option value="'+m+'"'+(m===pick?' selected':'')+'>'+termLabel(m)+'</option>'; }).join('');
    loanRecalc();
  };
  window.loanRecalc = function(){
    var t = curType(); if(!t) return;
    var P = parseFloat(document.getElementById('loanAmount').value);
    var n = parseInt(document.getElementById('loanTerm').value, 10);
    var set = function(id, v){ document.getElementById(id).value = v; };
    set('loanRate', t.rate + '%');
    if(!(P > 0) || !n){ set('loanMonthly','—'); set('loanInterest','—'); set('loanTotal','—'); document.getElementById('loanSchedule').innerHTML = ''; return; }
    var c = loanCalc(P, t.rate, n);
    set('loanMonthly', fmtUSD(c.monthly)); set('loanInterest', fmtUSD(c.interest)); set('loanTotal', fmtUSD(c.total));
    // schedule (first 12 payments)
    var bal = P, r = t.rate / 1200, rows = '';
    for(var i = 1; i <= Math.min(n, 12); i++){
      var int = bal * r, prin = c.monthly - int; bal = Math.max(0, bal - prin);
      rows += '<tr style="border-bottom:1px solid var(--border,#e6e8ef);"><td style="padding:6px;">'+i+'</td><td style="padding:6px;">'+fmtUSD(c.monthly)+'</td><td style="padding:6px;">'+fmtUSD(prin)+'</td><td style="padding:6px;">'+fmtUSD(int)+'</td><td style="padding:6px;">'+fmtUSD(bal)+'</td></tr>';
    }
    document.getElementById('loanSchedule').innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;text-align:left;"><thead class="muted"><tr><th style="padding:6px;">#</th><th style="padding:6px;">Payment</th><th style="padding:6px;">Principal</th><th style="padding:6px;">Interest</th><th style="padding:6px;">Balance</th></tr></thead><tbody>'+rows+'</tbody></table>' +
      (n > 12 ? '<div class="hint">Showing the first 12 of '+n+' payments.</div>' : '');
  };
  window.loanToggleSchedule = function(){ document.getElementById('loanSchedule').classList.toggle('hidden'); };

  window.submitLoan = async function(){
    var t = curType();
    if(!t){ toast('Loan options are not loaded. Please refresh the page.','err'); return; }
    var body = {
      loanType: t.id,
      amount: parseFloat(document.getElementById('loanAmount').value),
      termMonths: document.getElementById('loanTerm').value,
      purpose: document.getElementById('loanPurpose').value.trim(),
      employment: document.getElementById('loanEmployment').value,
      monthlyIncome: document.getElementById('loanIncome').value
    };
    if(!(body.amount >= t.min && body.amount <= t.max)){ toast(t.name + ' amounts are between ' + fmtUSD(t.min) + ' and ' + fmtUSD(t.max), 'err'); return; }
    if(!body.purpose){ toast('Tell us what the loan is for','err'); return; }
    try{
      await api('/user/loans', { method:'POST', body:body });
      toast('Loan application submitted for review','ok');
      await renderLoans();
    }catch(e){ toast(e.message,'err'); }
  };

  /* ---------------- KYC page (multi-step flow) ---------------- */
  window.renderKyc = async function(){
    var r = null, u = {};
    try{ r = (await api('/user/kyc/status')).request; }catch(e){}
    try{ u = await api('/user/me'); }catch(e){}
    var st = r ? r.status : (u.kycStatus === 'verified' ? 'verified' : 'none');
    var pill, body;
    if(st === 'verified'){
      pill = '<span class="pill pill-green"><i class="fa-solid fa-circle-check"></i> Verified</span>';
      body = '<div class="reject-banner" style="'+OK_STYLE+'margin-top:16px;"><i class="fa-solid fa-circle-check"></i> Your account is fully verified.</div>';
    } else if(st === 'requested'){
      pill = '<span class="pill pill-amber"><i class="fa-solid fa-clock"></i> Request sent</span>';
      body = '<div class="warn-box" style="margin-top:16px;"><i class="fa-solid fa-hourglass-half"></i> Your upgrade request has been sent to our team. Once it is approved, you will be asked to submit your details here.</div>';
    } else if(st === 'details_needed'){
      pill = '<span class="pill pill-green"><i class="fa-solid fa-circle-check"></i> Upgrade approved</span>';
      body = '<div class="reject-banner" style="'+OK_STYLE+'margin-top:16px;"><i class="fa-solid fa-circle-check"></i> Your upgrade request was approved. Please fill in your details below and send them to our team.</div>' +
        '<div style="margin-top:16px;">' +
        '<div class="field"><label>Full legal name</label><input id="kycName" value="'+esc(u.name||'')+'"></div>' +
        '<div class="field"><label>Date of birth</label><input id="kycDob" type="date"></div>' +
        '<div class="field"><label>ID type</label><select id="kycIdType"><option>Passport</option><option>National ID card</option><option>Driver\'s licence</option></select></div>' +
        '<div class="field"><label>ID number</label><input id="kycIdNumber"></div>' +
        '<div class="field"><label>Country that issued the ID</label><input id="kycIdCountry"></div>' +
        '<div class="field"><label>Residential address</label><input id="kycAddress"></div>' +
        '<div class="field"><label>Note <span class="muted" style="font-weight:500;">(optional)</span></label><input id="kycNote"></div>' +
        '<button class="btn btn-primary btn-block" onclick="submitKycDetails()"><i class="fa-solid fa-paper-plane"></i> Submit</button></div>';
    } else if(st === 'submitted'){
      pill = '<span class="pill pill-amber"><i class="fa-solid fa-clock"></i> Under review</span>';
      body = '<div class="warn-box" style="margin-top:16px;"><i class="fa-solid fa-hourglass-half"></i> Your details have been sent. Our team is reviewing them and you will see the result here.</div>';
    } else if(st === 'rejected'){
      pill = '<span class="pill pill-red">Rejected</span>';
      body = '<div class="reject-banner" style="margin-top:16px;"><b>Your upgrade was rejected:</b> '+esc(r.adminMessage||'No reason was given.')+'</div>' +
        '<button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="kycRequest()"><i class="fa-solid fa-arrow-up-right-dots"></i> Apply Again</button>';
    } else {
      pill = '<span class="pill pill-red">Not Verified</span>';
      body = '<button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="kycRequest()"><i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Now</button>';
    }
    document.getElementById('view-kyc').innerHTML =
      '<div class="card" style="max-width:480px;"><div class="card-title"><i class="fa-solid fa-id-card"></i> KYC Verification</div>' +
      '<div class="row gap-8" style="margin-bottom:14px;">'+pill+'</div>' +
      '<p class="muted" style="font-size:13px;">Upgrading your account unlocks higher withdrawal limits.</p>' + body + '</div>';
  };
  window.requestKycUpgrade = function(){ return window.kycRequest(); };
  window.kycRequest = async function(){
    try{
      await api('/user/kyc/request', { method:'POST' });
      toast('Upgrade request sent to our team','ok');
      await renderKyc();
    }catch(e){ toast(e.message,'err'); }
  };
  window.submitKycDetails = async function(){
    var v = function(id){ return document.getElementById(id).value.trim(); };
    var body = { fullName:v('kycName'), dateOfBirth:v('kycDob'), idType:v('kycIdType'), idNumber:v('kycIdNumber'),
      idCountry:v('kycIdCountry'), address:v('kycAddress'), note:v('kycNote') };
    if(!body.fullName || !body.dateOfBirth || !body.idNumber || !body.idCountry || !body.address){ toast('Please complete all required fields','err'); return; }
    try{
      await api('/user/kyc/details', { method:'POST', body:body });
      toast('Details sent to our team','ok');
      await renderKyc();
    }catch(e){ toast(e.message,'err'); }
  };

  /* ---------------- Dashboard notices ---------------- */
  async function dashNotices(){
    var loans = [], kyc = null, html = '';
    try{ loans = await api('/user/loans'); }catch(e){ console.error('Loans load failed', e); }
    try{ kyc = (await api('/user/kyc/status')).request; }catch(e){}

    // Every application with its status: under review, approved (green tick) or declined (red reason + Apply Again)
    if(loans.length){
      html += '<div class="card" style="margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-hand-holding-dollar"></i> My Loan Applications ' +
        '<a href="#" onclick="nav(\'loans\');return false;" style="margin-left:auto;font-size:12.5px;">View all</a></div>' +
        loans.slice(0,3).map(loanItem).join('') + '</div>';
    }
    if(kyc && kyc.status === 'details_needed'){
      html += '<div class="card" style="'+OK_STYLE+'margin-bottom:18px;"><div class="card-title" style="color:#1e7a46;"><i class="fa-solid fa-circle-check"></i> KYC Upgrade Approved</div>' +
        '<div>Please submit your details so we can finish verifying your account.</div>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="nav(\'kyc\')">Submit Details</button></div>';
    }
    if(kyc && kyc.status === 'rejected'){
      html += '<div class="card" style="'+BAD_STYLE+'margin-bottom:18px;"><div class="card-title" style="color:#b4233a;"><i class="fa-solid fa-triangle-exclamation"></i> KYC Upgrade Rejected</div>' +
        '<div>'+esc(kyc.adminMessage||'No reason was given.')+'</div>' +
        '<button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="nav(\'kyc\')">View</button></div>';
    }
    if(html) document.getElementById('view-dashboard').insertAdjacentHTML('afterbegin', html);
  }
  var baseDashboard = window.renderDashboard;
  window.renderDashboard = async function(){
    await baseDashboard.apply(this, arguments);
    try{ await dashNotices(); }catch(e){ console.error('Dashboard notices failed', e); }
  };
})();