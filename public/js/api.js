// Thin fetch wrapper. The login token lives in the browser purely as the
// session (like any web app) - the real data is in the server's database.
//
// Two storage layers:
//  - localStorage   : the normal login for this browser
//  - sessionStorage : used ONLY by an admin's "open user dashboard" tab, so
//                     viewing a user never logs the admin out in the other tab.
const Session = {
  get token(){ return sessionStorage.getItem('cg_token') || localStorage.getItem('cg_token'); },
  get role(){ return sessionStorage.getItem('cg_role') || localStorage.getItem('cg_role'); },
  get name(){ return sessionStorage.getItem('cg_name') || localStorage.getItem('cg_name'); },
  get impersonating(){ return sessionStorage.getItem('cg_imp') === '1'; },
  set(token, role, name){
    localStorage.setItem('cg_token', token);
    localStorage.setItem('cg_role', role);
    localStorage.setItem('cg_name', name || '');
  },
  setImpersonation(token, name){
    sessionStorage.setItem('cg_token', token);
    sessionStorage.setItem('cg_role', 'user');
    sessionStorage.setItem('cg_name', name || '');
    sessionStorage.setItem('cg_imp', '1');
  },
  clear(){
    if (sessionStorage.getItem('cg_imp') === '1') { sessionStorage.clear(); return; }
    localStorage.removeItem('cg_token');
    localStorage.removeItem('cg_role');
    localStorage.removeItem('cg_name');
  }
};

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Session.token) headers.Authorization = 'Bearer ' + Session.token;
  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    if (res.status === 401) {
      const wasImpersonating = Session.impersonating;
      const wasRole = Session.role;
      Session.clear();
      window.location.href = wasImpersonating ? '/admin.html' : (wasRole === 'admin' ? '/admin-login.html' : '/login.html');
    }
    const err = new Error((data && data.error) || 'Request failed');
    err.data = data;
    throw err;
  }
  return data;
}
