/* mobile-drawer.js: turns #mobileMenu into a professional slide-in drawer. */
(function(){
  function init(){
    var menu = document.getElementById('mobileMenu');
    if (!menu || menu.getAttribute('data-drawer')) return;
    menu.setAttribute('data-drawer', '1');
    // the sticky header has backdrop-filter, which would trap a fixed drawer, so move it to <body>
    document.body.appendChild(menu);

    var st = document.createElement('style');
    st.textContent =
    '#drawerOverlay{position:fixed;inset:0;background:rgba(4,14,28,.62);backdrop-filter:blur(2px);opacity:0;visibility:hidden;transition:opacity .3s ease,visibility 0s linear .3s;z-index:190}' +
    '#drawerOverlay.show{opacity:1;visibility:visible;transition:opacity .3s ease}' +
    '@media (max-width:1024px){' +
      'body > #mobileMenu{display:flex!important;flex-direction:column;gap:0;position:fixed;top:0;right:0;bottom:0;width:min(88vw,380px);padding:0;background:linear-gradient(180deg,#0b2545 0%,#071a33 100%);border:0;border-left:1px solid rgba(198,161,91,.35);box-shadow:-18px 0 48px rgba(7,26,51,.45);z-index:200;transform:translateX(105%);visibility:hidden;overflow:hidden;transition:transform .32s cubic-bezier(.22,.8,.3,1),visibility 0s linear .32s}' +
      'body > #mobileMenu.open{transform:translateX(0);visibility:visible;transition:transform .32s cubic-bezier(.22,.8,.3,1),visibility 0s}' +
      '#mobileMenu .drawer-head{display:flex;align-items:center;justify-content:space-between;padding:calc(16px + env(safe-area-inset-top,0px)) 20px 16px;border-bottom:1px solid rgba(255,255,255,.1);flex:none}' +
      '#mobileMenu .drawer-brand{display:flex;flex-direction:column;line-height:1}' +
      '#mobileMenu .drawer-brand strong{font-family:"Source Serif 4",Georgia,serif;font-size:21px;color:#fff;font-weight:700}' +
      '#mobileMenu .drawer-brand small{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold,#c6a15b);font-weight:600;margin-top:5px}' +
      '#mobileMenu .drawer-close{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
      '#mobileMenu .drawer-close:hover{background:rgba(255,255,255,.14);transform:none;box-shadow:none}' +
      '#mobileMenu .drawer-nav{flex:1;overflow-y:auto;padding:10px 12px;-webkit-overflow-scrolling:touch}' +
      '#mobileMenu .drawer-nav button{display:flex;justify-content:space-between;align-items:center;width:100%;margin:2px 0;padding:15px 14px;border:0;border-radius:10px;background:transparent;color:#e8eef7;font-family:inherit;font-size:16px;font-weight:500;text-align:left;cursor:pointer}' +
      '#mobileMenu .drawer-nav button::after{content:"\\203A";color:var(--gold,#c6a15b);font-size:22px;line-height:1}' +
      '#mobileMenu .drawer-nav button:hover,#mobileMenu .drawer-nav button:active{background:rgba(255,255,255,.07);transform:none;box-shadow:none}' +
      '#mobileMenu .drawer-nav button.is-active{background:rgba(198,161,91,.14);color:#fff;box-shadow:inset 3px 0 0 var(--gold,#c6a15b)}' +
      '#mobileMenu .drawer-cta{flex:none;display:grid;gap:10px;padding:16px 20px calc(20px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.18)}' +
      '#mobileMenu .drawer-cta button,#mobileMenu .drawer-cta a{display:block;width:100%;padding:14px 16px;border-radius:999px;font-family:inherit;font-size:15.5px;font-weight:700;text-align:center;text-decoration:none;cursor:pointer;border:0}' +
      '#mobileMenu .drawer-cta .cta-primary{background:var(--gold,#c6a15b);color:#071a33}' +
      '#mobileMenu .drawer-cta .cta-secondary{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.45)}' +
      '#mobileMenu .drawer-cta button:hover,#mobileMenu .drawer-cta a:hover{transform:none;box-shadow:none;filter:brightness(1.06)}' +
    '}';
    document.head.appendChild(st);

    var ov = document.createElement('div');
    ov.id = 'drawerOverlay';
    document.body.appendChild(ov);

    menu.querySelectorAll('a').forEach(function(a){ a.removeAttribute('style'); });

    // pick out the two call-to-action items
    var openBtn = null, loginLink = null;
    Array.prototype.slice.call(menu.querySelectorAll('button,a')).forEach(function(el){
      var t = el.textContent.trim();
      if (el.tagName === 'BUTTON' && t === 'Open an Account') openBtn = el;
      if (el.tagName === 'A' && /login\.html/.test(el.getAttribute('href') || '')) loginLink = el;
    });

    var nav = document.createElement('nav');
    nav.className = 'drawer-nav';
    nav.setAttribute('aria-label', 'Mobile menu');
    Array.prototype.slice.call(menu.children).forEach(function(el){
      if (el !== openBtn && el !== loginLink) nav.appendChild(el);
    });

    var head = document.createElement('div');
    head.className = 'drawer-head';
    head.innerHTML = '<div class="drawer-brand"><strong>Westpac Global</strong><small>International Bank</small></div>' +
                     '<button type="button" class="drawer-close" aria-label="Close menu">&#10005;</button>';

    var cta = document.createElement('div');
    cta.className = 'drawer-cta';
    if (openBtn) { openBtn.className = 'cta-primary'; cta.appendChild(openBtn); }
    if (loginLink) { loginLink.className = 'cta-secondary'; cta.appendChild(loginLink); }

    menu.appendChild(head);
    menu.appendChild(nav);
    menu.appendChild(cta);
    menu.setAttribute('aria-hidden', 'true');

    function close(){ menu.classList.remove('open'); }

    function markActive(){
      var h = (location.hash || '#home').replace('#', '') || 'home';
      nav.querySelectorAll('button').forEach(function(b){
        var oc = b.getAttribute('onclick') || '';
        var m = oc.match(/go\('([a-z]+)'\)/);
        b.classList.toggle('is-active', !!(m && m[1] === h && oc.indexOf('crypto') === -1));
      });
    }

    var isOpen = false;
    function sync(){
      var o = menu.classList.contains('open');
      if (o === isOpen) return;
      isOpen = o;
      ov.classList.toggle('show', o);
      document.documentElement.style.overflow = o ? 'hidden' : '';
      menu.setAttribute('aria-hidden', o ? 'false' : 'true');
      if (o) { markActive(); nav.scrollTop = 0; }
    }
    new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] });

    menu.addEventListener('click', function(e){
      if (e.target.closest('button,a')) setTimeout(close, 0);
    });
    ov.addEventListener('click', close);
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function(){ if (window.innerWidth > 1024) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
