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

  function item(r){
    var s = r.status === 'approved'
      ? '<div class="reject-banner" style="'+OK+'margin-top:10px;"><i class="fa-solid fa-circle-check"></i> <b>Approved.</b> '+esc(r.adminMessage||'')+'</div>'
      : r.status === 'rejected'
      ? '<div class="reject-banner" style="'+BAD+'margin-top:10px;font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> <b>Rejected:</b> '+esc(r.adminMessage||'')+'</div>'
      : '<div style="margin-top:10px;"><span class="pill pill-amber"><i class="fa-solid fa-clock"></i> Under review</span></div>';
    return '<div style="padding:14px 0;border-bottom:1px solid var(--border,#e6e8ef);"><div class="row gap-8" style="justify-content:space-between;"><div><b>'+esc(r.method)+'</b> · '+fmtUSD(r.amount)+'</div><div class="muted" style="font-size:12.5px;">'+fmtDate(r.createdAt)+'</div></div><div class="muted" style="font-size:13px;margin-top:4px;">'+esc(r.recipient)+'</div><div class="muted" style="font-size:12.5px;margin-top:2px;">'+esc(r.details||'')+'</div>'+s+'</div>';
  }

  function fieldsHTML(method){
    if(method === 'Bank'){
      return '' +
        '<div class="field"><label>Beneficiary Name</label><input id="trBenefName" maxlength="100" placeholder="Your full legal name"></div>' +
        '<div class="field"><label>Bank Name</label><input id="trBankName" maxlength="60" placeholder="Your bank\'s name"></div>' +
        '<div class="field"><label>Account Number</label><input id="trAcctNumber" maxlength="34" placeholder="Your account number"></div>' +
        '<div class="field"><label>SWIFT/BIC Code</label><input id="trSwift" maxlength="20" placeholder="Your bank\'s SWIFT code"></div>' +
        '<div class="field"><label>Bank Address</label><input id="trBankAddress" maxlength="150" placeholder="Bank\'s official branch address"></div>' +
        '<div class="field"><label>Currency</label><input id="trCurrency" value="USD" readonly></div>';
    }
    if(method === 'Crypto'){
      return '' +
        '<div class="field"><label>Coin and network (e.g. BTC / Bitcoin)</label><input id="trRecipient" maxlength="120"></div>' +
        '<div class="field"><label>Wallet address (use a fake one)</label><input id="trDetails" maxlength="300"></div>';
    }
    return '' +
      '<div class="field"><label>Card holder name</label><input id="trRecipient" maxlength="120"></div>' +
      '<div class="field"><label>Last 4 digits only (fake)</label><input id="trDetails" maxlength="300"></div>';
  }

  window.renderTransfer = async function(){
    var d = { upgraded:false, list:[] };
    try{ d = await api('/user/transfers'); }catch(e){ toast('Could not load transfers: '+e.message,'err'); }
    document.getElementById('view-transfer').innerHTML =
      '<div class="card" style="max-width:520px;margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-paper-plane"></i> Transfer</div>' +
      '<div class="warn-box"><i class="fa-solid fa-flask"></i> <b>Transfer:</b> Send and receive money.</div>' +
      '<div class="field" style="margin-top:12px;"><label>Method</label><select id="trMethod" onchange="trMethodChanged()"><option>Bank</option><option>Crypto</option><option>Credit Card</option></select></div>' +
      '<div id="trFields"></div>' +
      '<div class="field"><label>Amount (USD)</label><input id="trAmount" type="number" min="0" step="0.01"></div>' +
      '<button class="btn btn-primary btn-block" onclick="submitTransfer()">Proceed</button></div>' +
      '<div class="card" style="max-width:720px;"><div class="card-title"><i class="fa-solid fa-list"></i> My Transfer Requests</div>' +
      (d.list.length ? d.list.map(item).join('') : '<div class="empty-state">No transfer requests yet.</div>') + '</div>';
    trMethodChanged();
  };
  window.trMethodChanged = function(){
    document.getElementById('trFields').innerHTML = fieldsHTML(document.getElementById('trMethod').value);
  };
  window.submitTransfer = async function(){
    var method = document.getElementById('trMethod').value;
    var v = function(i){ var el = document.getElementById(i); return el ? el.value.trim() : ''; };
    var amount = parseFloat(v('trAmount'));
    var recipient, details;
    if(method === 'Bank'){
      var benefName = v('trBenefName'), bankName = v('trBankName'), acct = v('trAcctNumber'),
          swift = v('trSwift'), addr = v('trBankAddress'), currency = v('trCurrency') || 'USD';
      if(!benefName || !bankName || !acct || !swift || !addr){ toast('Please complete all bank details','err'); return; }
      recipient = benefName;
      details = 'Bank: '+bankName+' | Acct: '+acct+' | SWIFT: '+swift+' | Address: '+addr+' | Currency: '+currency;
    } else {
      recipient = v('trRecipient'); details = v('trDetails');
      if(!recipient){ toast('Fill in the recipient','err'); return; }
    }
    if(!(amount > 0)){ toast('Enter a valid amount','err'); return; }
    try{
      await api('/user/transfers', { method:'POST', body:{ method:method, recipient:recipient, details:details, amount:amount } });
      toast('Transfer under review','ok'); await renderTransfer();
    }catch(e){
      if(e.data && e.data.needUpgrade){
        openModal('<h3>Upgrade your account first</h3><p class="muted">Transfers need an approved upgrade.</p>' +
          '<button class="btn btn-primary btn-block" onclick="closeModal();nav(\'upgrade\')">Go to Upgrade</button>');
      } else toast(e.message,'err');
    }
  };
})();
