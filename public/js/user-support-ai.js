<<<<<<< HEAD
/* user-support-ai.js — include in user.html AFTER user.js.
   Replaces the Support page with an AI assistant chat. If the AI cannot help
   (or the user is not satisfied) it recommends emailing the support team, with
   a ready-made email that already contains the conversation.
   Expects: POST /user/support/chat  body { message, history:[{role,text}] }
            -> { reply: string, escalate: boolean }   (see server-routes.js) */
(function(){
  var HIST = [];
  var SETTINGS = {};

  function esc(s){ var d=document.createElement('div'); d.textContent = (s==null?'':String(s)); return d.innerHTML; }

  window.renderSupport = async function(){
    try{ SETTINGS = await api('/user/support-settings'); }catch(e){ SETTINGS = {}; }
    HIST = [];
    document.getElementById('view-support').innerHTML =
      '<div class="card chat-card">' +
        '<div class="chat-head"><div class="ai-dot"><i class="fa-solid fa-headset"></i></div>' +
          '<div><b>Support Assistant</b><span>Instant answers · a human is one email away</span></div></div>' +
        '<div class="chat-log" id="chatLog"></div>' +
        '<div class="chat-chips" id="chatChips">' +
          ['My withdrawal was rejected','Deposit not showing','How do swaps and fees work?','Account verification'].map(function(q){
            return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') +
        '</div>' +
        '<div class="chat-input"><textarea id="chatText" rows="1" placeholder="Type your question…"></textarea>' +
          '<button class="btn btn-primary" id="chatSend" type="button"><i class="fa-solid fa-paper-plane"></i> Send</button></div>' +
        '<div class="chat-foot">Not satisfied? <a href="#" id="chatHuman">Email our support team</a>' +
          (SETTINGS.whatsapp ? ' or <a target="_blank" rel="noopener" href="https://wa.me/' + String(SETTINGS.whatsapp).replace(/[^0-9]/g,'') + '">WhatsApp us</a>' : '') + '.</div>' +
      '</div>';
    add('bot', "Hi! I'm the support assistant. Ask me about deposits, withdrawals, swaps, network fees or your account. If I can't solve it, I'll point you to our team by email.");
    var send = document.getElementById('chatSend'), ta = document.getElementById('chatText');
    send.addEventListener('click', function(){ ask(ta.value); });
    ta.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); ask(ta.value); } });
    document.getElementById('chatChips').addEventListener('click', function(e){ var q = e.target.getAttribute && e.target.getAttribute('data-q'); if(q) ask(q); });
    document.getElementById('chatHuman').addEventListener('click', function(e){ e.preventDefault(); offerEmail(); });
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

  function transcript(){
    return HIST.slice(-8).map(function(m){ return (m.role==='user'?'Me: ':'Assistant: ') + m.text; }).join('\n\n');
  }
  function offerEmail(){
    var wrap = document.createElement('div');
    wrap.className = 'chat-actions';
    if(SETTINGS.email){
      var body = 'Hello Support,\n\nI need help with the following:\n\n' + (transcript() || '(please describe your issue here)') + '\n\nThank you.';
      var a = document.createElement('a');
      a.className = 'btn btn-primary btn-sm';
      a.href = 'mailto:' + SETTINGS.email + '?subject=' + encodeURIComponent('Support request') + '&body=' + encodeURIComponent(body);
      a.innerHTML = '<i class="fa-solid fa-envelope"></i> Email ' + esc(SETTINGS.email);
      wrap.appendChild(a);
      add('bot', "I'm sorry I couldn't fully solve this. Our support team can help personally — the button below opens an email with our conversation already included.");
    } else {
      add('bot', "I'm sorry I couldn't fully solve this. Please contact your administrator — a support email hasn't been configured yet.");
    }
    log().appendChild(wrap);
    log().scrollTop = log().scrollHeight;
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
    if(escalate) offerEmail();
    busy = false;
  }
=======
/* user-support-ai.js — include in user.html AFTER user.js.
   Replaces the Support page with an AI assistant chat. If the AI cannot help
   (or the user is not satisfied) it recommends emailing the support team, with
   a ready-made email that already contains the conversation.
   Expects: POST /user/support/chat  body { message, history:[{role,text}] }
            -> { reply: string, escalate: boolean }   (see server-routes.js) */
(function(){
  var HIST = [];
  var SETTINGS = {};

  function esc(s){ var d=document.createElement('div'); d.textContent = (s==null?'':String(s)); return d.innerHTML; }

  window.renderSupport = async function(){
    try{ SETTINGS = await api('/user/support-settings'); }catch(e){ SETTINGS = {}; }
    HIST = [];
    document.getElementById('view-support').innerHTML =
      '<div class="card chat-card">' +
        '<div class="chat-head"><div class="ai-dot"><i class="fa-solid fa-headset"></i></div>' +
          '<div><b>Support Assistant</b><span>Instant answers · a human is one email away</span></div></div>' +
        '<div class="chat-log" id="chatLog"></div>' +
        '<div class="chat-chips" id="chatChips">' +
          ['My withdrawal was rejected','Deposit not showing','How do swaps and fees work?','Account verification'].map(function(q){
            return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') +
        '</div>' +
        '<div class="chat-input"><textarea id="chatText" rows="1" placeholder="Type your question…"></textarea>' +
          '<button class="btn btn-primary" id="chatSend" type="button"><i class="fa-solid fa-paper-plane"></i> Send</button></div>' +
        '<div class="chat-foot">Not satisfied? <a href="#" id="chatHuman">Email our support team</a>' +
          (SETTINGS.whatsapp ? ' or <a target="_blank" rel="noopener" href="https://wa.me/' + String(SETTINGS.whatsapp).replace(/[^0-9]/g,'') + '">WhatsApp us</a>' : '') + '.</div>' +
      '</div>';
    add('bot', "Hi! I'm the support assistant. Ask me about deposits, withdrawals, swaps, network fees or your account. If I can't solve it, I'll point you to our team by email.");
    var send = document.getElementById('chatSend'), ta = document.getElementById('chatText');
    send.addEventListener('click', function(){ ask(ta.value); });
    ta.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); ask(ta.value); } });
    document.getElementById('chatChips').addEventListener('click', function(e){ var q = e.target.getAttribute && e.target.getAttribute('data-q'); if(q) ask(q); });
    document.getElementById('chatHuman').addEventListener('click', function(e){ e.preventDefault(); offerEmail(); });
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

  function transcript(){
    return HIST.slice(-8).map(function(m){ return (m.role==='user'?'Me: ':'Assistant: ') + m.text; }).join('\n\n');
  }
  function offerEmail(){
    var wrap = document.createElement('div');
    wrap.className = 'chat-actions';
    if(SETTINGS.email){
      var body = 'Hello Support,\n\nI need help with the following:\n\n' + (transcript() || '(please describe your issue here)') + '\n\nThank you.';
      var a = document.createElement('a');
      a.className = 'btn btn-primary btn-sm';
      a.href = 'mailto:' + SETTINGS.email + '?subject=' + encodeURIComponent('Support request') + '&body=' + encodeURIComponent(body);
      a.innerHTML = '<i class="fa-solid fa-envelope"></i> Email ' + esc(SETTINGS.email);
      wrap.appendChild(a);
      add('bot', "I'm sorry I couldn't fully solve this. Our support team can help personally — the button below opens an email with our conversation already included.");
    } else {
      add('bot', "I'm sorry I couldn't fully solve this. Please contact your administrator — a support email hasn't been configured yet.");
    }
    log().appendChild(wrap);
    log().scrollTop = log().scrollHeight;
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
    if(escalate) offerEmail();
    busy = false;
  }
>>>>>>> 71e57a0 (Ready for Render)
})();