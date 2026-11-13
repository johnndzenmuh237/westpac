/* admin-currency-autofill.js: auto-selects the 5 major currencies plus the user's local
   currency and all crypto, whenever a country is chosen on the Create/Edit User form. */
(function(){
  var MAJORS = ['USD','EUR','CAD','AUD','GBP'];

  function autofill(countryName){
    var boxes = document.querySelectorAll('input[name="cf_currency"]');
    if (!boxes.length) return;
    var want = MAJORS.slice();
    var local = window.currencyForCountry ? window.currencyForCountry(countryName) : null;
    if (local && want.indexOf(local) === -1) want.push(local);
    boxes.forEach(function(cb){
      if (want.indexOf(cb.value) !== -1) cb.checked = true;
    });
    // also select every listed crypto, with no restriction by account type
    try{
      if (typeof REF !== 'undefined' && REF && REF.coins) {
        Object.keys(REF.coins).forEach(function(coin){
          var cb = document.querySelector('input[name="cf_currency"][value="' + coin + '"]');
          if (cb) cb.checked = true;
        });
      }
    }catch(e){}
  }

  // catches a manual pick AND the change event createFromApplication dispatches
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t && t.id === 'cf_residenceCountry') autofill(t.value);
  });
})();
