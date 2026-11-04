/* currency-flags.js: shows a country flag next to fiat currencies (USD, EUR, CAD...), like the coin icons. */
(function(){
  var BASE = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/';
  var MAP = {USD:'us',EUR:'eu',GBP:'gb',CAD:'ca',AUD:'au',NZD:'nz',CHF:'ch',JPY:'jp',CNY:'cn',INR:'in',
    NGN:'ng',GHS:'gh',KES:'ke',ZAR:'za',XAF:'cm',XOF:'sn',BSD:'bs',BBD:'bb',XCD:'ag',JMD:'jm',TTD:'tt',
    MXN:'mx',BRL:'br',AED:'ae',SAR:'sa',SGD:'sg',HKD:'hk',SEK:'se',NOK:'no',DKK:'dk',PLN:'pl',TRY:'tr',
    RUB:'ru',KRW:'kr',EGP:'eg',MAD:'ma',TZS:'tz',UGX:'ug',RWF:'rw',ZMW:'zm',CZK:'cz',HUF:'hu',ILS:'il',
    THB:'th',MYR:'my',PHP:'ph',IDR:'id',VND:'vn',PKR:'pk',BDT:'bd',LKR:'lk',CLP:'cl',COP:'co',ARS:'ar',PEN:'pe'};

  function flag(code, h, round){
    var c = MAP[code]; if(!c) return '';
    var w = round ? h : Math.round(h * 1.33);
    return '<img src="' + BASE + c + '.svg" alt="' + code + '" title="' + code + '" width="' + w + '" height="' + h +
      '" style="width:' + w + 'px;height:' + h + 'px;object-fit:cover;border-radius:' + (round ? '50%' : '3px') +
      ';vertical-align:-3px;box-shadow:0 0 0 1px rgba(0,0,0,.12);" onerror="this.style.display=\'none\'">';
  }
  window.currencyFlag = function(code, h){ return flag(String(code||'').toUpperCase(), h || 16, false); };

  function decorate(){
    // currency check boxes in the admin client form
    document.querySelectorAll('label.chip input[name="cf_currency"]').forEach(function(inp){
      var lab = inp.parentNode;
      if(lab.getAttribute('data-flag') || !MAP[inp.value]) return;
      lab.setAttribute('data-flag', '1');
      inp.insertAdjacentHTML('afterend', ' ' + flag(inp.value, 14, false));
    });
    // "Preferred currencies" rows (user account page, admin client details)
    document.querySelectorAll('dt').forEach(function(dt){
      if(dt.textContent.trim() !== 'Preferred currencies') return;
      var dd = dt.nextElementSibling;
      if(!dd || dd.getAttribute('data-flag')) return;
      var codes = dd.textContent.split(/[,\s]+/).filter(Boolean);
      if(!codes.length || !codes.every(function(c){ return /^[A-Z]{3,5}$/.test(c); })) return;
      dd.setAttribute('data-flag', '1');
      dd.innerHTML = codes.map(function(c){
        return '<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 4px 0;">' + flag(c, 16, false) + '<b>' + c + '</b></span>';
      }).join('');
    });
    // USD balance icon (wallet row and dashboard tile): replace the dollar sign with the US flag
    document.querySelectorAll('i.fa-dollar-sign').forEach(function(i){
      var p = i.parentNode;
      if(!p || p.getAttribute('data-flag')) return;
      if(p.classList.contains('coin-ic')){
        p.setAttribute('data-flag', '1');
        p.style.background = 'transparent';
        p.innerHTML = flag('USD', 34, true);
      } else if(p.parentNode && p.parentNode.classList && p.parentNode.classList.contains('market-tile')){
        p.setAttribute('data-flag', '1');
        p.innerHTML = flag('USD', 28, true);
      }
    });
  }

  var queued = false;
  function schedule(){
    if(queued) return; queued = true;
    requestAnimationFrame(function(){ queued = false; try{ decorate(); }catch(e){} });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', schedule);
  schedule();
})();
