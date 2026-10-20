/* admin-cards-upgrade.js — include in admin.html AFTER admin-loans-kyc.js. */
(function(){
  var CLS = { pending:'status-pending', approved:'status-approved', rejected:'status-rejected' };
  var DATA = { cards:[], upgrades:[] };

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
  var anchor = document.querySelector('.nav-item[data-view="kycreq"]') || document.querySelector('.nav-item[data-view="applications"]') || document.querySelector('.nav-item[data-view="users"]');
  if(anchor){
    var cardsItem = addNav('cards', 'fa-solid fa-credit-card', 'Card Requests', 'cardBadge', anchor);
    addNav('upgrades', 'fa-solid fa-arrow-up-right-dots', 'Upgrades', 'upgBadge', cardsItem || anchor);
  }
  addView('view-cards'); addView('view-upgrades');

  function setBadge(id, n){ var b = document.getElementById(id); if(b){ b.textContent = n; b.classList.toggle('hidden', n === 0); } }
  async function refreshBadges(){
    try{
      var c = await api('/admin/cards'), u = await api('/admin/upgrades');
      setBadge('cardBadge', c.filter(function(x){ return x.status === 'pending'; }).length);
      setBadge('upgBadge', u.filter(function(x){ return x.status === 'pending'; }).length);
    }catch(e){}
  }
  refreshBadges(); setInterval(refreshBadges, 30000);

  function actionsFor(kind, r){
    if(r.status === 'pending'){
      return '<button class="btn btn-primary btn-sm" onclick="reqDecide(\''+kind+'\',\''+r.id+'\',\'approve\')"><i class="fa-solid fa-check"></i> Approve</button> ' +
             '<button class="btn btn-danger btn-sm" onclick="reqDecide(\''+kind+'\',\''+r.id+'\',\'reject\')"><i class="fa-solid fa-xmark"></i> Reject</button>';
    }
    return '<span class="sub" style="text-align:left;">'+esc(r.adminMessage||(r.status==='approved'?'Approved':''))+'</span>';
  }

  window.renderCardRequests = async function(){
    var box = document.getElementById('view-cards'), list = [];
    try{ list = await api('/admin/cards'); }
    catch(e){ box.innerHTML = '<div class="card"><div class="empty-state">Could not load card requests. Make sure cards-upgrade-routes.js is installed.</div></div>'; return; }
    DATA.cards = list;
    var n = list.filter(function(x){ return x.status === 'pending'; }).length;
    setBadge('cardBadge', n);
    if(!list.length){ box.innerHTML = '<div class="card"><div class="empty-state">No card requests yet.</div></div>'; return; }
    box.innerHTML = '<div class="card"><div class="card-title"><i class="fa-solid fa-credit-card"></i> Card Requests '+(n?'<span class="pill pill-amber">'+n+' pending</span>':'')+'</div>' +
      dt([
        {l:'User',w:'minmax(0,1.3fr)',cls:'first'},{l:'Card',w:'minmax(0,1.5fr)'},{l:'Purpose',w:'minmax(0,1.5fr)'},
        {l:'Status',w:'90px'},{l:'Received',w:'minmax(0,1.1fr)'},{l:'',w:'190px',cls:'act'}
      ], list.map(function(r){
        var where = r.cardType === 'Physical' ? '<span class="sub">'+esc([r.address,r.city,r.country].filter(Boolean).join(', '))+'</span>' : '';
        return [
          '<span class="strong">'+esc(r.name||'—')+'</span><span class="sub mono">@'+esc(r.username||'')+'</span>',
                    '<b>'+esc(r.cardBrand||'')+' '+esc(r.cardType)+'</b> · '+esc(r.nameOnCard)+'<span class="sub">'+esc(r.phone)+'</span>'+where,
          esc(r.purpose),
          '<span class="status-chip '+(CLS[r.status]||'')+'">'+esc(r.status)+'</span>',
          '<span class="muted">'+fmtDate(r.createdAt)+'</span>',
          actionsFor('cards', r)
        ];
      })) + '</div>';
  };

  window.renderUpgradeRequests = async function(){
    var box = document.getElementById('view-upgrades'), list = [];
    try{ list = await api('/admin/upgrades'); }
    catch(e){ box.innerHTML = '<div class="card"><div class="empty-state">Could not load upgrade requests. Make sure cards-upgrade-routes.js is installed.</div></div>'; return; }
    DATA.upgrades = list;
    var n = list.filter(function(x){ return x.status === 'pending'; }).length;
    setBadge('upgBadge', n);
    if(!list.length){ box.innerHTML = '<div class="card"><div class="empty-state">No upgrade requests yet.</div></div>'; return; }
    box.innerHTML = '<div class="card"><div class="card-title"><i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Requests '+(n?'<span class="pill pill-amber">'+n+' pending</span>':'')+'</div>' +
      dt([
        {l:'User',w:'minmax(0,1.3fr)',cls:'first'},{l:'Level',w:'minmax(0,1fr)'},{l:'Reason',w:'minmax(0,1.6fr)'},
        {l:'Status',w:'90px'},{l:'Received',w:'minmax(0,1.1fr)'},{l:'',w:'190px',cls:'act'}
      ], list.map(function(r){
        return [
          '<span class="strong">'+esc(r.name||'—')+'</span><span class="sub mono">@'+esc(r.username||'')+'</span>',
          '<b>'+esc(r.tier)+'</b>',
          esc(r.reason||'—'),
          '<span class="status-chip '+(CLS[r.status]||'')+'">'+esc(r.status)+'</span>',
          '<span class="muted">'+fmtDate(r.createdAt)+'</span>',
          actionsFor('upgrades', r)
        ];
      })) + '</div>';
  };

  window.reqDecide = function(kind, id, action){
    var approve = action === 'approve';
    openModal(
      '<h3>'+(approve?'Approve':'Reject')+' request</h3>' +
      '<p class="muted" style="font-size:13px;">'+(approve?'Optional message shown to the user with the approval.':'This message is shown to the user on their dashboard.')+'</p>' +
      '<div class="field"><label>Message '+(approve?'(optional)':'')+'</label><textarea id="reqMsg" rows="4" placeholder="'+(approve?'e.g. Your request has been approved.':'e.g. We could not verify the delivery address. Please request again with a valid address.')+'"></textarea></div>' +
      '<button class="btn '+(approve?'btn-primary':'btn-danger')+' btn-block" onclick="reqSubmit(\''+kind+'\',\''+id+'\',\''+action+'\')">'+(approve?'Approve':'Reject &amp; Send Message')+'</button>');
  };
  window.reqSubmit = async function(kind, id, action){
    var message = document.getElementById('reqMsg').value.trim();
    if(action === 'reject' && !message){ toast('Please write a message','err'); return; }
    try{
      await api('/admin/'+kind+'/'+id+'/'+action, { method:'POST', body:{ message:message } });
      closeModal();
      toast(action === 'approve' ? 'Approved' : 'Rejected and message sent','ok');
      if(kind === 'cards') await renderCardRequests(); else await renderUpgradeRequests();
    }catch(e){ toast(e.message,'err'); }
  };
})();