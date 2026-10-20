(function(){
  var extra = { loans:'renderLoans', kycreq:'renderKycRequests', cards:'renderCardRequests',
    upgrades:'renderUpgradeRequests', transfers:'renderTransferRequests' };
  var base = window.nav;
  window.nav = async function(view, arg){
    document.querySelectorAll('.main > [id^="view-"]').forEach(function(el){
      if(extra[el.id.replace('view-','')]) el.classList.add('hidden');
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
    if(window[extra[view]]) await window[extra[view]]();
  };
})();