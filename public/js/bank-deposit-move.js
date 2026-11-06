/* bank-deposit-move.js: moves the "International Receiving Accounts" cards off the dashboard
   and into Deposit > Bank Deposit (account dropdown, details shown after selecting). */
(function(){
  var STASH = {}, ORDER = [], busy = false, obs = null;
  var RE_LABEL = /^\s*([A-Z]{3}) Receiving Account\s*$/;

  function hideEl(el){ el.style.display = 'none'; el.setAttribute('data-recv', '1'); }
  function allHidden(el){
    var k = el.children; if(!k.length) return false;
    for(var i = 0; i < k.length; i++){ if(k[i].style.display !== 'none') return false; }
    return true;
  }

  function captureDashboard(){
    var dash = document.getElementById('view-dashboard');
    if(!dash) return false;
    var changed = false, labels = [], n, walker = document.createTreeWalker(dash, NodeFilter.SHOW_TEXT, null);
    while((n = walker.nextNode())){
      var m = RE_LABEL.exec(n.nodeValue);
      if(m && n.parentNode) labels.push([m[1], n.parentNode]);
    }
    labels.forEach(function(l){
      var node = l[1];
      if(node.closest('[data-recv]')) return;
      var card = node;
      while(card && card !== dash && !/Account number|Bank \/ Provider/i.test(card.textContent)) card = card.parentNode;
      if(!card || card === dash || card.closest('[data-recv]')) return;
      if(!STASH[l[0]]) ORDER.push(l[0]);
      STASH[l[0]] = card.outerHTML;
      hideEl(card);
      changed = true;
      var p = card.parentNode;
      while(p && p !== dash && allHidden(p)){ hideEl(p); p = p.parentNode; }
    });
    var w2 = document.createTreeWalker(dash, NodeFilter.SHOW_TEXT, null), t;
    while((t = w2.nextNode())){
      var par = t.parentNode;
      if(par && par !== dash && /^\s*International Receiving Accounts\s*$/i.test(t.nodeValue) &&
         !par.closest('[data-recv]') && par.textContent.trim().length < 60){
        hideEl(par);
      }
    }
    return changed;
  }

  function refreshOptions(){
    var sel = document.getElementById('bankDepSelect'), det = document.getElementById('bankDepDetails');
    if(!sel || !det) return;
    var keep = sel.value;
    if(!ORDER.length){
      sel.innerHTML = '<option value="">No accounts available</option>';
      det.innerHTML = '<div class="warn-box"><i class="fa-solid fa-triangle-exclamation"></i> No bank deposit accounts have been set up for you yet.</div>';
      return;
    }
    sel.innerHTML = '<option value="">Select an account...</option>' + ORDER.map(function(c){
      return '<option value="' + c + '"' + (c === keep ? ' selected' : '') + '>' + c + ' Bank Account</option>';
    }).join('');
    det.innerHTML = keep && STASH[keep] ? STASH[keep] : '';
  }

  function injectDeposit(){
    var v = document.getElementById('view-deposit');
    if(!v || v.querySelector('#bankDepTabs')) return;
    var crypto = v.querySelector(':scope > .card') || v.firstElementChild;
    if(!crypto) return;
    crypto.insertAdjacentHTML('beforebegin',
      '<div id="bankDepTabs" style="max-width:520px;display:flex;gap:8px;margin-bottom:14px;">' +
      '<button type="button" class="btn btn-primary btn-sm" id="depTabCrypto"><i class="fa-solid fa-coins"></i> Crypto Deposit</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="depTabBank"><i class="fa-solid fa-building-columns"></i> Bank Deposit</button></div>');
    crypto.insertAdjacentHTML('afterend',
      '<div id="bankDepWrap" class="card" style="max-width:520px;display:none;">' +
      '<div class="card-title"><i class="fa-solid fa-building-columns"></i> Bank Deposit</div>' +
      '<p class="muted" style="font-size:13px;">Choose the account you want to deposit into to see its bank details.</p>' +
      '<div class="field"><label>Account</label><select id="bankDepSelect"></select></div>' +
      '<div id="bankDepDetails"></div>' +
      '<div class="hint" style="margin-top:10px;"><b>Demo:</b> these account details are simulated. No real funds are involved.</div></div>');
    var tc = document.getElementById('depTabCrypto'), tb = document.getElementById('depTabBank'),
        wrap = document.getElementById('bankDepWrap'), sel = document.getElementById('bankDepSelect'),
        det = document.getElementById('bankDepDetails');
    function show(bank){
      crypto.style.display = bank ? 'none' : '';
      wrap.style.display = bank ? '' : 'none';
      tc.className = 'btn btn-sm ' + (bank ? 'btn-outline' : 'btn-primary');
      tb.className = 'btn btn-sm ' + (bank ? 'btn-primary' : 'btn-outline');
    }
    tc.addEventListener('click', function(){ show(false); });
    tb.addEventListener('click', function(){ show(true); });
    sel.addEventListener('change', function(){ det.innerHTML = sel.value && STASH[sel.value] ? STASH[sel.value] : ''; });
    refreshOptions();
  }

  function work(){
    if(busy) return;
    busy = true;
    if(obs) obs.disconnect();
    try{
      var changed = captureDashboard();
      injectDeposit();
      if(changed) refreshOptions();
    }catch(e){ console.error('bank-deposit-move', e); }
    if(obs) obs.observe(document.body, { childList: true, subtree: true });
    busy = false;
  }
  obs = new MutationObserver(work);
  obs.observe(document.body, { childList: true, subtree: true });
  work();
})();
