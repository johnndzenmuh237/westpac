/* notify-client.js: bell, automatic popups and phone push, for both the user and admin dashboards. */
(function(){
  var AREA = /admin/i.test(location.pathname) ? 'admin' : 'user';
  var state = { list: [], unread: 0, lastMax: null, open: false };
  var pushActive = false, bell, badge, panel, listEl, permEl, toasts;

  function h(s){ var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function ago(ts){
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }
  function msg(text, type){ if (typeof toast === 'function') toast(text, type || 'ok'); else alert(text); }
  function b64(s){
    var p = '='.repeat((4 - s.length % 4) % 4), r = (s + p).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(r), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function build(){
    var css = document.createElement('style');
    css.textContent =
      '.ntf-wrap{display:flex;align-items:center;gap:12px}' +
      '.ntf-bell{position:relative;width:40px;height:40px;border-radius:50%;border:1px solid #e4e8ee;background:#fff;cursor:pointer;color:#0b2545;font-size:16px;padding:0}' +
      '.ntf-ring i{animation:ntfRing 1.6s ease-in-out infinite;transform-origin:50% 0}' +
      '@keyframes ntfRing{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(14deg)}20%{transform:rotate(-12deg)}30%{transform:rotate(8deg)}40%{transform:rotate(-6deg)}}' +
      '.ntf-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e5484d;color:#fff;font:700 11px/18px Inter,system-ui,sans-serif;text-align:center;display:none}' +
      '.ntf-panel{position:fixed;top:64px;right:12px;width:min(360px,94vw);max-height:72vh;overflow:auto;background:#fff;border:1px solid #e4e8ee;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.2);z-index:10000;display:none;font-family:Inter,system-ui,sans-serif;color:#1b2430}' +
      '.ntf-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #eef1f5;font-weight:700}' +
      '.ntf-perm{padding:10px 14px;background:#fff7e6;border-bottom:1px solid #f5d7a1;font-size:12.5px}' +
      '.ntf-perm button{margin-top:6px;border:0;background:#0b2545;color:#fff;padding:7px 12px;border-radius:8px;font-weight:600;cursor:pointer}' +
      '.ntf-item{padding:11px 14px;border-bottom:1px solid #f1f3f6;font-size:13px}' +
      '.ntf-new{background:#f0f6ff;border-left:3px solid #0b2545}' +
      '.ntf-item small{color:#8a94a6}.ntf-empty{padding:22px;text-align:center;color:#8a94a6;font-size:13px}' +
      '.ntf-toasts{position:fixed;top:14px;right:14px;z-index:10001;display:flex;flex-direction:column;gap:10px;width:min(340px,92vw)}' +
      '.ntf-toast{display:flex;gap:10px;background:#0b2545;color:#fff;padding:12px 14px;border-radius:12px;box-shadow:0 10px 28px rgba(0,0,0,.3);font:500 13px/1.4 Inter,system-ui,sans-serif;cursor:pointer;animation:ntfIn .35s ease both}' +
      '.ntf-toast i{color:#c6a15b;margin-top:2px}.ntf-out{opacity:0;transform:translateX(30px);transition:all .4s}' +
      '@keyframes ntfIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}';
    document.head.appendChild(css);

    bell = document.createElement('button');
    bell.type = 'button'; bell.className = 'ntf-bell'; bell.setAttribute('aria-label', 'Notifications');
    bell.innerHTML = '<i class="fa-solid fa-bell"></i><span class="ntf-badge"></span>';
    badge = bell.querySelector('.ntf-badge');

    var topbar = document.querySelector('.topbar'), avatar = topbar.querySelector('.avatar');
    if (avatar) {
      var wrap = document.createElement('div'); wrap.className = 'ntf-wrap';
      avatar.parentNode.insertBefore(wrap, avatar);
      wrap.appendChild(bell); wrap.appendChild(avatar);
    } else topbar.appendChild(bell);

    panel = document.createElement('div'); panel.className = 'ntf-panel';
    panel.innerHTML = '<div class="ntf-head"><span>Notifications</span><span style="font-size:12px;font-weight:500;color:#8a94a6;cursor:pointer;" id="ntfClose">Close</span></div>' +
      '<div class="ntf-perm" id="ntfPerm" style="display:none"></div><div id="ntfList"></div>';
    document.body.appendChild(panel);
    listEl = panel.querySelector('#ntfList'); permEl = panel.querySelector('#ntfPerm');
    toasts = document.createElement('div'); toasts.className = 'ntf-toasts'; document.body.appendChild(toasts);

    bell.addEventListener('click', function(e){ e.stopPropagation(); state.open ? closePanel() : openPanel(); });
    panel.querySelector('#ntfClose').addEventListener('click', closePanel);
    panel.addEventListener('click', function(e){ e.stopPropagation(); });
    document.addEventListener('click', closePanel);
  }

  function updateBadge(){
    badge.textContent = state.unread > 99 ? '99+' : state.unread;
    badge.style.display = state.unread > 0 ? 'block' : 'none';
    bell.classList.toggle('ntf-ring', state.unread > 0);
  }
  function render(){
    updateBadge();
    listEl.innerHTML = state.list.length ? state.list.map(function(n){
      return '<div class="ntf-item' + (n.readAt ? '' : ' ntf-new') + '"><b>' + h(n.title) + '</b><div>' + h(n.body) + '</div><small>' + ago(n.createdAt) + '</small></div>';
    }).join('') : '<div class="ntf-empty">No notifications yet.</div>';
  }
  function popup(title, body){
    var el = document.createElement('div'); el.className = 'ntf-toast';
    el.innerHTML = '<i class="fa-solid fa-bell"></i><div><b>' + h(title) + '</b><div>' + h(body) + '</div></div>';
    el.addEventListener('click', function(e){ e.stopPropagation(); el.remove(); openPanel(); });
    toasts.appendChild(el);
    if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) {} }
    setTimeout(function(){ el.classList.add('ntf-out'); setTimeout(function(){ el.remove(); }, 400); }, 9000);
  }

  function markRead(){
    api('/' + AREA + '/notifications/read', { method: 'POST' }).then(function(){ state.unread = 0; updateBadge(); }).catch(function(){});
  }
  function openPanel(){ state.open = true; panel.style.display = 'block'; updatePerm(); render(); if (state.unread > 0) markRead(); }
  function closePanel(){ state.open = false; panel.style.display = 'none'; }

  function updatePerm(){
    var supported = 'Notification' in window && 'serviceWorker' in navigator;
    if (!supported) { permEl.style.display = 'none'; return; }
    if (Notification.permission === 'granted' && pushActive) { permEl.style.display = 'none'; return; }
    permEl.style.display = 'block';
    if (Notification.permission === 'denied') {
      permEl.innerHTML = 'Phone notifications are blocked. Allow notifications for this site in your browser settings.';
    } else {
      permEl.innerHTML = 'Get alerts on your phone, even when the app is closed.<br><button type="button" id="ntfEnable">Turn on phone notifications</button>';
      permEl.querySelector('#ntfEnable').addEventListener('click', enablePush);
    }
  }

  async function subscribePush(){
    try{
      var k = await (await fetch('/api/push/key')).json();
      if (!k.key) return false;
      await navigator.serviceWorker.register('/sw.js');
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k.key) });
      await api('/' + AREA + '/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
      pushActive = true;
      return true;
    }catch(e){ console.error('push', e); return false; }
  }
  async function enablePush(){
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (ios && !standalone) { msg('On iPhone: tap Share, choose Add to Home Screen, open the app from your home screen, then turn on notifications.', 'err'); return; }
    if (!('PushManager' in window)) { msg('This browser does not support phone notifications.', 'err'); return; }
    var p = await Notification.requestPermission();
    if (p !== 'granted') { msg('Notifications were not allowed.', 'err'); updatePerm(); return; }
    var ok = await subscribePush();
    msg(ok ? 'Phone notifications are on.' : 'Could not turn on phone notifications (the server push keys may not be set).', ok ? 'ok' : 'err');
    updatePerm();
  }
  function systemNotify(n){
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(function(reg){ reg.showNotification(n.title, { body: n.body, icon: '/icons/icon-192.png', data: { url: AREA === 'admin' ? '/admin.html' : '/user.html' } }); });
  }

  async function poll(){
    try{
      var d = await api('/' + AREA + '/notifications');
      var prev = state.lastMax;
      state.list = d.list; state.unread = d.unread;
      render();
      if (prev === null) {
        if (d.unread > 0) popup('You have ' + d.unread + ' unread notification' + (d.unread > 1 ? 's' : ''), d.list[0] ? d.list[0].title : '');
      } else {
        var fresh = d.list.filter(function(n){ return !n.readAt && n.id > prev; }).reverse();
        fresh.slice(0, 3).forEach(function(n){ popup(n.title, n.body); });
        if (fresh.length > 3) popup(fresh.length + ' new notifications', 'Open the bell to read them.');
        if (fresh.length && document.hidden && !pushActive) systemNotify(fresh[0]);
        if (state.open && d.unread > 0) markRead();
      }
      state.lastMax = Math.max(prev || 0, d.latestId || 0);
    }catch(e){ /* ignore, try again next time */ }
  }

  function start(){
    if (typeof Session === 'undefined' || typeof api !== 'function') return;
    if (Session.impersonating || !Session.token || Session.role !== AREA) return;
    if (!document.querySelector('.topbar')) return;
    build();
    poll();
    setInterval(poll, 15000);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) poll(); });
    if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) subscribePush().then(updatePerm);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();