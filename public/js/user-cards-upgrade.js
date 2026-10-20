/* user-cards-upgrade.js — include in user.html AFTER user-loans-kyc.js. */
(function(){
  /* ---- sidebar items + page containers ---- */
  var anchor = document.querySelector('.nav-item[data-view="kyc"]');
  function addNav(key, icon, label){
    if(!anchor || document.querySelector('.nav-item[data-view="'+key+'"]')) return;
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('data-view', key);
    item.innerHTML = '<span class="ic"><i class="'+icon+'"></i></span> '+label;
    item.addEventListener('click', function(){ nav(key); });
    anchor.parentNode.insertBefore(item, anchor);
  }
  addNav('cards', 'fa-solid fa-credit-card', 'Card Request');
  addNav('upgrade', 'fa-solid fa-arrow-up-right-dots', 'Upgrade');
  ['view-cards','view-upgrade'].forEach(function(id){
    if(!document.getElementById(id)){
      var box = document.createElement('div');
      box.id = id; box.className = 'hidden';
      document.getElementById('view-support').parentNode.appendChild(box);
    }
  });

  var OK_STYLE = 'border-color:#bfe3cd;background:#e9f6ee;color:#1e7a46;';
  var BAD_STYLE = 'border-color:#f2c9d0;background:#fdf2f4;color:#b4233a;';
  var TIERS = [
    ['Standard', 'Everyday account access.'],
    ['Premium', 'For customers who need more from their account. Details are confirmed by our team on approval.'],
    ['Business', 'For business use. Details are confirmed by our team on approval.']
  ];
  var CACHE = {};

  function statusBlock(r, kind, approvedText, againFn){
    if(r.status === 'approved'){
      return '<div class="reject-banner" style="'+OK_STYLE+'margin-top:10px;"><i class="fa-solid fa-circle-check"></i> <b>Approved!</b> '+esc(approvedText)+
        (r.adminMessage ? '<div style="margin-top:6px;">'+esc(r.adminMessage)+'</div>' : '')+'</div>';
    }
    if(r.status === 'rejected'){
      return '<div class="reject-banner" style="'+BAD_STYLE+'margin-top:10px;font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> <b>Rejected:</b> '+esc(r.adminMessage||'No reason was given.')+'</div>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="'+againFn+'(\''+esc(r.id)+'\')"><i class="fa-solid fa-rotate-right"></i> Request Again</button>';
    }
    return '<div style="margin-top:10px;"><span class="pill pill-amber"><i class="fa-solid fa-clock"></i> Under review</span></div>';
  }
  function cardItem(r){
    CACHE['c'+r.id] = r;
    return '<div style="padding:14px 0;border-bottom:1px solid var(--border,#e6e8ef);">' +
           '<div class="row gap-8" style="justify-content:space-between;"><div><b>'+esc(r.cardBrand||'')+' '+esc(r.cardType)+' card</b> · '+esc(r.nameOnCard)+'</div><div class="muted" style="font-size:12.5px;">'+fmtDate(r.createdAt)+'</div></div>' +
      '<div class="muted" style="font-size:13px;margin-top:4px;">'+esc(r.purpose)+'</div>' +
      statusBlock(r, 'cards', 'Your card request has been approved.', 'cardReapply') + '</div>';
  }
  function upgItem(r){
    CACHE['u'+r.id] = r;
    return '<div style="padding:14px 0;border-bottom:1px solid var(--border,#e6e8ef);">' +
      '<div class="row gap-8" style="justify-content:space-between;"><div><b>Upgrade to '+esc(r.tier)+'</b></div><div class="muted" style="font-size:12.5px;">'+fmtDate(r.createdAt)+'</div></div>' +
      (r.reason ? '<div class="muted" style="font-size:13px;margin-top:4px;">'+esc(r.reason)+'</div>' : '') +
      statusBlock(r, 'upgrades', 'Your upgrade to '+r.tier+' has been approved.', 'upgReapply') + '</div>';
  }

  /* ---------------- Card request page ---------------- */
  window.renderCards = async function(){
    var list = [], u = {};
    try{ list = await api('/user/cards'); }catch(e){ console.error(e); toast('Could not load your card requests: '+e.message,'err'); }
    try{ u = await api('/user/me'); }catch(e){}
    document.getElementById('view-cards').innerHTML =
      '<div class="card" style="max-width:520px;margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-credit-card"></i> Request a Card</div>' +
        '<p class="muted" style="font-size:13px;">Request a card for your online transfers and transactions. Our team reviews every request. Never enter a card number, CVV or PIN here: we do not ask for them.</p>' +
        '<div class="field"><label>Card network</label><select id="cardBrand"><option>Visa</option><option>Mastercard</option></select></div>' +
        '<div class="field"><label>Card type</label><select id="cardType" onchange="cardTypeChanged()"><option>Virtual</option><option>Physical</option></select></div>' +
        '<div class="field"><label>Name to appear on the card</label><input id="cardName" maxlength="60" value="'+esc(u.name||'')+'"></div>' +
        '<div class="field"><label>Phone number</label><input id="cardPhone" maxlength="30" value="'+esc(u.phoneNumber||'')+'"></div>' +
        '<div id="cardAddrWrap" class="hidden">' +
          '<div class="field"><label>Delivery address</label><input id="cardAddress" maxlength="200"></div>' +
          '<div class="field"><label>City</label><input id="cardCity" maxlength="80"></div>' +
          '<div class="field"><label>Country</label><input id="cardCountry" maxlength="80"></div>' +
        '</div>' +
        '<div class="field"><label>What will you use the card for?</label><input id="cardPurpose" maxlength="300" placeholder="e.g. Online transfers and payments"></div>' +
        '<button class="btn btn-primary btn-block" onclick="submitCard()"><i class="fa-solid fa-paper-plane"></i> Send Request</button>' +
      '</div>' +
      '<div class="card" style="max-width:720px;"><div class="card-title"><i class="fa-solid fa-list"></i> My Card Requests</div>' +
        (list.length ? list.map(cardItem).join('') : '<div class="empty-state">You have not requested a card yet.</div>') + '</div>';
  };
  window.cardTypeChanged = function(){
    document.getElementById('cardAddrWrap').classList.toggle('hidden', document.getElementById('cardType').value !== 'Physical');
  };
  window.submitCard = async function(){
    var v = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var body = { cardBrand:v('cardBrand'), cardType:v('cardType'), nameOnCard:v('cardName'), phone:v('cardPhone'),
      address:v('cardAddress'), city:v('cardCity'), country:v('cardCountry'), purpose:v('cardPurpose') };
    if(!body.cardBrand || !body.nameOnCard || !body.phone || !body.purpose){ toast('Please complete all required fields','err'); return; }
    if(body.cardType === 'Physical' && (!body.address || !body.city || !body.country)){ toast('Enter a delivery address for a physical card','err'); return; }
    try{
      await api('/user/cards', { method:'POST', body:body });
      toast('Card request sent to our team','ok');
      await renderCards();
    }catch(e){ toast(e.message,'err'); }
  };
  window.cardReapply = async function(id){
    var r = CACHE['c'+id];
    await nav('cards');
    if(!r) return;
    var set = function(elId, val){ var el = document.getElementById(elId); if(el && val != null) el.value = val; };
       set('cardBrand', r.cardBrand); set('cardType', r.cardType); cardTypeChanged();
    set('cardName', r.nameOnCard); set('cardPhone', r.phone); set('cardPurpose', r.purpose);
    set('cardAddress', r.address); set('cardCity', r.city); set('cardCountry', r.country);
    document.getElementById('cardType').scrollIntoView({ behavior:'smooth', block:'center' });
    toast('Your previous details are filled in. Adjust them and send again.','ok');
  };

  /* ---------------- Upgrade page ---------------- */
  window.renderUpgrade = async function(){
    var list = [];
    try{ list = await api('/user/upgrades'); }catch(e){ console.error(e); toast('Could not load your upgrade requests: '+e.message,'err'); }
    var pending = list.some(function(x){ return x.status === 'pending'; });
    document.getElementById('view-upgrade').innerHTML =
      '<div class="card" style="max-width:520px;margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Your Account</div>' +
        '<p class="muted" style="font-size:13px;">Choose a level and send an upgrade request. Our team will approve it or reply with a message.</p>' +
        '<div class="field"><label>Upgrade to</label><select id="upgTier">'+TIERS.map(function(t){ return '<option>'+t[0]+'</option>'; }).join('')+'</select></div>' +
        '<ul class="muted" style="font-size:13px;line-height:1.7;padding-left:18px;margin:0 0 12px;">'+TIERS.map(function(t){ return '<li><b>'+t[0]+':</b> '+esc(t[1])+'</li>'; }).join('')+'</ul>' +
        '<div class="field"><label>Reason <span class="muted" style="font-weight:500;">(optional)</span></label><input id="upgReason" maxlength="300"></div>' +
        (pending ? '<div class="warn-box"><i class="fa-solid fa-hourglass-half"></i> You have an upgrade request under review.</div>'
                 : '<button class="btn btn-primary btn-block" onclick="submitUpgrade()"><i class="fa-solid fa-arrow-up-right-dots"></i> Request Upgrade</button>') +
      '</div>' +
      '<div class="card" style="max-width:720px;"><div class="card-title"><i class="fa-solid fa-list"></i> My Upgrade Requests</div>' +
        (list.length ? list.map(upgItem).join('') : '<div class="empty-state">You have not requested an upgrade yet.</div>') + '</div>';
  };
  window.submitUpgrade = async function(){
    var body = { tier:document.getElementById('upgTier').value, reason:document.getElementById('upgReason').value.trim() };
    try{
      await api('/user/upgrades', { method:'POST', body:body });
      toast('Upgrade request sent to our team','ok');
      await renderUpgrade();
    }catch(e){ toast(e.message,'err'); }
  };
  window.upgReapply = async function(id){
    var r = CACHE['u'+id];
    await nav('upgrade');
    if(!r) return;
    var t = document.getElementById('upgTier'), why = document.getElementById('upgReason');
    if(t) t.value = r.tier;
    if(why) why.value = r.reason || '';
    toast('Your previous request is filled in. Adjust it and send again.','ok');
  };

  /* ---------------- Dashboard notices ---------------- */
  async function dashNotices(){
    var cards = [], upgs = [], html = '';
    try{ cards = await api('/user/cards'); }catch(e){}
    try{ upgs = await api('/user/upgrades'); }catch(e){}
    if(cards.length){
      html += '<div class="card" style="margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-credit-card"></i> Card Request ' +
        '<a href="#" onclick="nav(\'cards\');return false;" style="margin-left:auto;font-size:12.5px;">View all</a></div>' + cardItem(cards[0]) + '</div>';
    }
    if(upgs.length){
      html += '<div class="card" style="margin-bottom:18px;"><div class="card-title"><i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Request ' +
        '<a href="#" onclick="nav(\'upgrade\');return false;" style="margin-left:auto;font-size:12.5px;">View all</a></div>' + upgItem(upgs[0]) + '</div>';
    }
    if(html) document.getElementById('view-dashboard').insertAdjacentHTML('afterbegin', html);
  }
  var baseDashboard = window.renderDashboard;
  window.renderDashboard = async function(){
    await baseDashboard.apply(this, arguments);
    try{ await dashNotices(); }catch(e){ console.error('Dashboard notices failed', e); }
  };
})();