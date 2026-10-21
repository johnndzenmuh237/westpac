const Session = {
  // admin pages and user pages keep separate logins, so they never overwrite each other
  get area() { return /admin/i.test(location.pathname) ? 'admin' : 'user'; },
  get impersonating() { return sessionStorage.getItem('cg_imp') === '1'; },
  _k(name) { return 'cg_' + name + '_' + this.area; },

  get token() {
    return this.impersonating ? sessionStorage.getItem('cg_token') : localStorage.getItem(this._k('token'));
  },
  get role() {
    return this.impersonating ? sessionStorage.getItem('cg_role')
      : (localStorage.getItem(this._k('token')) ? localStorage.getItem(this._k('role')) : null);
  },
  get name() {
    return this.impersonating ? sessionStorage.getItem('cg_name') : localStorage.getItem(this._k('name'));
  },

  set(token, role, name) {
    var area = role === 'admin' ? 'admin' : 'user';
    localStorage.setItem('cg_token_' + area, token);
    localStorage.setItem('cg_role_' + area, role);
    localStorage.setItem('cg_name_' + area, name || '');
    ['token','role','name','imp'].forEach(function(k){ sessionStorage.removeItem('cg_' + k); });
  },

  setImpersonation(token, name) {
    sessionStorage.setItem('cg_token', token);
    sessionStorage.setItem('cg_role', 'user');
    sessionStorage.setItem('cg_name', name || '');
    sessionStorage.setItem('cg_imp', '1');
  },

  clear() {
    if (this.impersonating) {
      ['token','role','name','imp'].forEach(function(k){ sessionStorage.removeItem('cg_' + k); });
      return;
    }
    var self = this;
    ['token','role','name'].forEach(function(n){ localStorage.removeItem(self._k(n)); });
  }
};

const CORE_PATHS = ['/user/me', '/user/reference', '/admin/reference', '/admin/users'];

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Session.token;
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch('/api' + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* no JSON body */ }

  if (!res.ok) {
    if (res.status === 401 && CORE_PATHS.includes(path.split('?')[0])) {
      const wasImpersonating = Session.impersonating;
      const wasAdmin = Session.area === 'admin';
      Session.clear();
      window.location.href = wasImpersonating ? '/admin.html' : (wasAdmin ? '/admin-login.html' : '/login.html');
    }
    const err = new Error((data && data.error) || ('Request failed (' + res.status + ' ' + path + ')'));
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}