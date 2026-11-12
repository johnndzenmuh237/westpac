/* auto-translate.js: detects the visitor browser language and auto-translates the page. */
(function(){
  var SUPPORTED = ['fr','es','de','it','pt','zh-CN','ja','ko','ar','ru','hi','nl','tr','sw'];
  function getCookieLang(){
    var m = document.cookie.match(/googtrans=\/en\/([a-zA-Z-]+)/);
    return m ? m[1] : null;
  }
  function setLang(code){
    document.cookie = 'googtrans=/en/' + code + ';path=/';
    document.cookie = 'googtrans=/en/' + code + ';path=/;domain=.' + location.hostname;
    location.reload();
  }
  function clearLang(){
    document.cookie = 'googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'googtrans=;path=/;domain=.' + location.hostname + ';expires=Thu, 01 Jan 1970 00:00:00 GMT';
    location.reload();
  }
  function browserLang(){
    var l = (navigator.language || 'en').toLowerCase();
    if (l.indexOf('zh') === 0) return 'zh-CN';
    l = l.split('-')[0];
    return SUPPORTED.indexOf(l) !== -1 ? l : null;
  }

  if (!getCookieLang() && !localStorage.getItem('xlate_dismissed')) {
    var auto = browserLang();
    if (auto) { setLang(auto); return; }
  }

  var div = document.createElement('div');
  div.id = 'google_translate_element';
  div.style.cssText = 'position:fixed;bottom:16px;right:90px;z-index:9997;';
  document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(div); });

  window.googleTranslateElementInit = function(){
    new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'google_translate_element');
  };
  var s = document.createElement('script');
  s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  document.head.appendChild(s);

  var css = document.createElement('style');
  css.textContent = '.goog-te-banner-frame{display:none !important} body{top:0 !important}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.textContent = getCookieLang() ? 'Original language' : 'Translate';
  btn.style.cssText = 'position:fixed;right:16px;bottom:72px;z-index:9998;padding:9px 14px;border:0;border-radius:999px;background:#0b2545;color:#fff;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer;';
  btn.addEventListener('click', function(){
    if (getCookieLang()) { localStorage.setItem('xlate_dismissed','1'); clearLang(); }
    else { localStorage.setItem('xlate_dismissed','1'); setLang(browserLang() || 'fr'); }
  });
  document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(btn); });
})();
