(function(){
  var anchor = document.querySelector('.nav-item[data-view="upgrades"]') || document.querySelector('.nav-item[data-view="users"]');
  if(anchor && !document.querySelector('.nav-item[data-view="transfers"]')){
    var it = document.createElement('div'); it.className = 'nav-item'; it.setAttribute('data-view','transfers');
    it.innerHTML = '<span class="ic"><i class="fa-solid fa-paper-plane"></i></span> Transfers';
    it.addEventListener('click', function(){ nav('transfers'); });
    anchor.parentNode.insertBefore(it, anchor.nextSibling);
  }
  if(!document.getElementById('view-transfers')){
    var b = document.createElement('div'); b.id = 'view-transfers'; b.className = 'hidden';
    document.getElementById('view-users').parentNode.appendChild(b);
  }
  var CLS = { pending:'status-pending', approved:'status-approved', rejected:'status-rejected' };
  window.renderTransferRequests = async function(){
    var box = document.getElementById('view-transfers'), list = [];
    try{ list = await api('/admin/transfers'); }catch(e){ box.innerHTML = '<div class="card"><div class="empty-state">Could not load transfers.</div></div>'; return; }
    if(!list.length){ box.innerHTML = '<div class="card"><div class="empty-state">No transfer requests yet.</div></div>'; return; }
    box.innerHTML = '<div class="card"><div class="card-title"><i class="fa-solid fa-paper-plane"></i> Transfer Requests (Demo)</div>' + dt([
      {l:'User',w:'minmax(0,1.3fr)',cls:'first'},{l:'Method',w:'minmax(0,.9fr)'},{l:'Recipient',w:'minmax(0,1.6fr)'},
      {l:'Amount',w:'minmax(0,.9fr)'},{l:'Status',w:'90px'},{l:'',w:'190px',cls:'act'}
    ], list.map(function(r){
      var act = r.status === 'pending'
        ? '<button class="btn btn-primary btn-sm" onclick="trDecide(\''+r.id+'\',\'approve\')">Approve</button> <button class="btn btn-danger btn-sm" onclick="trDecide(\''+r.id+'\',\'reject\')">Reject</button>'
        : '<span class="sub">'+esc(r.adminMessage||'')+'</span>';
      return ['<span class="strong">'+esc(r.name||'—')+'</span><span class="sub mono">@'+esc(r.username||'')+'</span>',
        esc(r.method), esc(r.recipient)+'<span class="sub">'+esc(r.details||'')+'</span>', fmtUSD(r.amount),
        '<span class="status-chip '+(CLS[r.status]||'')+'">'+esc(r.status)+'</span>', act];
    })) + '</div>';
  };
  window.trDecide = function(id, action){
    openModal('<h3>'+(action==='approve'?'Approve':'Reject')+' transfer</h3><div class="field"><label>Message'+(action==='approve'?' (optional)':'')+'</label><textarea id="trMsg" rows="4"></textarea></div>' +
      '<button class="btn btn-primary btn-block" onclick="trSubmit(\''+id+'\',\''+action+'\')">Send</button>');
  };
  window.trSubmit = async function(id, action){
    var message = document.getElementById('trMsg').value.trim();
    if(action==='reject' && !message){ toast('Please write a message','err'); return; }
    try{ await api('/admin/transfers/'+id+'/'+action, { method:'POST', body:{ message:message } }); closeModal(); toast('Done','ok'); await renderTransferRequests(); }
    catch(e){ toast(e.message,'err'); }
  };
})();