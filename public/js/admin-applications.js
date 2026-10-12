/* admin-applications.js — include in admin.html AFTER admin.js.
   Adds an "Applications" inbox to the admin dashboard: every "Open an Account"
   request submitted on the public website lands here.
   Expects:  GET  /admin/applications            -> [ {id|_id, date, status, ...form fields} ]
             POST /admin/applications/:id/status -> body { status }  (new | in_review | approved | declined)
   (see server-routes.js) */
(function(){
  var STATUSES = ['new','in_review','approved','declined'];
  var LABEL = { new:'New', in_review:'In review', approved:'Approved', declined:'Declined' };
  var CLS = { new:'status-pending', in_review:'status-pending', approved:'status-approved', declined:'status-rejected' };
  var CACHE = [];

  function esc(s){ var d=document.createElement('div'); d.textContent = (s==null?'':String(s)); return d.innerHTML; }
  function aid(a){ return a.id || a._id; }

  /* ---- inject sidebar item + view container ---- */
  var usersItem = document.querySelector('.nav-item[data-view="users"]');
  if(usersItem){
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('data-view','applications');
    item.innerHTML = '<span class="ic"><i class="fa-solid fa-inbox"></i></span><span>Applications</span> <span class="pill pill-amber hidden" id="appBadge" style="margin-left:auto;padding:1px 8px;font-size:11px;">0</span>';
    item.addEventListener('click', function(){ nav('applications'); });
    usersItem.parentNode.insertBefore(item, usersItem.nextSibling);
  }
  var usersView = document.getElementById('view-users');
  if(usersView && !document.getElementById('view-applications')){
    var box = document.createElement('div');
    box.id = 'view-applications';
    box.className = 'hidden';
    usersView.parentNode.appendChild(box);
  }

  /* ---- wrap nav() ---- */
  var _nav = nav;
  nav = async function(view, arg){
    var box = document.getElementById('view-applications');
    if(view === 'applications'){
      currentView = view;
      document.querySelectorAll('[id^="view-"]').forEach(function(v){ v.classList.toggle('hidden', v.id !== 'view-applications'); });
      document.querySelectorAll('.nav-item[data-view]').forEach(function(el){ el.classList.toggle('active', el.dataset.view === 'applications'); });
      toggleSidebar(false);
      await renderApplications();
      return;
    }
    if(box) box.classList.add('hidden');
    await _nav(view, arg);
    refreshAppBadge();
  };

  async function refreshAppBadge(){
    try{
      var list = await api('/admin/applications');
      var n = list.filter(function(a){ return a.status === 'new'; }).length;
      var b = document.getElementById('appBadge');
      if(!b) return;
      b.textContent = n;
      b.classList.toggle('hidden', n === 0);
    }catch(e){}
  }

  window.renderApplications = async function(){
    var box = document.getElementById('view-applications');
    var list = await api('/admin/applications');
    CACHE = list.slice().sort(function(a,b){
      var pa = a.status==='new'?0:1, pb = b.status==='new'?0:1;
      return pa-pb || new Date(b.date||b.createdAt) - new Date(a.date||a.createdAt);
    });
    var b = document.getElementById('appBadge');
    if(b){ var n = list.filter(function(a){return a.status==='new';}).length; b.textContent=n; b.classList.toggle('hidden', n===0); }

    if(!CACHE.length){
      box.innerHTML = '<div class="card"><div class="empty-state">No account applications yet. Requests from the website\'s "Open an Account" form will appear here.</div></div>';
      return;
    }
    box.innerHTML = '<div class="card"><div class="card-title"><i class="fa-solid fa-inbox"></i> Account Applications</div>' +
      '<table><thead><tr><th>Applicant</th><th>Account</th><th>Deposit</th><th>Status</th><th>Received</th><th></th></tr></thead><tbody>' +
      CACHE.map(function(a){
        var st = a.status || 'new';
        return '<tr>' +
          '<td>' + esc(a.fullName) + '<div class="mono">' + esc(a.email) + '</div></td>' +
          '<td>' + esc(a.acctType) + '</td>' +
          '<td>' + (a.deposit!==''&&a.deposit!=null ? fmtUSD(Number(a.deposit)||0) : '—') + '</td>' +
          '<td><span class="status-chip ' + (CLS[st]||'') + '">' + esc(LABEL[st]||st) + '</span></td>' +
          '<td class="muted">' + esc(fmtDate(a.date||a.createdAt)) + '</td>' +
          '<td><button class="btn btn-primary btn-sm" onclick="openApplication(\'' + esc(aid(a)) + '\')">View</button></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
  };

  window.openApplication = function(id){
    var a = CACHE.find(function(x){ return String(aid(x)) === String(id); });
    if(!a) return;
    function row(l,v){ return '<div><dt>' + l + '</dt><dd>' + (esc(v) || '—') + '</dd></div>'; }
    openModal(
      '<h3>' + esc(a.fullName) + '</h3>' +
      '<p class="muted" style="font-size:12.5px;">Received ' + esc(fmtDate(a.date||a.createdAt)) + '</p>' +
      '<dl class="detail-grid" style="margin:14px 0;">' +
        row('Account type', a.acctType) + row('Currencies', a.currencies) +
        row('Date of birth', a.dob) + row('Nationality', a.nationality) +
        row('Residence', [a.address,a.city,a.postcode,a.residence].filter(Boolean).join(', ')) +
        row('Email', a.email) + row('Phone', a.phone) +
        row('Identification', a.idType ? a.idType + ' · ' + a.idNumber + ' (' + a.idCountry + ')' : '') +
        row('Occupation', a.occupation + (a.employer ? ' · ' + a.employer : '')) +
        row('Source of funds', a.sourceFunds) +
        row('Expected deposit', a.deposit ? fmtUSD(Number(a.deposit)||0) : '') +
        (a.bizReg ? row('Business reg. no.', a.bizReg) : '') +
      '</dl>' +
      '<div class="field"><label>Status</label><select id="appStatus">' +
        STATUSES.map(function(s){ return '<option value="'+s+'"'+(s===(a.status||'new')?' selected':'')+'>'+LABEL[s]+'</option>'; }).join('') +
      '</select></div>' +
      '<div class="row gap-8">' +
        '<button class="btn btn-primary btn-sm" onclick="saveAppStatus(\'' + esc(aid(a)) + '\')">Save status</button>' +
        '<button class="btn btn-outline btn-sm" onclick="createFromApplication(\'' + esc(aid(a)) + '\')">Create client account</button>' +
        '<button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>' +
      '</div>'
    );
  };

  window.saveAppStatus = async function(id){
    var status = document.getElementById('appStatus').value;
    try{
      await api('/admin/applications/' + id + '/status', { method:'POST', body:{ status:status } });
      toast('Application updated','ok');
      closeModal();
      await renderApplications();
    }catch(e){ toast(e.message,'err'); }
  };

  function pick(sel, text){
    if(!sel || !text) return;
    var t = String(text).toLowerCase(), first = t.split(/[\s(&]+/)[0], found = null;
    Array.prototype.forEach.call(sel.options, function(o){ if(!found && o.value && o.value.toLowerCase() === t) found = o; });
    if(!found) Array.prototype.forEach.call(sel.options, function(o){ if(!found && o.value && first.length>2 && o.value.toLowerCase().indexOf(first) !== -1) found = o; });
    if(found){ sel.value = found.value; sel.dispatchEvent(new Event('change')); }
  }
  function setVal(id, v){ var el = document.getElementById(id); if(el && v != null) el.value = v; }

  window.createFromApplication = async function(id){
    var a = CACHE.find(function(x){ return String(aid(x)) === String(id); });
    if(!a) return;
    closeModal();
    await nav('createuser');
    pick(document.getElementById('cf_accountType'), a.acctType);
    setVal('cf_legalName', a.fullName); setVal('cf_dateOfBirth', a.dob);
    pick(document.getElementById('cf_nationality'), a.nationality);
    pick(document.getElementById('cf_residenceCountry'), a.residence);
    setVal('cf_address', a.address); setVal('cf_city', a.city); setVal('cf_postcode', a.postcode);
    setVal('cf_email', a.email); setVal('cf_phoneNumber', a.phone);
    pick(document.getElementById('cf_idType'), a.idType);
    setVal('cf_idNumber', a.idNumber);
    pick(document.getElementById('cf_idCountry'), a.idCountry);
    setVal('cf_occupation', a.occupation); setVal('cf_employer', a.employer);
    pick(document.getElementById('cf_sourceOfFunds'), a.sourceFunds);
    setVal('cf_expectedDeposit', a.deposit); setVal('cf_businessRegNumber', a.bizReg);
    var wanted = String(a.currencies||'').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
    document.querySelectorAll('input[name="cf_currency"]').forEach(function(c){ c.checked = wanted.indexOf(c.value.toUpperCase()) !== -1; });
    toast('Form pre-filled from the application — review, tick consent and submit','ok');
    window.scrollTo(0,0);
  };

  refreshAppBadge();
  setInterval(refreshAppBadge, 30000);
})();