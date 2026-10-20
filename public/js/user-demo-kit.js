(function(){
  var baseKyc = window.renderKyc;
  window.renderKyc = async function(){
    await baseKyc.apply(this, arguments);
    var btn = document.querySelector('#view-kyc button[onclick="submitKycDetails()"]');
    if(!btn) return;
    var slot = function(id, label){
      return '<div class="field"><label>'+label+'</label><input type="file" accept="image/*" id="'+id+'" onchange="demoPreview(this)">' +
        '<img id="'+id+'Prev" alt="" style="display:none;max-width:160px;margin-top:8px;border-radius:8px;border:1px solid #ddd;"></div>';
    };
    btn.insertAdjacentHTML('beforebegin',
      '<div class="warn-box" style="margin:14px 0;"><i class="fa-solid fa-flask"></i> <b>NOTE:</b> Upload a valid government-issued ID..</div>' +
      slot('kycFront','Upload front of ID') + slot('kycBack','Upload back of ID') + slot('kycSelfie','Selfie holding ID'));
  };
  window.demoPreview = function(input){
    var img = document.getElementById(input.id + 'Prev');
    if(input.files && input.files[0]){ img.src = URL.createObjectURL(input.files[0]); img.style.display = 'block'; }
    else img.style.display = 'none';
  };
  var baseSubmit = window.submitKycDetails;
  window.submitKycDetails = async function(){
    var ids = ['kycFront','kycBack','kycSelfie'];
    var files = ids.map(function(i){ var e = document.getElementById(i); return e && e.files && e.files[0] ? e.files[0].name : ''; });
    if(files.some(function(f){ return !f; })){ toast('Choose an image for all three photo boxes','err'); return; }
    var note = document.getElementById('kycNote');
    if(note) note.value = ((note.value || '') + ' [photos chosen, not uploaded: ' + files.join(', ') + ']').trim().slice(0,480);
    return baseSubmit.apply(this, arguments);
  };

  var baseDeposit = window.renderDeposit;
  window.renderDeposit = async function(){
    await baseDeposit.apply(this, arguments);
    var card = document.querySelector('#view-deposit .card');
    if(card) card.insertAdjacentHTML('beforeend','<div class="hint" style="margin-top:10px;"><b>Deposit:</b> Secure your deposit using the available payment methods.</div>');
  };
})();