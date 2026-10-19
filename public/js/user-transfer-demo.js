(function(){
  var anchor = document.querySelector('.nav-item[data-view="kyc"]');
  if(anchor && !document.querySelector('.nav-item[data-view="transfer"]')){
    var it = document.createElement('div'); it.className = 'nav-item'; it.setAttribute('data-view','transfer');
    it.innerHTML = '<span class="ic"><i class="fa-solid fa-paper-plane"></i></span> Transfer';
    it.addEventListener('click', function(){ nav('transfer'); });
    anchor.parentNode.insertBefore(it, anchor);
  }
  if(!document.getElementById('view-transfer')){
    var b = document.createElement('div'); b.id = 'view-transfer'; b.className = 'hidden';
    document.getElementById('view-support').parentNode.appendChild(b);
  }
  var OK = 'border-color:#bfe3cd;background:#e9f6ee;color:#1e7a46;', BAD = 'border-color:#f2c9d0;background:#fdf2f4;color:#b4233a;';
  var LABELS = {
    'Crypto':[['Coin and network (e.g. BTC / Bitcoin)'],['Wallet address (use a fake one)']],
    'Bank':[['Bank name'],['Account holder and number (fake values)']],
    'Credit Card':[['Card holder name'],['Last 4 digits only (fake)']]
  };
  function item(r){
    var s = r.status === 'approved'
      ? '<div class="reject-banner" style="'+OK+'margin-top:10px;"><i class="fa-solid fa-circle-check"></i> <b>Approved.</b> '+esc(r.adminMessage||'')+'</div>'
      : r.status === 'rejected'
      ? '<div class="reject-banner" style="'+BAD+'margin-top:10px;font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> <b>Rejected:</b> '+esc(r.adminMessage||'')+'</div>'
      : '<div style="margin-top:10px;"><span class="pill pill-amber"><i class="fa-solid fa-clock"></i> Under review</span></div>';
    return '<div style="padding:14px 0;border-bottom:1px solid var(--border,#e6e8ef);"><div class="row gap-8" style="justify-content:space-between;"><div><b>'+esc(r.method)+'</b> · '+fmtUSD(r.amount)+'</div><div class="muted" style="font-size:12.5px;">'+fmtDate(r.createdAt)+'</div></div><div class="muted" style="font-size:13px;margin-top:4px;">'+esc(r.recipient)+'</div>'+s+'</div>';
  }
  window.renderTransfer = async function(){
    var d = { upgraded:false, list:[] };
    try{ d = await api('/user/transfers'); }catch(e){ toast('Could not load transfers: '+e.message,'err'); }
    document.getElementById('view-transfer').innerHTML =
      '<div class="card" style="max-width:520px;margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-paper-plane"></i> Transfer </div>' +
      '<div class="warn-box"><i class="fa-solid fa-flask"></i> <b>Tranfer:</b> Send And Receivw Money.</div>' +
      '<div class="field" style="margin-top:12px;"><label>Method</label><select id="trMethod" onchange="trMethodChanged()"><option>Crypto</option><option>Bank</option><option>Credit Card</option></select></div>' +
      '<div class="field"><label id="trL1"></label><input id="trRecipient" maxlength="120"></div>' +
      '<div class="field"><label id="trL2"></label><input id="trDetails" maxlength="300"></div>' +
      '<div class="field"><label>Amount (USD, simulated)</label><input id="trAmount" type="number" min="0" step="0.01"></div>' +
      '<button class="btn btn-primary btn-block" onclick="submitTransfer()">Proceed</button></div>' +
      '<div class="card" style="max-width:720px;"><div class="card-title"><i class="fa-solid fa-list"></i> My Transfer Requests</div>' +
      (d.list.length ? d.list.map(item).join('') : '<div class="empty-state">No transfer requests yet.</div>') + '</div>';
    trMethodChanged();
  };
  window.trMethodChanged = function(){
    var l = LABELS[document.getElementById('trMethod').value];
    document.getElementById('trL1').textContent = l[0][0];
    document.getElementById('trL2').textContent = l[1][0];
  };
  window.submitTransfer = async function(){
    var v = function(i){ return document.getElementById(i).value.trim(); };
    var body = { method:v('trMethod'), recipient:v('trRecipient'), details:v('trDetails'), amount:parseFloat(v('trAmount')) };
    if(!body.recipient || !(body.amount > 0)){ toast('Fill in the recipient and amount','err'); return; }
    try{
      await api('/user/transfers', { method:'POST', body:body });
      toast(' transfer under review','ok'); await renderTransfer();
    }catch(e){
      if(e.data && e.data.needUpgrade){
        openModal('<h3>Upgrade your account first</h3><p class="muted">transfers need an approved upgrade.</p>' +
          '<button class="btn btn-primary btn-block" onclick="closeModal();nav(\'upgrade\')">Go to Upgrade</button>');
      } else toast(e.message,'err');
    }
  };
})();