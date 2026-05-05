// ── Bayanihan Connect — API Client ──────────────────────────
const API_BASE = window.API_BASE_URL || 'http://localhost:5000/api';

const api = {
  _token() { return localStorage.getItem('bc_token'); },

  _headers(isFormData = false) {
    const h = { 'Authorization': `Bearer ${this._token()}` };
    if (!isFormData) h['Content-Type'] = 'application/json';
    return h;
  },

  async _req(method, path, body = null, isFormData = false) {
    const opts = {
      method,
      headers: this._headers(isFormData),
    };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res  = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      if (path !== '/auth/login') {
        localStorage.removeItem('bc_token');
        localStorage.removeItem('bc_user');
        window.location.href = 'login.html';
      }
    }
    return { ok: res.ok, status: res.status, data };
  },

  get:    (path)            => api._req('GET',    path),
  post:   (path, body, fd)  => api._req('POST',   path, body, fd),
  put:    (path, body, fd)  => api._req('PUT',    path, body, fd),
  delete: (path)            => api._req('DELETE', path),

  // Auth
  login:    (body)     => api.post('/auth/login', body),
  register: (formData) => api.post('/auth/register', formData, true),
  me:       ()         => api.get('/auth/me'),
  updateProfile: (fd)  => api.put('/auth/profile', fd, true),
  changePassword: (b)  => api.put('/auth/password', b),

  // Requests
  getRequests:  (params = {}) => api.get('/requests?' + new URLSearchParams(params)),
  getRequest:   (id)          => api.get(`/requests/${id}`),
  createRequest: (fd)         => api.post('/requests', fd, true),
  updateRequest: (id, fd)     => api.put(`/requests/${id}`, fd, true),
  deleteRequest: (id)         => api.delete(`/requests/${id}`),
  myRequests:   ()            => api.get('/requests/user/mine'),

  // Offers
  submitOffer:  (body)        => api.post('/offers', body),
  getOffers:    (reqId)       => api.get(`/offers/request/${reqId}`),
  updateOffer:  (id, status)  => api.put(`/offers/${id}/status`, { status }),
  myOffers:     ()            => api.get('/offers/mine'),

  // Messages
  getMessages:  (reqId)       => api.get(`/messages/${reqId}`),
  sendMessage:  (body)        => api.post('/messages', body),
  unreadCount:  ()            => api.get('/messages/unread/count'),

  // Users
  leaderboard:  ()            => api.get('/users/leaderboard'),
  allBadges:    ()            => api.get('/users/badges'),
  userBadges:   (id)          => api.get(`/users/${id}/badges`),
  userProfile:  (id)          => api.get(`/users/${id}/profile`),
  notifications: ()           => api.get('/users/notifications/list'),
  markNotifRead: ()           => api.put('/users/notifications/read'),
  rateHelper:   (body)        => api.post('/users/rate', body),

  // Categories
  categories:   ()            => api.get('/categories'),

  // Admin
  adminStats:   ()            => api.get('/admin/stats'),
  adminUsers:   (params = {}) => api.get('/admin/users?' + new URLSearchParams(params)),
  adminRequests: (p = {})     => api.get('/admin/requests?' + new URLSearchParams(p)),
  adminDeleteRequest: (id)    => api.delete(`/admin/requests/${id}`),
  adminUpdateStatus: (id, s)  => api.put(`/admin/requests/${id}/status`, { status: s }),
  adminToggleUser: (id)       => api.put(`/admin/users/${id}/toggle`),
  adminBroadcast: (body)      => api.post('/admin/broadcast', body),
};

// ── Auth helpers ─────────────────────────────────────────────
const Auth = {
  isLoggedIn() { return !!localStorage.getItem('bc_token'); },
  getUser()    { try { return JSON.parse(localStorage.getItem('bc_user')); } catch { return null; } },
  setSession(token, user) {
    localStorage.setItem('bc_token', token);
    localStorage.setItem('bc_user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('bc_token');
    localStorage.removeItem('bc_user');
    window.location.href = 'login.html';
  },
  requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = 'login.html'; return false; }
    return true;
  },
  requireAdmin() {
    const u = this.getUser();
    if (!u || u.role !== 'admin') { window.location.href = 'index.html'; return false; }
    return true;
  }
};

// ── UI Helpers ───────────────────────────────────────────────
const UI = {
  avatar(url, name, size = 40) {
    if (url) return `<img src="${'http://localhost:5000' + url}" alt="${name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
    const initials = (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    return `<div class="avatar-placeholder" style="width:${size}px;height:${size}px;font-size:${size*0.38}px">${initials}</div>`;
  },
  urgencyBadge(u) {
    const map = { low:'badge-low', medium:'badge-medium', high:'badge-high', critical:'badge-critical' };
    return `<span class="badge ${map[u]||'badge-medium'}">${u}</span>`;
  },
  statusBadge(s) {
    const map = { pending:'badge-pending', in_progress:'badge-progress', resolved:'badge-resolved', cancelled:'badge-cancelled' };
    return `<span class="badge ${map[s]||'badge-pending'}">${s.replace('_',' ')}</span>`;
  },
  categoryBadge(name, color) {
    return `<span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${name}</span>`;
  },
  timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'just now';
  },
  toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
  },
  loading(show = true, container = null) {
    const target = container || document.getElementById('loading-overlay');
    if (target) target.style.display = show ? 'flex' : 'none';
  },
  confirm(message) { return window.confirm(message); }
};

window.api  = api;
window.Auth = Auth;
window.UI   = UI;
