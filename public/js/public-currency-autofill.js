/* public-currency-autofill.js: replaces the typed "currencies" box with checkboxes (same
   currencies as the admin form). Picking a country ticks the 5 majors, the local currency
   and all crypto. The visitor can still tick or untick, but never types. */
(function(){
  var MAJORS = ['USD','EUR','CAD','AUD','GBP'];
  // KEEP THIS IN SYNC with the coins in the admin page (REF.coins)
  var CRYPTO = ['BTC','ETH','USDT','USDC','BNB','XRP','SOL','ADA','DOGE','LTC','TRX','DOT'];

  function init(){
    var res = document.getElementById('residence');
    var cur = document.getElementById('currencies');
    if (!res || !cur || !window.currencyForCountry) return;

    // full fiat list = majors + every currency in the country map
    var fiat = MAJORS.slice();
    var map = window.COUNTRY_CURRENCY_MAP || {};
    Object.keys(map).forEach(function(k){
      if (fiat.indexOf(map[k]) === -1) fiat.push(map[k]);
    });

    // hide the text box but keep it as the value the form already submits
    cur.type = 'hidden';
    cur.removeAttribute('required');

    var box = document.createElement('div');
    box.id = 'currencyPicker';
    cur.parentNode.insertBefore(box, cur.nextSibling);

    function group(title, list){
      var h = '<div style="font-weight:600;margin:10px 0 6px">' + title + '</div>' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px">';
      list.forEach(function(code){
        h += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
             '<input type="checkbox" name="pub_currency" value="' + code + '"> ' + code + '</label>';
      });
      return h + '</div>';
    }
    box.innerHTML = group('Currencies', fiat) + group('Crypto', CRYPTO);

    var boxes = box.querySelectorAll('input[name="pub_currency"]');

    function sync(){
      var picked = [];
      boxes.forEach(function(cb){ if (cb.checked) picked.push(cb.value); });
      cur.value = picked.join(', ');
      cur.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function autofill(){
      var want = MAJORS.slice();
      var local = window.currencyForCountry(res.value);
      if (local && want.indexOf(local) === -1) want.push(local);
      CRYPTO.forEach(function(c){ want.push(c); });
      boxes.forEach(function(cb){
        if (want.indexOf(cb.value) !== -1) cb.checked = true;
      });
      sync();
    }

    box.addEventListener('change', sync);
        // when the form is reset after submit, clear boxes and the hidden value together
    var form = cur.closest('form');
    if (form) form.addEventListener('reset', function(){ setTimeout(sync, 0); });

    var timer;
    res.addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(autofill, 600); });
    res.addEventListener('change', autofill);
    res.addEventListener('blur', autofill);

    // keep anything already in the field (e.g. restored form data)
    var existing = cur.value.split(/[,\s]+/).map(function(s){ return s.toUpperCase(); });
    boxes.forEach(function(cb){ if (existing.indexOf(cb.value) !== -1) cb.checked = true; });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
