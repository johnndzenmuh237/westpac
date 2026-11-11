(function(){
  var ADMIN = /admin/i.test(location.pathname);
  // each side installs its own app: pick the right manifest
  document.querySelectorAll('link[rel="manifest"]').forEach(function(l){ l.remove(); });
  var link = document.createElement('link');
  link.rel = 'manifest';
  link.href = ADMIN ? '/manifest-admin.webmanifest' : '/manifest-user.webmanifest';
  document.head.appendChild(link);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});

  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  if (standalone) return;

  var deferred = null;
  var btn = document.createElement('button');
  btn.textContent = 'Install app';
  btn.style.cssText = 'display:none;position:fixed;left:16px;bottom:16px;z-index:9998;padding:11px 18px;border:0;border-radius:999px;background:#0b2545;color:#fff;font:600 14px Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer;';
  document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(btn); });
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferred = e; btn.style.display = 'block'; });
  btn.addEventListener('click', function(){
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function(){ deferred = null; btn.style.display = 'none'; });
  });
  window.addEventListener('appinstalled', function(){ btn.style.display = 'none'; });

  // iPhone/iPad: there is no install button, so show a short tip once
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var KEY = 'ios_install_tip_closed';
  if (ios && !localStorage.getItem(KEY)) {
    document.addEventListener('DOMContentLoaded', function(){
      var tip = document.createElement('div');
      tip.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9998;background:#0b2545;color:#fff;padding:12px 40px 12px 14px;border-radius:12px;font:500 13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);';
      tip.innerHTML = 'Install this app: tap the Share button, then <b>Add to Home Screen</b>.' +
        '<span style="position:absolute;right:14px;top:10px;font-size:18px;cursor:pointer;">&times;</span>';
      tip.querySelector('span').onclick = function(){ localStorage.setItem(KEY, '1'); tip.remove(); };
      document.body.appendChild(tip);
    });
  }
})();