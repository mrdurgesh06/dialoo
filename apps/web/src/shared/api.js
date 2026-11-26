const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

/* ---------- customer / provider session (OTP login, refresh tokens) ---------- */
export function getToken() { return localStorage.getItem('dialoo-token'); }
export function setToken(token) { if (token) localStorage.setItem('dialoo-token', token); else localStorage.removeItem('dialoo-token'); }
export function getRefreshToken() { return localStorage.getItem('dialoo-refresh'); }
export function setSession(r) {
  setToken(r && r.token);
  if (r && r.refreshToken) localStorage.setItem('dialoo-refresh', r.refreshToken);
  else if (!r) localStorage.removeItem('dialoo-refresh');
}

/* ---------- admin session: separate store, sessionStorage (dies with the tab), never refreshed silently ---------- */
export const adminSession = {
  get: () => sessionStorage.getItem('dialoo-admin-token'),
  set: (t) => (t ? sessionStorage.setItem('dialoo-admin-token', t) : sessionStorage.removeItem('dialoo-admin-token')),
};

/* ---------- offline cache: GET responses are saved so the app still shows data without internet ---------- */
const CP = 'dialoo-cache:';
const ckey = (path, authed) => `${CP}${authed ? 'a' : 'p'}:${path}`;
function cacheGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function cachePrune(keep = 70) {
  try {
    const rows = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(CP)) { const v = cacheGet(k); rows.push([k, v ? v.t : 0]); } }
    rows.sort((a, b) => a[1] - b[1]).slice(0, Math.max(0, rows.length - keep)).forEach(([k]) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
function cachePut(k, data) {
  try { const str = JSON.stringify({ t: Date.now(), data }); if (str.length > 300000) return; localStorage.setItem(k, str); cachePrune(); }
  catch { cachePrune(20); }
}
/** Remove everything cached for a signed-in user (call on login / logout so data never leaks between accounts). */
export function clearAuthCache() {
  try { const del = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(`${CP}a:`)) del.push(k); } del.forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
}
let servingOffline = false;
const markOffline = () => { servingOffline = true; window.dispatchEvent(new Event('dialoo-offline')); };
const markOnline = () => { if (servingOffline) { servingOffline = false; window.dispatchEvent(new Event('dialoo-online')); } };

let refreshing = null;
async function refreshSession() {
  if (!getRefreshToken()) return false;
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: getRefreshToken() }) })
      .then(async (r) => { if (!r.ok) throw new Error('refresh failed'); setSession(await r.json()); return true; })
      .catch(() => { setSession(null); clearAuthCache(); return false; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function send(path, { method, body, auth, admin }) {
  const headers = { 'Content-Type': 'application/json' };
  const token = admin ? adminSession.get() : auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

export async function api(path, { method = 'GET', body, auth = true, admin = false } = {}) {
  let response;
  const cacheable = method === 'GET' && !admin;
  const key = cacheable ? ckey(path, auth) : null;
  try { response = await send(path, { method, body, auth, admin }); }
  catch {
    const hit = cacheable ? cacheGet(key) : null;
    if (hit) { markOffline(); return hit.data; }
    const e = new Error(method === 'GET' ? 'No internet connection. Please connect and try again.' : 'You are offline. Please connect to the internet and try again.'); e.network = true; throw e;
  }
  if (response.status === 401 && auth && !admin && (await refreshSession())) response = await send(path, { method, body, auth, admin });
  const data = await response.json().catch(() => ({ error: 'Unexpected server response' }));
  if (response.ok) { markOnline(); if (cacheable) cachePut(key, data); }
  if (!response.ok) {
    if (response.status === 401 && admin) { adminSession.set(null); window.dispatchEvent(new Event('dialoo-admin-expired')); }
    const e = new Error(data.error || `Request failed (${response.status})`);
    e.status = response.status; e.retryAfter = data.retryAfterSeconds; e.fields = data.fields;
    throw e;
  }
  return data;
}

const qs = (p = {}) => { const u = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.set(k, v); }); const s = u.toString(); return s ? `?${s}` : ''; };

// OTP login runs either through our own SMS sender ("local") or the MSG91 OTP widget; the server decides.
let otpCfg = null;
async function otpConfig() {
  if (otpCfg) return otpCfg;
  try { otpCfg = await api('/auth/otp/config', { auth: false }); } catch { return { mode: 'local' }; }
  return otpCfg;
}

export { otpConfig as getOtpConfig };

export const authApi = {
  register: (body) => api('/auth/register', { method: 'POST', body, auth: false }),
  login: async (body) => { const r = await api('/auth/login', { method: 'POST', body: { acceptedTerms: true, ...body }, auth: false }); clearAuthCache(); setSession(r); return r; },
  requestOtp: async (mobile) => {
    const cfg = await otpConfig();
    if (cfg.mode === 'msg91-widget') { const { msg91Send } = await import('./msg91.js'); await msg91Send(cfg, mobile); return { message: 'OTP sent', expiresInSeconds: 300, resendInSeconds: 30 }; }
    return api('/auth/otp/request', { method: 'POST', body: { mobile }, auth: false });
  },
  requestPasswordReset: (mobile) => api('/auth/password/forgot/request', { method: 'POST', body: { mobile }, auth: false }),
  resetPassword: (mobile, otp, newPassword) => api('/auth/password/forgot/reset', { method: 'POST', body: { mobile, otp, newPassword }, auth: false }),
  // `actor` is the side the person chose on the login screen: 'CUSTOMER' or 'PROVIDER' (Dialoo Partner). The server binds the whole session to it.
  verifyOtp: async (mobile, otp, actor = 'CUSTOMER') => {
    const cfg = await otpConfig(); let r; const acceptedTerms = true;
    if (cfg.mode === 'msg91-widget') { const { msg91Verify } = await import('./msg91.js'); const accessToken = await msg91Verify(cfg, otp); r = await api('/auth/otp/widget-verify', { method: 'POST', body: { accessToken, actor, acceptedTerms }, auth: false }); }
    else r = await api('/auth/otp/verify', { method: 'POST', body: { mobile, otp, actor, acceptedTerms }, auth: false });
    clearAuthCache(); setSession(r); return r;
  },
  me: () => api('/auth/me'),
  updateMe: (body) => api('/auth/me', { method: 'PATCH', body }),
  logout: async () => { const rt = getRefreshToken(); try { await api('/auth/logout', { method: 'POST', body: { refreshToken: rt }, auth: false }); } catch { /* ignore */ } setSession(null); clearAuthCache(); },
};

export const catalogApi = {
  categories: () => api('/categories', { auth: false }),
  services: (slug) => api(`/categories/${slug}/services`, { auth: false }),
  cities: () => api('/cities', { auth: false }),
  banners: () => api('/banners', { auth: false }),
  coupons: () => api('/coupons/available', { auth: false }),
  suggest: (q) => api(`/search/suggest${qs({ q })}`, { auth: false }),
  providers: (p) => api(`/providers${qs(p)}`, { auth: false }),
  provider: (id) => api(`/providers/${id}`, { auth: false }),
  plans: () => api('/subscription-plans', { auth: false }),
  flags: () => api('/feature-flags', { auth: false }),
};

export const geoApi = { reverse: (lat, lng) => api(`/geo/reverse?lat=${lat}&lng=${lng}`, { auth: false }) };

export const customerApi = {
  preview: (body) => api('/checkout/preview', { method: 'POST', body }),
  book: (body) => api('/bookings', { method: 'POST', body }),
  bookings: () => api('/bookings'),
  booking: (id) => api(`/bookings/${id}`),
  tracking: (id) => api(`/bookings/${id}/tracking`),
  sendLocation: (id, body) => api(`/bookings/${id}/location`, { method: 'POST', body }),
  setStatus: (id, body) => api(`/bookings/${id}/status`, { method: 'PATCH', body }),
  messages: (id) => api(`/bookings/${id}/messages`),
  sendMessage: (id, body) => api(`/bookings/${id}/messages`, { method: 'POST', body: { body } }),
  review: (body) => api('/reviews', { method: 'POST', body }),
  favourites: () => api('/me/favourites'),
  addFav: (id) => api(`/me/favourites/${id}`, { method: 'POST' }),
  removeFav: (id) => api(`/me/favourites/${id}`, { method: 'DELETE' }),
  addresses: () => api('/me/addresses'),
  addAddress: (body) => api('/me/addresses', { method: 'POST', body }),
  deleteAddress: (id) => api(`/me/addresses/${id}`, { method: 'DELETE' }),
  emergency: (body) => api('/emergencies', { method: 'POST', body }),
  rentals: (p) => api(`/rentals${qs(p)}`, { auth: false }),
  createRental: (body) => api('/rentals', { method: 'POST', body }),
  projects: (p) => api(`/projects${qs(p)}`, { auth: false }),
  createProject: (body) => api('/projects', { method: 'POST', body }),
};

export const notificationApi = {
  list: (page = 0, size = 20) => api(`/notifications${qs({ page, size })}`),
  unread: () => api('/notifications/unread-count'),
  read: (id) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
  readAll: () => api('/notifications/read-all', { method: 'POST' }),
};

export const providerApi = {
  apply: (body) => api('/providers/apply', { method: 'POST', body }),
  me: () => api('/provider/me'),
  update: (body) => api('/provider/me', { method: 'PATCH', body }),
  summary: () => api('/provider/summary'),
  bookings: (status) => api(`/provider/bookings${qs({ status })}`),
  setAvailability: (availableNow) => api('/provider/availability', { method: 'PATCH', body: { availableNow } }),
  subscription: () => api('/provider/subscription'),
  choosePlan: (planId) => api('/provider/subscription', { method: 'POST', body: { planId } }),
  paymentReceived: (id) => api(`/bookings/${id}/payment-received`, { method: 'POST' }),
};

/* ---------- admin (own token, own notification feed) ---------- */
const A = (path, opts = {}) => api(`/admin${path}`, { ...opts, admin: true });
export const adminApi = {
  login: (identifier, password) => api('/admin/auth/login', { method: 'POST', body: { identifier, password }, auth: false }),
  verifyWidget: (mfaToken, accessToken) => api('/admin/auth/verify-widget', { method: 'POST', body: { mfaToken, accessToken }, auth: false }),
  verify: (mfaToken, otp) => api('/admin/auth/verify', { method: 'POST', body: { mfaToken, otp }, auth: false }),
  forgot: (identifier) => api('/admin/auth/forgot', { method: 'POST', body: { identifier }, auth: false }),
  resetPassword: (resetToken, otp, newPassword) => api('/admin/auth/reset', { method: 'POST', body: { resetToken, otp, newPassword }, auth: false }),
  changeInitial: (changeToken, newPassword) => api('/admin/auth/change-initial', { method: 'POST', body: { changeToken, newPassword }, auth: false }),
  me: () => A('/auth/me'),
  extend: () => A('/auth/extend', { method: 'POST' }),
  logout: () => A('/auth/logout', { method: 'POST' }),
  dashboard: () => A('/dashboard'),
  bookings: (p) => A(`/bookings${qs(p)}`),
  booking: (id) => A(`/bookings/${id}`),
  cancelBooking: (id, reason) => A(`/bookings/${id}/cancel`, { method: 'POST', body: { reason } }),
  providers: (p) => A(`/providers${qs(p)}`),
  providerStatus: (id, status, note) => A(`/providers/${id}/status`, { method: 'PATCH', body: { status, note } }),
  users: (p) => A(`/users${qs(p)}`),
  setEnabled: (id, enabled) => A(`/users/${id}/enabled`, { method: 'PATCH', body: { enabled } }),
  addStaff: (body) => A('/staff', { method: 'POST', body }),
  resetStaffPassword: (id) => A(`/users/${id}/reset-password`, { method: 'POST' }),
  districts: () => A('/locations/districts'),
  cities: (p) => A(`/locations/cities${qs(p)}`),
  cityActive: (id, enabled) => A(`/locations/cities/${id}/active`, { method: 'PATCH', body: { enabled } }),
  addCity: (body) => A('/locations/cities', { method: 'POST', body }),
  localities: (cityId) => A(`/locations/localities${qs({ cityId })}`),
  addLocality: (body) => A('/locations/localities', { method: 'POST', body }),
  localityActive: (id, enabled) => A(`/locations/localities/${id}/active`, { method: 'PATCH', body: { enabled } }),
  streets: (cityId) => A(`/locations/streets${qs({ cityId })}`),
  addStreet: (body) => A('/locations/streets', { method: 'POST', body }),
  streetActive: (id, enabled) => A(`/locations/streets/${id}/active`, { method: 'PATCH', body: { enabled } }),
  setRole: (id, role) => A(`/users/${id}/role`, { method: 'PATCH', body: { role } }),
  categories: () => A('/categories'),
  saveCategory: (id, body) => (id ? A(`/categories/${id}`, { method: 'PUT', body }) : A('/categories', { method: 'POST', body })),
  services: () => A('/services'),
  saveService: (id, body) => (id ? A(`/services/${id}`, { method: 'PUT', body }) : A('/services', { method: 'POST', body })),
  banners: () => A('/banners'),
  saveBanner: (id, body) => (id ? A(`/banners/${id}`, { method: 'PUT', body }) : A('/banners', { method: 'POST', body })),
  deleteBanner: (id) => A(`/banners/${id}`, { method: 'DELETE' }),
  coupons: () => A('/coupons'),
  addCoupon: (body) => A('/coupons', { method: 'POST', body }),
  couponActive: (id, enabled) => A(`/coupons/${id}/active`, { method: 'PATCH', body: { enabled } }),
  broadcast: (body) => A('/notifications/broadcast', { method: 'POST', body }),
  broadcasts: () => A('/notifications/broadcasts'),
  audit: (p) => A(`/audit${qs(p)}`),
  logins: () => A('/security/logins'),
  sessions: () => A('/sessions'),
  revokeSession: (sid) => A(`/sessions/${sid}/revoke`, { method: 'POST' }),
  settings: () => A('/settings'),
  setFlag: (key, enabled) => A(`/flags/${key}`, { method: 'PATCH', body: { enabled } }),
  setSetting: (key, value) => A(`/settings/${key}`, { method: 'PATCH', body: { value } }),
  plans: () => A('/plans'),
  savePlan: (id, body) => A(`/plans/${id}`, { method: 'PUT', body }),
  emergencies: () => A('/emergencies'),
  emergencyStatus: (id, status) => A(`/emergencies/${id}/status`, { method: 'PATCH', body: { status } }),
  // admin notification bell uses the normal notification endpoints but with the admin token
  notifications: (page = 0) => api(`/notifications${qs({ page, size: 30 })}`, { admin: true }),
  unread: () => api('/notifications/unread-count', { admin: true }),
  readAll: () => api('/notifications/read-all', { method: 'POST', admin: true }),
  readOne: (id) => api(`/notifications/${id}/read`, { method: 'PATCH', admin: true }),
};
