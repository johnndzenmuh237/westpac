/* dashboard-fixes.js — include at the END of body in BOTH admin.html and user.html.
   Turns every table into a "labelled cells" structure so the CSS can stack rows
   as clean cards on small screens (no downward text, no sideways scrolling). */
(function(){
  function fix(){
    document.querySelectorAll('table').forEach(function(t){
      var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function(h){ return h.textContent.trim(); });
      t.querySelectorAll('tbody tr').forEach(function(tr){
        Array.prototype.forEach.call(tr.children, function(td, i){
          if(td.dataset.fx) return;
          td.dataset.fx = '1';
          td.setAttribute('data-label', heads[i] || '');
          var w = document.createElement('div');
          w.className = 'cell';
          while(td.firstChild) w.appendChild(td.firstChild);
          td.appendChild(w);
        });
      });
    });
  }
  var queued = false;
  new MutationObserver(function(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(function(){ queued = false; fix(); });
  }).observe(document.body, { childList:true, subtree:true });
  fix();
})();