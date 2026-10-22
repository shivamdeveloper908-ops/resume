/* ═══════════════════════════════════════════════════════════
   CUTORA — Shared JS: Auth + Utilities
   No framework, no build step. Runs in every page.
   ═══════════════════════════════════════════════════════════ */

/* ── Auth helpers ────────────────────────────────────────── */
const Auth = (() => {
  const USERS_KEY   = 'cutora_users';
  const SESSION_KEY = 'cutora_session';

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  function getCurrentUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function register({ name, email, password, course }) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, error: 'An account with this email already exists.' };
    const user = { id: crypto.randomUUID(), name, email, course: course || 'software', createdAt: new Date().toISOString() };
    const stored = { ...user, pwHash: _hash(password + user.id) };
    users.push(stored);
    saveUsers(users);
    return { ok: true, user };
  }

  function login({ email, password, remember }) {
    const users = getUsers();
    const stored = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!stored) return { ok: false, error: 'No account found with that email.' };
    if (stored.pwHash !== _hash(password + stored.id))
      return { ok: false, error: 'Incorrect password. Please try again.' };
    const user = { id: stored.id, name: stored.name, email: stored.email, course: stored.course || 'software' };
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(user));
    return { ok: true, user };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function requireAuth() {
    const user = getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return null; }
    return user;
  }

  function requireGuest() {
    const user = getCurrentUser();
    if (user) { window.location.href = 'dashboard.html'; }
  }

  function updateName(newName) {
    const user = getCurrentUser();
    if (!user) return false;
    // Update in users store
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) return false;
    users[idx].name = newName;
    saveUsers(users);
    // Update session
    user.name = newName;
    if (localStorage.getItem(SESSION_KEY)) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    if (sessionStorage.getItem(SESSION_KEY)) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return true;
  }

  function changePassword({ currentPassword, newPassword }) {
    const user = getCurrentUser();
    if (!user) return { ok: false, error: 'Not logged in.' };
    const users = getUsers();
    const stored = users.find(u => u.id === user.id);
    if (!stored) return { ok: false, error: 'Account not found.' };
    if (stored.pwHash !== _hash(currentPassword + stored.id))
      return { ok: false, error: 'Current password is incorrect.' };
    stored.pwHash = _hash(newPassword + stored.id);
    saveUsers(users);
    return { ok: true };
  }

  function deleteAccount() {
    const user = getCurrentUser();
    if (!user) return;
    const users = getUsers().filter(u => u.id !== user.id);
    saveUsers(users);
    // Remove history too
    localStorage.removeItem('cutora_history_' + user.id);
    logout();
  }

  // djb2-style simple hash (good enough for local demo auth)
  function _hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(36);
  }

  return { register, login, logout, getCurrentUser, requireAuth, requireGuest, updateName, changePassword, deleteAccount };
})();

/* ── History helpers ─────────────────────────────────────── */
const History = (() => {
  function _key(userId) { return 'cutora_history_' + userId; }

  function getAll(userId) {
    try { return JSON.parse(localStorage.getItem(_key(userId))) || []; }
    catch { return []; }
  }

  function save(userId, entry) {
    const all = getAll(userId);
    all.unshift({ ...entry, id: crypto.randomUUID(), date: new Date().toISOString() });
    // Keep last 50
    localStorage.setItem(_key(userId), JSON.stringify(all.slice(0, 50)));
    return all[0];
  }

  function remove(userId, entryId) {
    const all = getAll(userId).filter(e => e.id !== entryId);
    localStorage.setItem(_key(userId), JSON.stringify(all));
  }

  function getOne(userId, entryId) {
    return getAll(userId).find(e => e.id === entryId) || null;
  }

  return { getAll, save, remove, getOne };
})();

/* ── Toast helper ────────────────────────────────────────── */
function showToast(msg, type = '', duration = 3200) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  requestAnimationFrame(() => { el.classList.add('show'); });
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.remove('show'); }, duration);
}

/* ── Eye-toggle helper ───────────────────────────────────── */
function initEyeToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const inp = document.getElementById(inputId);
  if (!btn || !inp) return;
  const slash = btn.querySelector('.eye-slash');
  if (slash) slash.setAttribute('display', 'block');
  btn.addEventListener('click', () => {
    const showing = inp.type === 'text';
    inp.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-pressed', String(!showing));
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    if (slash) slash.setAttribute('display', showing ? 'block' : 'none');
  });
}

/* ── Video background helper ─────────────────────────────── */
function initAuthVideo(videoId) {
  const vid = document.getElementById(videoId);
  if (!vid) return;
  function onReady() { vid.classList.add('ready'); }
  if (vid.readyState >= 2) onReady();
  else {
    vid.addEventListener('loadeddata', onReady, { once: true });
    vid.addEventListener('canplay',    onReady, { once: true });
  }
  vid.addEventListener('timeupdate', () => {
    const rem = vid.duration - vid.currentTime;
    if (rem < 1 && rem > 0) vid.style.opacity = String(Math.max(0, rem));
    else if (vid.currentTime < 0.5) { vid.style.opacity = ''; vid.classList.add('ready'); }
  });
}

/* ── Sidebar active-link helper ──────────────────────────── */
function initSidebar() {
  const page = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    if (el.dataset.page === page) el.classList.add('active');
  });
  // User display
  const user = Auth.getCurrentUser();
  if (user) {
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name; });
    document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = user.email; });
    document.querySelectorAll('[data-user-initial]').forEach(el => {
      el.textContent = user.name ? user.name[0].toUpperCase() : '?';
    });
  }
}

/* ── Logo SVG snippet (reused in every page) ─────────────── */
  const LOGO_SVG = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><linearGradient id="cGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#FFC233"/><stop offset="100%" stop-color="#F58A07"/>
  </linearGradient></defs>
  <rect x="7" y="7" width="3.5" height="18" rx="1.2" fill="url(#cGrad)"/>
  <path d="M10.5 7h5a4 4 0 0 1 0 8h-5V7z" fill="url(#cGrad)"/>
  <path d="M13.5 15l5.5 10h-4l-5-10z" fill="url(#cGrad)"/>
  <rect x="21" y="7" width="3.5" height="18" rx="1.2" fill="url(#cGrad)" opacity=".72"/>
  <rect x="21" y="21.5" width="8" height="3.5" rx="1.2" fill="url(#cGrad)" opacity=".72"/>
</svg>`;

/* ── Google G SVG ────────────────────────────────────────── */
const GOOGLE_SVG = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;
