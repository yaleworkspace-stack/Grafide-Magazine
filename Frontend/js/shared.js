/* ============================================================
   GRAFIDE — shared.js
   API layer, header/footer, toast, nav — imported by every page
   ============================================================ */
'use strict';

// ── Config ─────────────────────────────────────────────────────
// Local dev:  Live Server runs on :5500, Spring backend on :8080
//             So we must use an absolute URL pointing at :8080
// Production: replace the Render URL below with your actual backend URL
const _LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const BASE = _LOCAL
  ? 'http://localhost:8080/api'
  : 'https://grafide-magazine-backend.onrender.com/api';

// ── API helpers ────────────────────────────────────────────────
async function _request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

const Api = {
  get:    (path, tok)        => _request('GET',    path, null, tok),
  post:   (path, body, tok)  => _request('POST',   path, body, tok),
  put:    (path, body, tok)  => _request('PUT',    path, body, tok),
  delete: (path, tok)        => _request('DELETE', path, null, tok),
};

// ── Domain-level API objects ────────────────────────────────────
const Articles = {
  list:           (page = 0)      => Api.get(`/articles?page=${page}&size=12`),
  listByCategory: (cat, page = 0) => Api.get(`/articles?category=${encodeURIComponent(cat)}&page=${page}&size=12`),
  get:            (id)            => Api.get(`/articles/${id}`),
  update:         (id, d, tok)    => Api.put(`/articles/${id}`, d, tok),
  delete:         (id, tok)       => Api.delete(`/articles/${id}`, tok),
  pin:            (id, tok)       => Api.put(`/articles/${id}/pin`,       {}, tok),
  unpin:          (id, tok)       => Api.put(`/articles/${id}/unpin`,     {}, tok),
  unpublish:      (id, tok)       => Api.put(`/articles/${id}/unpublish`, {}, tok),
  republish:      (id, tok)       => Api.put(`/articles/${id}/republish`, {}, tok),
  search:         (q)             => Api.get(`/articles/search?q=${encodeURIComponent(q)}`),
};

const Submissions = {
  create:   (d, tok)        => Api.post('/submissions', d, tok),
  mine:     (tok)           => Api.get('/submissions/mine', tok),
  queue:    (tok)           => Api.get('/submissions/queue', tok),
  get:      (id, tok)       => Api.get(`/submissions/${id}`, tok),
  resubmit: (id, d, tok)    => Api.put(`/submissions/${id}/resubmit`, d, tok),
  withdraw: (id, tok)       => Api.delete(`/submissions/${id}/withdraw`, tok),
  approve:  (id, tok)       => Api.put(`/submissions/${id}/approve`, {}, tok),
  return:   (id, note, tok) => Api.put(`/submissions/${id}/return`, { note }, tok),
};

const Magazines = {
  list:   ()          => Api.get('/magazines'),
  get:    (id)        => Api.get(`/magazines/${id}`),
  delete: (id, tok)   => Api.delete(`/magazines/${id}`, tok),
};

const Subscribers = {
  subscribe: (email) => Api.post('/subscribers', { email }),
  list:      (tok)   => Api.get('/subscribers', tok),
};

const Auth = {
  login:          (username, password)                              => Api.post('/auth/login',          { username, password }),
  register:       (username, password, displayName, email, code)   => Api.post('/auth/register',        { username, password, displayName, email, editorCode: code }),
  forgotPassword: (username)                                        => Api.post('/auth/forgot-password', { username }),
  resetPassword:  (token, password)                                 => Api.post('/auth/reset-password',  { token, password }),
};

const Contact = {
  send:    (d)       => Api.post('/contact', d),
  list:    (tok)     => Api.get('/contact', tok),
  markRead:(id, tok) => Api.put(`/contact/${id}/read`, {}, tok),
};

// Upload helper — used by submit.js and editor.js
async function uploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const session = getSession();
  const headers = session ? { 'Authorization': `Bearer ${session.token}` } : {};
  const res = await fetch(BASE + '/upload/image', { method: 'POST', headers, body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Image upload failed.');
  }
  return res.json(); // { url: '...' }
}

// ── Session helpers ─────────────────────────────────────────────
function getSession() {
  try { const r = localStorage.getItem('grafide_session'); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveSession(s) { localStorage.setItem('grafide_session', JSON.stringify(s)); }
function clearSession()  { localStorage.removeItem('grafide_session'); }
function isEditor(session) { return session?.role === 'editor'; }

// ── Utilities ───────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = d => { try { return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); } catch { return ''; } };
const coverUrl = a => (a?.coverImageUrls && a.coverImageUrls[0]) || '/images/logo.png';

// ── Toast ───────────────────────────────────────────────────────
let _toast = null;
function showToast(msg) {
  if (!_toast) {
    _toast = document.createElement('div');
    _toast.className = 'toast';
    document.body.appendChild(_toast);
  }
  _toast.textContent = msg;
  _toast.classList.add('show');
  setTimeout(() => _toast.classList.remove('show'), 3000);
}

// ── Social SVGs ─────────────────────────────────────────────────
const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/grafidemagazines',
    svg: `<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>` },
  { label: 'X', href: 'https://x.com/grafidemagazine',
    svg: `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
  { label: 'Pinterest', href: 'https://www.pinterest.com/GrafideMagazines',
    svg: `<svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>` },
  { label: 'YouTube', href: 'https://www.youtube.com/@grafidemagazines',
    svg: `<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` },
  { label: 'TikTok', href: 'https://www.tiktok.com/@grafidemagazines',
    svg: `<svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/></svg>` },
  { label: 'Facebook', href: 'https://www.facebook.com/grafidemagazines',
    svg: `<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>` },
];

const BRAND_WORDS = ['Fashion', 'Style', 'Culture', 'Photography', 'Lifestyle'];

// ── Header renderer ─────────────────────────────────────────────
function renderHeader(activePage = '') {
  const session  = getSession();
  const editor   = isEditor(session);

  const navLinks = [
    { label: 'Home',         href: '/index.html',              key: 'home' },
    { label: 'Fashion',      href: '/pages/fashion.html',      key: 'fashion' },
    { label: 'Lifestyle',    href: '/pages/lifestyle.html',    key: 'lifestyle' },
    { label: 'Photography',  href: '/pages/photography.html',  key: 'photography' },
    { label: 'Culture',      href: '/pages/culture.html',      key: 'culture' },
    { label: 'Magazines',    href: '/pages/magazine.html',     key: 'magazine' },
    { label: 'Podcast',      href: '/pages/podcast.html',      key: 'podcast' },
    { label: 'Shop',         href: '/pages/shop.html',         key: 'shop' },
  ];

  const authLinks = session ? [
    { label: 'Submit',          href: '/pages/submit.html',   key: 'submit' },
    { label: 'My Submissions',  href: '/pages/submit.html#mine', key: 'mine' },
  ] : [];

  const editorLinks = editor ? [
    { label: 'Review Queue', href: '/pages/editor.html#review',       key: 'review' },
    { label: 'Manage',       href: '/pages/editor.html#manage',       key: 'manage' },
    { label: 'Upload Issue', href: '/pages/editor.html#upload',       key: 'upload' },
    { label: 'Subscribers',  href: '/pages/editor.html#subscribers',  key: 'subscribers' },
  ] : [];

  const allLinks = [...navLinks, ...authLinks, ...editorLinks];

  const linksHtml = allLinks.map(l =>
    `<a href="${l.href}" class="nav-link${activePage === l.key ? ' active' : ''}">${l.label}</a>`
  ).join('');

  // Search (also injected into mobile drawer)
  const searchHtml = `
    <form class="header-search" id="header-search-form" role="search">
      <input type="search" id="header-search-input" class="header-search-input"
             placeholder="Search…" aria-label="Search articles" />
      <button type="submit" class="header-search-btn" aria-label="Search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
        </svg>
      </button>
    </form>`;

  const accountHtml = session
    ? `<div class="account-pill">
        <span class="diamond"></span>
        <span>${esc(session.displayName)}</span>
        ${editor ? '<span class="editor-badge">Editor</span>' : ''}
        <button class="nav-link" id="signout-btn">Sign Out</button>
       </div>`
    : `<a href="/pages/auth.html" class="nav-link${activePage==='auth'?' active':''}">Sign In</a>`;

  const el = document.getElementById('site-header');
  if (!el) return;
  el.innerHTML = `
    <a class="logo" href="/index.html" aria-label="Grafide home">
      <img src="/images/logo.png" alt="Grafide" class="logo-img" />
    </a>
    <button id="nav-toggle" class="nav-toggle" aria-label="Toggle menu">
      <span></span><span></span><span></span>
    </button>
    <nav id="main-nav" class="main-nav">
      ${linksHtml}
      ${searchHtml}
    </nav>
    <div class="header-right">
      ${searchHtml.replace('header-search-form','header-search-form-desk').replace('header-search-input','header-search-input-desk')}
      ${accountHtml}
    </div>`;

  // Burger toggle
  const toggle  = document.getElementById('nav-toggle');
  const nav     = document.getElementById('main-nav');
  toggle?.addEventListener('click', e => {
    e.stopPropagation();
    toggle.classList.toggle('open');
    nav.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!nav?.contains(e.target) && !toggle?.contains(e.target) && nav?.classList.contains('open')) {
      nav.classList.remove('open');
      toggle?.classList.remove('open');
    }
  });
  nav?.querySelectorAll('a.nav-link').forEach(a => {
    a.addEventListener('click', () => { nav.classList.remove('open'); toggle?.classList.remove('open'); });
  });

  // Search submit — goes to a search results page or uses query param
  const searchForms = document.querySelectorAll('#header-search-form, #header-search-form-desk');
  searchForms.forEach(form => {
    form?.addEventListener('submit', e => {
      e.preventDefault();
      const q = form.querySelector('input')?.value.trim();
      if (q) window.location.href = `/pages/search.html?q=${encodeURIComponent(q)}`;
    });
  });

  // Sign out
  document.getElementById('signout-btn')?.addEventListener('click', () => {
    clearSession();
    window.location.href = '/index.html';
  });
}

// ── Footer renderer ─────────────────────────────────────────────
function renderFooter(subMsg = '', subErr = false) {
  const el = document.getElementById('site-footer');
  if (!el) return;

  const socialsHtml = SOCIALS.map(s =>
    `<a href="${s.href}" target="_blank" rel="noopener" class="social-link" aria-label="${s.label}">${s.svg}</a>`
  ).join('');

  const msgHtml = subMsg
    ? `<p class="subscribe-msg ${subErr ? 'error' : 'success'}">${esc(subMsg)}</p>`
    : '';

  el.innerHTML = `
    <div class="footer-subscribe">
      <div class="subscribe-strip">
        <span class="subscribe-label">Stay in the loop</span>
        <div class="subscribe-form">
          <input type="email" id="subscribe-email" class="subscribe-input" placeholder="Your email address" />
          <button class="btn" id="subscribe-btn">Subscribe</button>
        </div>
        ${msgHtml}
      </div>
    </div>

    <div class="footer-body">
      <div class="footer-brand">
        <img src="/images/logo.png" alt="Grafide" class="logo-img" />
        <p class="footer-tagline">A space dedicated to the art of fashion, culture, and photography.</p>
        <div class="footer-socials">${socialsHtml}</div>
      </div>

      <div class="footer-col">
        <h5>Explore</h5>
        <a href="/pages/fashion.html">Fashion</a>
        <a href="/pages/lifestyle.html">Lifestyle</a>
        <a href="/pages/photography.html">Photography</a>
        <a href="/pages/culture.html">Culture</a>
        <a href="/pages/magazine.html">Magazines</a>
        <a href="/pages/podcast.html">Podcast</a>
        <a href="/pages/shop.html">Shop</a>
      </div>

      <div class="footer-col">
        <h5>Grafide</h5>
        <a href="/pages/about.html">About</a>
        <a href="/pages/contact.html">Contact</a>
        <a href="/pages/work-with-us.html">Work With Us</a>
        <a href="/pages/brand-apply.html">Partner With Us</a>
        <a href="/pages/orders.html">My Orders</a>
      </div>

      <div class="footer-col">
        <h5>Legal</h5>
        <a href="/pages/terms.html">Terms of Use</a>
        <a href="/pages/privacy.html">Privacy Policy</a>
        <a href="/pages/cookies.html">Cookie Policy</a>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="tagline-words">
        ${BRAND_WORDS.map((w, i) =>
          i < BRAND_WORDS.length - 1
            ? `<span>${w}</span><span class="diamond diamond-sm" style="opacity:.4"></span>`
            : `<span>${w}</span>`
        ).join('')}
      </div>
      <p class="footer-copyright">&copy; ${new Date().getFullYear()} Grafide</p>
    </div>`;

  // Subscribe handler
  document.getElementById('subscribe-btn')?.addEventListener('click', handleSubscribe);
  document.getElementById('subscribe-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubscribe(); }
  });
}

async function handleSubscribe() {
  const input = document.getElementById('subscribe-email');
  const email = input?.value.trim();
  if (!email || !email.includes('@')) {
    renderFooter('Please enter a valid email address.', true); return;
  }
  try {
    const r = await Subscribers.subscribe(email);
    renderFooter(r.message || 'You\'re subscribed — welcome!', false);
  } catch (err) {
    renderFooter(err.message || 'Something went wrong. Please try again.', true);
  }
}

// ── Init shared layout ──────────────────────────────────────────
// Call this from each page's own JS: initLayout('fashion')
function initLayout(activePage = '') {
  renderHeader(activePage);
  renderFooter();
}
