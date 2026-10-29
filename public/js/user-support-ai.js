/* user-support-ai.js — include in user.html AFTER user.js.
   AI assistant chat. If the AI cannot help (or the user is not satisfied),
   it opens a live chat with a human agent through Tawk.to. */
(function(){
  var HIST = [];
  var DEFAULT_TAWK = 'https://embed.tawk.to/6ae1b2e83ea2de346f9bafbd/default'; // used if none is saved in the admin panel

  function esc(s){ var d=document.createElement('div'); d.textContent = (s==null?'':String(s)); return d.innerHTML; }

  /* ---------- load Tawk on every dashboard page ---------- */
  var tawkReady = false;
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  var prevOnLoad = window.Tawk_API.onLoad;
  window.Tawk_API.onLoad = function(){
    tawkReady = true;
    try{
      var name = '';
      try{ name = (typeof Session !== 'undefined' && Session.name) || ''; }catch(e){}
      if(name) window.Tawk_API.setAttributes({ name: name }, function(){});
    }catch(e){}
    if(typeof prevOnLoad === 'function') prevOnLoad();
  };
  function loadTawk(url){
    if(document.querySelector('script[src*="embed.tawk.to"]')) return;
    var s = document.createElement('script');
    s.async = true; s.src = url; s.charset = 'UTF-8'; s.setAttribute('crossorigin','*');
    document.head.appendChild(s);
  }
  fetch('/api/public/tawk').then(function(r){ return r.json(); })
    .then(function(d){ loadTawk((d && d.url) || DEFAULT_TAWK); })
    .catch(function(){ loadTawk(DEFAULT_TAWK); });

  function openLiveChat(note){
    var tries = 0;
    (function go(){
      if(tawkReady && window.Tawk_API && typeof window.Tawk_API.maximize === 'function'){
        try{
          window.Tawk_API.maximize();
        }catch(e){}
        return;
      }
      if(++tries > 40){ add('bot', "The live chat is still loading. Please click the chat bubble in the corner in a moment."); return; }
      setTimeout(go, 250);
    })();
  }

  /* ---------- support page ---------- */
  window.renderSupport = async function(){
    HIST = [];
    document.getElementById('view-support').innerHTML =
      '<div class="card chat-card">' +
        '<div class="chat-head"><div class="ai-dot"><i class="fa-solid fa-headset"></i></div>' +
          '<div><b>Support Assistant</b><span>Instant answers · a live agent is one click away</span></div></div>' +
        '<div class="chat-log" id="chatLog"></div>' +
        '<div class="chat-chips" id="chatChips">' +
          ['My withdrawal was rejected','Deposit not showing','How do swaps and fees work?','Account verification'].map(function(q){
            return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') +
        '</div>' +
        '<div class="chat-input"><textarea id="chatText" rows="1" placeholder="Type your question…"></textarea>' +
          '<button class="btn btn-primary" id="chatSend" type="button"><i class="fa-solid fa-paper-plane"></i> Send</button></div>' +
        '<div class="chat-foot">Not satisfied? <a href="#" id="chatHuman"><i class="fa-solid fa-comments"></i> Chat with a live agent</a>.</div>' +
      '</div>';
    add('bot', "Hi! I'm the support assistant. Ask me about deposits, withdrawals, swaps, network fees or your account. If I can't solve it, I'll connect you with a live agent. (Demo platform: please don't share real personal or financial details.)");
    var send = document.getElementById('chatSend'), ta = document.getElementById('chatText');
    send.addEventListener('click', function(){ ask(ta.value); });
    ta.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); ask(ta.value); } });
    document.getElementById('chatChips').addEventListener('click', function(e){ var q = e.target.getAttribute && e.target.getAttribute('data-q'); if(q) ask(q); });
    document.getElementById('chatHuman').addEventListener('click', function(e){ e.preventDefault(); offerLiveChat(true); });
  };

  function log(){ return document.getElementById('chatLog'); }
  function add(role, text){
    var el = document.createElement('div');
    el.className = 'msg ' + (role==='me' ? 'me' : 'bot');
    el.textContent = text;
    log().appendChild(el);
    log().scrollTop = log().scrollHeight;
    return el;
  }

  function offerLiveChat(manual){
    var wrap = document.createElement('div');
    wrap.className = 'chat-actions';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-primary btn-sm';
    b.innerHTML = '<i class="fa-solid fa-comments"></i> Chat with a live agent';
    b.addEventListener('click', function(){ openLiveChat(); });
    wrap.appendChild(b);
    add('bot', manual
      ? "Sure — click the button below to chat with a live agent."
      : "I'm sorry I couldn't fully solve this. A live agent can help you personally. Click the button below to start a live chat.");
    log().appendChild(wrap);
    log().scrollTop = log().scrollHeight;
    if(manual) openLiveChat();
  }

  var busy = false;
  async function ask(text){
    text = (text||'').trim();
    if(!text || busy) return;
    busy = true;
    var ta = document.getElementById('chatText'); ta.value = '';
    var chips = document.getElementById('chatChips'); if(chips) chips.style.display = 'none';
    add('me', text);
    var history = HIST.slice(-10);
    HIST.push({ role:'user', text:text });
    var typing = add('bot', 'Typing…'); typing.classList.add('typing');
    var reply, escalate = false;
    try{
      var r = await api('/user/support/chat', { method:'POST', body:{ message:text, history:history } });
      reply = r.reply; escalate = !!r.escalate;
    }catch(e){
      reply = "I'm having trouble answering right now.";
      escalate = true;
    }
    typing.remove();
    add('bot', reply);
    HIST.push({ role:'assistant', text:reply });
    if(escalate) offerLiveChat(false);
    busy = false;
  }
})();