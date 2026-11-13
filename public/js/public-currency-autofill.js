/* public-currency-autofill.js: suggests the visitor's local currency once they type their
   country on the "Open an Account" / application form. No restriction by country. */
(function(){
  function apply(){
    var resField = document.getElementById('residence');
    var curField = document.getElementById('currencies');
    if (!resField || !curField || !window.currencyForCountry) return;
    var timer;
    function suggest(){
      var code = window.currencyForCountry(resField.value);
      if (!code) return;
      var existing = curField.value.split(/[,\s]+/).map(function(s){ return s.toUpperCase(); }).filter(Boolean);
      if (existing.indexOf(code) === -1) {
        curField.value = existing.concat(code).join(', ');
      }
    }
    resField.addEventListener('input', function(){
      clearTimeout(timer);
      timer = setTimeout(suggest, 600);
    });
    resField.addEventListener('change', suggest);
    resField.addEventListener('blur', suggest);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
