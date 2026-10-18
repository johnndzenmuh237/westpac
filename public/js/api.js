const Session = {
  get token() {
    return this.impersonating
      ? sessionStorage.getItem('cg_token')
      : localStorage.getItem('cg_token');
  },

  get role() {
    return this.impersonating
      ? sessionStorage.getItem('cg_role')
      : localStorage.getItem('cg_role');
  },

  get name() {
    return this.impersonating
      ? sessionStorage.getItem('cg_name')
      : localStorage.getItem('cg_name');
  },

  get impersonating() {
    return sessionStorage.getItem('cg_imp') === '1';
  },

  set(token, role, name) {
    localStorage.setItem('cg_token', token);
    localStorage.setItem('cg_role', role);
    localStorage.setItem('cg_name', name || '');

    sessionStorage.removeItem('cg_token');
    sessionStorage.removeItem('cg_role');
    sessionStorage.removeItem('cg_name');
    sessionStorage.removeItem('cg_imp');
  },

  setImpersonation(token, name) {
    sessionStorage.setItem('cg_token', token);
    sessionStorage.setItem('cg_role', 'user');
    sessionStorage.setItem('cg_name', name || '');
    sessionStorage.setItem('cg_imp', '1');
  },

  clear() {
    if (this.impersonating) {
      sessionStorage.removeItem('cg_token');
      sessionStorage.removeItem('cg_role');
      sessionStorage.removeItem('cg_name');
      sessionStorage.removeItem('cg_imp');
      return;
    }

    localStorage.removeItem('cg_token');
    localStorage.removeItem('cg_role');
    localStorage.removeItem('cg_name');
  }
};

// Only these core calls decide that the session is really invalid.
// A 401 from an optional call (loans, KYC status, Tawk...) must not log the user out.
const CORE_PATHS = ['/user/me', '/user/reference', '/admin/reference', '/admin/users'];

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Session.token;

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;

  try {
    data = await res.json();
  } catch (e) {
    // The response may not contain JSON.
  }

  if (!res.ok) {
    if (res.status === 401 && CORE_PATHS.includes(path.split('?')[0])) {
      const wasImpersonating = Session.impersonating;
      const wasRole = Session.role;

      Session.clear();

      window.location.href = wasImpersonating
        ? '/admin.html'
        : (wasRole === 'admin' ? '/admin-login.html' : '/login.html');
    }

    const err = new Error(
      (data && data.error) || 'Request failed'
    );

    err.data = data;
    err.status = res.status;
    throw err;
  }

  return data;
}