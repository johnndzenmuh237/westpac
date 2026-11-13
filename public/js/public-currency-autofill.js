/* public-currency-autofill.js: "currencies" becomes a dropdown with tick boxes (no typing).
   Picking a country auto-ticks the 5 majors, the local currency and all crypto. */
(function(){
  var MAJORS = ['USD','EUR','CAD','AUD','GBP'];
  // KEEP THIS IN SYNC with the coins in the admin page (REF.coins)
  var CRYPTO = [];

  function init(){
    var res = document.getElementById('residence');
    var cur = document.getElementById('currencies');
    if (!res || !cur || !window.currencyForCountry) return;

    var fiat = MAJORS.slice();
    var map = window.COUNTRY_CURRENCY_MAP || {};
    Object.keys(map).forEach(function(k){
      if (fiat.indexOf(map[k]) === -1) fiat.push(map[k]);
    });

    // hide the typed box; it stays as the value the form already submits
    cur.type = 'hidden';
    cur.removeAttribute('required');

    // styles
    var st = document.createElement('style');
    st.textContent =
      '.cur-dd{position:relative}' +
      '.cur-dd-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 12px;border:1.5px solid var(--line,#e4e8ee);border-radius:9px;background:#fff;font:inherit;font-size:15px;cursor:pointer;text-align:left;color:inherit}' +
      '.cur-dd-btn:focus{outline:2px solid var(--navy,#0b2545);outline-offset:1px}' +
      '.cur-dd-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.cur-dd-panel{display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:60;background:#fff;border:1.5px solid var(--line,#e4e8ee);border-radius:9px;box-shadow:0 12px 30px rgba(7,26,51,.15);padding:8px}' +
      '.cur-dd.open .cur-dd-panel{display:block}' +
      '.cur-dd-search{width:100%;padding:9px 10px;border:1.5px solid var(--line,#e4e8ee);border-radius:8px;font:inherit;font-size:14px;margin-bottom:6px}' +
      '.cur-dd-list{max-height:230px;overflow-y:auto}' +
      '.cur-dd-head{font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5b6774;padding:8px 6px 4px}' +
      '.cur-dd-opt{display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:6px;cursor:pointer;font-size:14.5px}' +
      '.cur-dd-opt:hover{background:#f2f5f9}' +
      '.cur-dd-actions{display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid var(--line,#e4e8ee)}' +
      '.cur-dd-actions button{background:none;border:none;font:inherit;font-size:13px;font-weight:600;color:var(--navy,#0b2545);cursor:pointer;padding:4px 6px}';
    document.head.appendChild(st);

    function opts(list){
      return list.map(function(code){
        return '<label class="cur-dd-opt" data-code="' + code + '">' +
               '<input type="checkbox" name="pub_currency" value="' + code + '"> ' + code + '</label>';
      }).join('');
    }

    var wrap = document.createElement('div');
    wrap.className = 'cur-dd';
    wrap.innerHTML =
      '<button type="button" class="cur-dd-btn" aria-haspopup="listbox" aria-expanded="false">' +
        '<span class="cur-dd-label">Select currencies</span><span aria-hidden="true">&#9662;</span></button>' +
      '<div class="cur-dd-panel">' +
        '<input type="text" class="cur-dd-search" placeholder="Search currency (e.g. USD)" autocomplete="off">' +
        '<div class="cur-dd-list">' +
          '<div class="cur-dd-head" data-head="fiat">Currencies</div>' + opts(fiat) +
          
        '</div>' +
        '<div class="cur-dd-actions"><button type="button" data-act="clear">Clear</button>' +
        '<button type="button" data-act="done">Done</button></div>' +
      '</div>';
    cur.parentNode.insertBefore(wrap, cur.nextSibling);

    var btn = wrap.querySelector('.cur-dd-btn');
    var label = wrap.querySelector('.cur-dd-label');
    var search = wrap.querySelector('.cur-dd-search');
    var boxes = wrap.querySelectorAll('input[name="pub_currency"]');

    function setOpen(o){
      wrap.classList.toggle('open', o);
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      if (o) { search.value = ''; filter(''); }
    }
    function filter(q){
      q = q.trim().toUpperCase();
      wrap.querySelectorAll('.cur-dd-opt').forEach(function(l){
        l.style.display = (!q || l.getAttribute('data-code').indexOf(q) !== -1) ? '' : 'none';
      });
    }
    function sync(){
      var picked = [];
      boxes.forEach(function(cb){ if (cb.checked) picked.push(cb.value); });
      cur.value = picked.join(', ');
      label.textContent = !picked.length ? 'Select currencies'
        : picked.length <= 4 ? picked.join(', ')
        : picked.slice(0, 4).join(', ') + ' +' + (picked.length - 4);
      cur.dispatchEvent(new Event('input', { bubbles: true }));
    }

    btn.addEventListener('click', function(){ setOpen(!wrap.classList.contains('open')); });
    search.addEventListener('input', function(){ filter(search.value); });
    wrap.addEventListener('change', sync);
    wrap.querySelector('[data-act="done"]').addEventListener('click', function(){ setOpen(false); });
    wrap.querySelector('[data-act="clear"]').addEventListener('click', function(){
      boxes.forEach(function(cb){ cb.checked = false; });
      sync();
    });
    document.addEventListener('click', function(e){ if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setOpen(false); });

    function autofill(){
      var want = MAJORS.slice();
      var local = window.currencyForCountry(res.value);
      if (local && want.indexOf(local) === -1) want.push(local);
      CRYPTO.forEach(function(c){ want.push(c); });
      boxes.forEach(function(cb){ if (want.indexOf(cb.value) !== -1) cb.checked = true; });
      sync();
    }

    var timer;
    res.addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(autofill, 600); });
    res.addEventListener('change', autofill);
    res.addEventListener('blur', autofill);

    var form = cur.closest('form');
    if (form) {
      // after the form is reset, clear boxes and the hidden value together
      form.addEventListener('reset', function(){ setTimeout(sync, 0); });
      // block submit if nothing is selected
      form.addEventListener('submit', function(e){
        if (!cur.value) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setOpen(true);
          btn.focus();
        }
      }, true);
    }

    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
