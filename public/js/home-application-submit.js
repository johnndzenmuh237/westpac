<<<<<<< HEAD
/* home-application-submit.js — include on the public website page (index.html)
   AFTER its inline <script>. Replaces submitApplication() so requests are sent
   to the server (and therefore show up in the admin "Applications" inbox)
   instead of being kept only in the visitor's browser.
   Posts to: POST /api/public/applications   (see server-routes.js) */
async function submitApplication(event){
  event.preventDefault();
  var form = event.target;
  var m = document.getElementById('omsg');
  var btn = form.querySelector('button[type="submit"]');
  var app = {
    acctType:val('acctType'), currencies:val('currencies'), fullName:val('fullName'), dob:val('dob'),
    nationality:val('nationality'), residence:val('residence'), address:val('address'), city:val('city'), postcode:val('postcode'),
    email:val('oemail'), phone:val('ophone'), idType:val('idType'), idNumber:val('idNumber'), idCountry:val('idCountry'),
    occupation:val('occupation'), employer:val('employer'), sourceFunds:val('sourceFunds'), deposit:val('deposit'), bizReg:val('bizReg')
  };
  if(btn){ btn.disabled = true; btn.textContent = 'Submitting…'; }
  try{
    var res = await fetch('/api/public/applications', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(app)
    });
    if(!res.ok){
      var err = {}; try{ err = await res.json(); }catch(e){}
      throw new Error(err.error || err.message || 'Something went wrong. Please try again.');
    }
    m.className = 'form-msg ok';
    m.textContent = 'Thank you — your application has been received. A relationship manager will review your details and respond within 1–2 business days.';
    form.reset();
    window.scrollTo({ top:0, behavior:'smooth' });
  }catch(e){
    m.className = 'form-msg';
    m.style.display = 'block'; m.style.background = '#fde9e9'; m.style.color = '#8a1f1f';
    m.textContent = e.message || 'Could not submit your application. Please try again.';
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = 'Submit Application'; }
  }
=======
/* home-application-submit.js — include on the public website page (index.html)
   AFTER its inline <script>. Replaces submitApplication() so requests are sent
   to the server (and therefore show up in the admin "Applications" inbox)
   instead of being kept only in the visitor's browser.
   Posts to: POST /api/public/applications   (see server-routes.js) */
async function submitApplication(event){
  event.preventDefault();
  var form = event.target;
  var m = document.getElementById('omsg');
  var btn = form.querySelector('button[type="submit"]');
  var app = {
    acctType:val('acctType'), currencies:val('currencies'), fullName:val('fullName'), dob:val('dob'),
    nationality:val('nationality'), residence:val('residence'), address:val('address'), city:val('city'), postcode:val('postcode'),
    email:val('oemail'), phone:val('ophone'), idType:val('idType'), idNumber:val('idNumber'), idCountry:val('idCountry'),
    occupation:val('occupation'), employer:val('employer'), sourceFunds:val('sourceFunds'), deposit:val('deposit'), bizReg:val('bizReg')
  };
  if(btn){ btn.disabled = true; btn.textContent = 'Submitting…'; }
  try{
    var res = await fetch('/api/public/applications', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(app)
    });
    if(!res.ok){
      var err = {}; try{ err = await res.json(); }catch(e){}
      throw new Error(err.error || err.message || 'Something went wrong. Please try again.');
    }
    m.className = 'form-msg ok';
    m.textContent = 'Thank you — your application has been received. A relationship manager will review your details and respond within 1–2 business days.';
    form.reset();
    window.scrollTo({ top:0, behavior:'smooth' });
  }catch(e){
    m.className = 'form-msg';
    m.style.display = 'block'; m.style.background = '#fde9e9'; m.style.color = '#8a1f1f';
    m.textContent = e.message || 'Could not submit your application. Please try again.';
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = 'Submit Application'; }
  }
>>>>>>> 71e57a0 (Ready for Render)
}