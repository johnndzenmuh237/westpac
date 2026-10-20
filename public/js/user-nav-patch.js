(function(){
  var extra = { cards:'renderCards', upgrade:'renderUpgrade', transfer:'renderTransfer', loans:'renderLoans' };
  var base = window.nav;
  window.nav = async function(view){
    document.querySelectorAll('.main > [id^="view-"]').forEach(function(el){
      var name = el.id.replace('view-','');
      if(extra[name]) el.classList.add('hidden');
    });
    if(!extra[view]) return base.apply(this, arguments);
    currentView = view;
    var target = document.getElementById('view-'+view);
    document.querySelectorAll('.main > [id^="view-"]').forEach(function(el){
      el.classList.toggle('hidden', el !== target);
    });
    document.querySelectorAll('.nav-item[data-view]').forEach(function(el){
      el.classList.toggle('active', el.dataset.view === view);
    });
    toggleSidebar(false);
    await window[extra[view]]();
  };
})();