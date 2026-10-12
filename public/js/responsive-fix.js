/* responsive-fix.js
   Adds data-label="Column name" to every <td> so the CSS can show
   "LABEL ........ value" on one line in the card layout.
   Works automatically on every table your dashboards render. */
(function () {
  function labelTables(root) {
    (root || document).querySelectorAll('table').forEach(function (table) {
      var heads = Array.prototype.map.call(
        table.querySelectorAll('thead th'),
        function (th) { return th.textContent.trim(); }
      );
      if (!heads.length) return;
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) {
          if (td.tagName === 'TD' && !td.hasAttribute('data-label')) {
            td.setAttribute('data-label', heads[i] || '');
          }
        });
      });
    });
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; labelTables(); });
  }

  function start() {
    labelTables();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();