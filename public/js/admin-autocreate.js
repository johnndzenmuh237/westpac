/* admin-autocreate.js: "Create client account" on an application pre-fills the form with the
   applicant's details and currencies, ticks consent, and submits it automatically. */
(function(){
  var orig = window.createFromApplication;
  if (typeof orig !== 'function') return;

  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function applicationById(id){
    try {
      if (typeof APPS !== 'undefined' && typeof appId === 'function') {
        return APPS.find(function(x){ return String(appId(x)) === String(id); });
      }
    } catch(e){}
    return null;
  }

  // add checkboxes for applicant currencies that the admin form does not list
  function ensureCurrencies(codes){
    var boxes = document.querySelectorAll('input[name="cf_currency"]');
    if (!boxes.length) return;
    var have = {};
    boxes.forEach(function(b){ have[b.value.toUpperCase()] = b; });
    var group = boxes[boxes.length - 1].closest('.chip-group') || boxes[boxes.length - 1].parentNode.parentNode;
    codes.forEach(function(code){
      if (!have[code]) {
        var label = document.createElement('label');
        label.className = 'chip';
        label.innerHTML = '<input type="checkbox" name="cf_currency" value="' + code + '"> ' + code;
        group.appendChild(label);
        have[code] = label.querySelector('input');
      }
      have[code].checked = true;
    });
  }

  function findCreateButton(){
    var anchor = document.getElementById('cf_consentTerms');
    if (!anchor) return null;
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++){
      var b = buttons[i];
      var after = anchor.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
      var txt = (b.textContent || '').trim();
      if (after && /create|open|submit|save/i.test(txt) && !/cancel|reset|clear/i.test(txt)) return b;
    }
    return null;
  }

  window.createFromApplication = async function(id){
    var a = applicationById(id);
    await orig(id);               // existing pre-fill (navigates to the form and fills it)
    await wait(300);

    if (a) {
      var wanted = String(a.currencies || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
      ensureCurrencies(wanted);
    }

    var c1 = document.getElementById('cf_consentAccuracy');
    var c2 = document.getElementById('cf_consentTerms');
    if (c1) c1.checked = true;
    if (c2) c2.checked = true;

    await wait(200);
    var btn = findCreateButton();
    if (btn) btn.click();
    else if (typeof toast === 'function') toast('Form filled. Press the create button to finish.', 'ok');
  };
})();
