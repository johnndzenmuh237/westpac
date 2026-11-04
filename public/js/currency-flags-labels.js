/* currency-flags-labels.js: adds a flag next to "XXX Balance" and "XXX Receiving Account" labels. */
(function(){
  var RE = /^[^A-Za-z]*([A-Z]{3}) (Balance|Receiving Account)\s*$/;
  function run(){
    if(!window.currencyFlag || !document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var hits = [], node;
    while((node = walker.nextNode())){
      var p = node.parentNode;
      if(!p || /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(p.tagName)) continue;
      if(p.getAttribute && p.getAttribute('data-flag2')) continue;
      var m = RE.exec(node.nodeValue);
      if(m) hits.push([node, m[1], p]);
    }
    hits.forEach(function(h){
      var code = h[1], textNode = h[0], parent = h[2];
      var tile = parent.closest ? parent.closest('.holding-row,.market-tile') : null;
      if(tile && tile.querySelector('img[alt="' + code + '"]')) { parent.setAttribute('data-flag2','1'); return; }
      var html = window.currencyFlag(code, 16);
      if(!html) return;
      parent.setAttribute('data-flag2','1');
      var prev = textNode.previousSibling;
      if(prev && prev.nodeType === 1 && prev.matches && prev.matches('i.fa-building-columns')) prev.remove();
      var span = document.createElement('span');
      span.style.cssText = 'display:inline-block;margin-right:6px;';
      span.innerHTML = html;
      parent.insertBefore(span, textNode);
    });
  }
  var queued = false;
  function schedule(){
    if(queued) return; queued = true;
    requestAnimationFrame(function(){ queued = false; try{ run(); }catch(e){} });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', schedule);
  schedule();
})();
