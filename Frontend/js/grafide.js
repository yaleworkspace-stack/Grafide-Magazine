/* ============================================================
   GRAFIDE — grafide.js
   ============================================================ */
'use strict';

// ============================================================
// API LAYER
// ============================================================
const BASE = window.location.hostname === 'localhost'
  ? '/api'
  : 'https://grafide-magazine-s4ol.onrender.com/api';
async function _request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
const Api = {
  get:    (path, tok)       => _request('GET',    path, null, tok),
  post:   (path, body, tok) => _request('POST',   path, body, tok),
  put:    (path, body, tok) => _request('PUT',    path, body, tok),
  delete: (path, tok)       => _request('DELETE', path, null, tok),
};

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
const Subscribers = {
  subscribe: (email) => Api.post('/subscribers', { email }),
  list:      (tok)   => Api.get('/subscribers', tok),
};
const Submissions = {
  create:   (d, tok)         => Api.post('/submissions', d, tok),
  mine:     (tok)            => Api.get('/submissions/mine', tok),
  queue:    (tok)            => Api.get('/submissions/queue', tok),
  get:      (id, tok)        => Api.get(`/submissions/${id}`, tok),
  resubmit: (id, d, tok)     => Api.put(`/submissions/${id}/resubmit`, d, tok),
  withdraw: (id, tok)        => Api.delete(`/submissions/${id}/withdraw`, tok),
  approve:  (id, tok)        => Api.put(`/submissions/${id}/approve`, {}, tok),
  return:   (id, note, tok)  => Api.put(`/submissions/${id}/return`, { note }, tok),
};
const Auth = {
  login:         (username, password)                           => Api.post('/auth/login',          { username, password }),
  register:      (username, password, displayName, email, code) => Api.post('/auth/register',        { username, password, displayName, email, editorCode: code }),
  forgotPassword: (username)                                    => Api.post('/auth/forgot-password', { username }),
  resetPassword:  (token, password)                             => Api.post('/auth/reset-password',  { token, password }),
};

// ============================================================
// CONSTANTS
// ============================================================
const BRAND_WORDS = ['Fashion', 'Style', 'Culture', 'Photography', 'Lifestyle'];
const CATEGORIES  = ['Fashion', 'Lifestyle', 'Photography', 'Culture', 'Podcast'];
const SITE_DESC   = 'A space dedicated to the art of fashion, culture, and photography.';

// ============================================================
// URL HELPERS
// ============================================================
function viewToUrl(v) {
  switch (v.name) {
    case 'home':            return '/';
    case 'article':         return `/article/${v.id || ''}`;
    case 'category':        return `/category/${encodeURIComponent(v.cat || '')}`;
    case 'edit-article':    return `/edit-article/${v.id || ''}`;
    case 'resubmit':        return `/resubmit/${v.id || ''}`;
    case 'reset-password':  return `/reset-password?token=${v.token || ''}`;
    case 'search':          return `/search?q=${encodeURIComponent(v.q || '')}`;
    case 'forgot-password': return '/forgot-password';
    default:                return `/${v.name}`;
  }
}

function urlToView() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const [seg, param] = parts;
  if (!seg) return { name: 'home' };
  if (seg === 'article'         && param) return { name: 'article',         id: param };
  if (seg === 'category'        && param) return { name: 'category',        cat: decodeURIComponent(param) };
  if (seg === 'edit-article'    && param) return { name: 'edit-article',    id: param };
  if (seg === 'resubmit'        && param) return { name: 'resubmit',        id: param };
  if (seg === 'reset-password')           return { name: 'reset-password',  token: new URLSearchParams(window.location.search).get('token') || '' };
  if (seg === 'search')                   return { name: 'search', q: new URLSearchParams(window.location.search).get('q') || '' };
  if (seg === 'forgot-password')          return { name: 'forgot-password' };
  const valid = ['submit','auth','mine','review','manage','subscribers'];
  return valid.includes(seg) ? { name: seg } : { name: 'home' };
}

function pageTitle(v, articleData) {
  const s = ' — Grafide';
  switch (v.name) {
    case 'home':            return 'Grafide — A space dedicated to the art of fashion.';
    case 'article':  return ((articleData?.title) || 'Article') + s;
    case 'category':        return (v.cat || '') + s;
    case 'submit':          return 'Submit' + s;
    case 'mine':            return 'My Submissions' + s;
    case 'resubmit':        return 'Edit & Resubmit' + s;
    case 'review':          return 'Review Queue' + s;
    case 'manage':          return 'Manage Articles' + s;
    case 'subscribers':     return 'Subscribers' + s;
    case 'auth':            return 'Sign In' + s;
    case 'search':          return (v.q ? `"${v.q}"` : 'Search') + s;
    case 'forgot-password': return 'Forgot Password' + s;
    case 'reset-password':  return 'Reset Password' + s;
    default:                return 'Grafide';
  }
}

// ── OG/Twitter meta tag updater ──────────────────────────
function updateMeta(v, articleData) {
  const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); };
  const url = window.location.origin + viewToUrl(v);
  let title = pageTitle(v, articleData), desc = SITE_DESC, image = '';

  if (v.name === 'article' && articleData) {
    const a = articleData;
    title = `${a.title} — Grafide`;
    desc  = a.dek || SITE_DESC;
    image = (a.coverImageUrls && a.coverImageUrls[0]) || '/images/logo.png';
  } else if (v.name === 'search') {
    title = (v.q ? `"${v.q}"` : 'Search') + ' — Grafide';
    desc  = v.q ? `Search results for "${v.q}" on Grafide.` : 'Search Grafide';
  } else if (v.name === 'category') {
    title = `${v.cat} — Grafide`;
    desc  = `Explore ${v.cat} stories on Grafide.`;
  }

  document.title = title;
  set('meta[property="og:title"]',       title);
  set('meta[property="og:description"]', desc);
  set('meta[property="og:image"]',       image);
  set('meta[property="og:url"]',         url);
  set('meta[property="og:type"]',        v.name === 'article' ? 'article' : 'website');
  set('meta[name="twitter:title"]',      title);
  set('meta[name="twitter:description"]',desc);
  set('meta[name="twitter:image"]',      image);
}

// ============================================================
// QUILL EDITOR
// ============================================================
let quillEditor = null;

function initQuill(containerId, initialHtml = '') {
  const el = document.getElementById(containerId);
  if (!el || typeof Quill === 'undefined') return;
  quillEditor = new Quill(el, {
    theme: 'snow',
    placeholder: 'Write your article here…',
    modules: {
      toolbar: {
        container: [
          ['bold', 'italic'],
          [{ header: [2, 3, false] }],
          ['blockquote', 'link', 'image'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['clean']
        ],
        handlers: {
          image: async function() {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.style.display = 'none';
            document.body.appendChild(input);

            input.addEventListener('change', async () => {
              const file = input.files && input.files[0];
              if (!file) {
                document.body.removeChild(input);
                return;
              }

              const range = quillEditor.getSelection(true);
              const formData = new FormData();
              formData.append('file', file);

              try {
                const headers = {};
                if (window.state?.session?.token) {
                  headers.Authorization = `Bearer ${window.state.session.token}`;
                }

                const res = await fetch(BASE + '/upload/inline-image', {
                  method: 'POST',
                  headers,
                  body: formData
                });

                if (!res.ok) {
                  showToast('Image upload failed.');
                  return;
                }

                const data = await res.json();
                quillEditor.insertEmbed(range.index, 'image', data.url);
                quillEditor.setSelection(range.index + 1);
              } catch (error) {
                console.error('Inline image upload error', error);
                showToast('Image upload failed.');
              } finally {
                document.body.removeChild(input);
              }
            }, { once: true });

            input.click();
          }
        }
      }
    }
  });
  if (initialHtml) quillEditor.clipboard.dangerouslyPasteHTML(initialHtml);
}

function getQuillHtml() {
  if (!quillEditor) return '';
  const html = quillEditor.root.innerHTML;
  return html === '<p><br></p>' ? '' : html;
}

// ============================================================
// RENDER
// ============================================================
const Render = (() => {
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmt = d => { try { return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); } catch { return ''; } };
  const coverImageUrl = article => (article?.coverImageUrls && article.coverImageUrls[0]) || '/images/logo.png';

  // ── Header ──────────────────────────────────────────────
  function header(session, currentView, searchQuery = '') {
    const isEditor = session?.role === 'editor';
    const nb = (view, label) => `<button class="linklike ${currentView===view?'active':''}" data-nav="${view}">${label}</button>`;
    const cats = CATEGORIES.map(c => `<button class="linklike ${currentView==='category-'+c?'active':''}" data-nav="category" data-cat="${c}">${c}</button>`).join('');
    const editorNav = isEditor ? `${nb('review','Review Queue')}${nb('manage','Manage')}${nb('subscribers','Subscribers')}` : '';
    const account = session
      ? `<div class="account-pill"><span class="diamond"></span><span>${esc(session.displayName)}</span>${isEditor?'<span class="editor-badge">Editor</span>':''}<button class="linklike" id="signout-btn">Sign Out</button></div>`
      : `<button class="linklike" data-nav="auth">Sign In / Register</button>`;
    return `
      <a class="logo" data-nav="home" href="/" aria-label="Grafide home">
        <img src='/images/logo.png' alt="Grafide" class="logo-img" />
      </a>
      <button id="nav-toggle" class="nav-toggle" aria-label="Toggle navigation menu">
        <span></span><span></span><span></span>
      </button>
      <nav id="main-nav" class="main-nav nav">${nb('home','Home')}${cats}${session?nb('submit','Submit'):''}${session?nb('mine','My Submissions'):''}${editorNav}</nav>
      <div class="header-right">
        <form class="header-search" id="header-search-form" role="search">
          <input type="search" id="header-search-input" class="header-search-input"
                 placeholder="Search…" value="${esc(searchQuery)}" aria-label="Search articles" />
          <button type="submit" class="header-search-btn" aria-label="Search">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          </button>
        </form>
        ${account}
      </div>`;
  }

  // ── Footer ───────────────────────────────────────────────
  function footer(subMsg = '', subErr = false) {
    const ig  = `<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`;
    const x   = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    const pin = `<svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>`;
    const msgHtml = subMsg ? `<p class="subscribe-msg ${subErr?'error':'success'}">${esc(subMsg)}</p>` : '';
    return `
      <div class="footer-top">
        <div class="subscribe-strip">
          <span class="subscribe-label">Stay in the loop</span>
          <div class="subscribe-form">
            <input type="email" id="subscribe-email" class="subscribe-input" placeholder="Your email address" />
            <button class="button" id="subscribe-btn">Subscribe</button>
          </div>
          ${msgHtml}
        </div>
      </div>
      <div class="footer-bottom">
        <div class="tagline">${BRAND_WORDS.map(w=>`<span>${w}</span>`).join('<span class="diamond" style="opacity:.4"></span>')}</div>
        <div class="social-links">
          <a href="https://www.instagram.com/grafidemagazines" target="_blank" rel="noopener" class="social-link" aria-label="Instagram">${ig}</a>
          <a href="https://x.com/grafidemagazine" target="_blank" rel="noopener" class="social-link" aria-label="X">${x}</a>
          <a href="https://www.pinterest.com/GrafideMagazines" target="_blank" rel="noopener" class="social-link" aria-label="Pinterest">${pin}</a>
        </div>
        <p class="copyright">&copy; ${new Date().getFullYear()} Grafide</p>
      </div>`;
  }

  // ── Home ─────────────────────────────────────────────────
  function home(articles, hasMore) {
    if (!articles) return `<div class="loading">Loading&hellip;</div>`;
    if (!articles.length) return `<div class="empty-state">No articles yet.</div>`;
    const hero = articles[0], heroImage = coverImageUrl(hero), rest = articles.slice(1);
    return `
      <div class="hero" data-nav="article" data-id="${esc(hero.id)}">
        <img src="${esc(heroImage)}" alt="${esc(hero.title)}" />
        <div class="hero-overlay">
          <div class="eyebrow"><span class="diamond"></span>${esc(hero.category)}${hero.pinned?'&nbsp;&nbsp;Cover Story':''}</div>
          <h1 class="hero-title">${esc(hero.title)}</h1>
          <p class="hero-dek">${esc(hero.dek)}</p>
          <button class="hero-link" data-nav="article" data-id="${esc(hero.id)}">Read Article <span>&#8594;</span></button>
        </div>
      </div>
      <div class="tagline-strip">${BRAND_WORDS.map(w=>`<span>${w}</span>`).join('<span class="diamond diamond-sm"></span>')}</div>
      ${rest.length ? `<section class="section"><div class="section-head"><h2>Latest</h2><div class="line"></div></div><div class="grid">${rest.map(card).join('')}</div>${hasMore?`<div class="load-more-wrap"><button class="button ghost load-more-btn" data-type="home">Load More</button></div>`:''}</section>` : ''}`;
  }

  function card(a) {
    const thumbnail = coverImageUrl(a);
    return `<div class="card" data-nav="article" data-id="${esc(a.id)}"><div class="card-image-wrap"><img src="${esc(thumbnail)}" alt="${esc(a.title)}" loading="lazy" /></div><span class="card-category">${esc(a.category)}</span><h3 class="card-title">${esc(a.title)}</h3><p class="card-dek">${esc(a.dek)}</p><span class="card-byline">By ${esc(a.author)}</span></div>`;
  }

  // ── Category ─────────────────────────────────────────────
  function category(cat, articles, hasMore) {
    if (!articles) return `<div class="loading">Loading&hellip;</div>`;
    return `<section class="section"><div class="section-head"><h2>${esc(cat)}</h2><div class="line"></div></div>${!articles.length?`<div class="empty-state">Nothing in ${esc(cat)} yet.</div>`:`<div class="grid">${articles.map(card).join('')}</div>${hasMore?`<div class="load-more-wrap"><button class="button ghost load-more-btn" data-type="category">Load More</button></div>`:''}`}</section>`;
  }

  // ── Article ───────────────────────────────────────────────
  function article(a, isEditor = false) {
    if (!a) return `<div class="loading">Loading&hellip;</div>`;
    // Prefer richBody (Quill HTML); fall back to plain-text paragraphs
    const bodyHtml = (a.richBody && a.richBody.trim())
      ? a.richBody
      : (Array.isArray(a.body) ? a.body.map(p=>`<p>${esc(p)}</p>`).join('') : `<p>${esc(a.body??'')}</p>`);
    const coverSrc = coverImageUrl(a);
    const editorControls = isEditor ? `<div class="editor-controls"><button class="button ghost" data-nav="edit-article" data-id="${esc(a.id)}">Edit</button><button class="button ghost delete-article-btn" data-id="${esc(a.id)}" style="border-color:#B23A48;color:#B23A48">Delete</button></div>` : '';
    return `
      <div class="article-page">
        <button class="back-link" onclick="history.back()">&#8592; Back to Grafide</button>
        ${editorControls}
        <div class="article-cover"><img src="${esc(coverSrc)}" alt="${esc(a.title)}" /></div>
        <p class="article-category">${esc(a.category)}</p>
        <h1 class="article-title">${esc(a.title)}</h1>
        <p class="article-dek">${esc(a.dek)}</p>
        <p class="article-byline">By ${esc(a.author)} &nbsp;·&nbsp; ${fmt(a.date)}</p>
        <div class="article-body">${bodyHtml}</div>
      </div>`;
  }

  // ── Auth ─────────────────────────────────────────────────
  function auth(mode = 'signin', error = '') {
    const isSignIn = mode === 'signin';
    return `
      <div class="form-page">
        <h1>${isSignIn ? 'Sign In' : 'Create an Account'}</h1>
        <p class="form-sub">${isSignIn ? 'Welcome back.' : 'Join Grafide as a creator.'}</p>
        <div class="auth-tabs">
          <button ${isSignIn?'class="active"':''} data-auth-tab="signin">Sign In</button>
          <button ${!isSignIn?'class="active"':''} data-auth-tab="register">Register</button>
        </div>
        <form id="auth-form" novalidate>
          ${!isSignIn?`<div class="field"><label>Display Name</label><input id="f-display" type="text" /></div>`:''}
          <div class="field"><label>Username</label><input id="f-username" type="text" autocomplete="username" /></div>
          <div class="field"><label>Password</label><input id="f-password" type="password" autocomplete="${isSignIn?'current-password':'new-password'}" /></div>
          ${!isSignIn?`<div class="field"><label>Email <span class="field-hint">(optional — needed for password reset)</span></label><input id="f-email" type="email" /></div><div class="field"><label>Editor Access Code <span class="field-hint">(leave blank if you're a creator)</span></label><input id="f-editor-code" type="text" placeholder="Optional" /></div>`:''}
          ${error?`<p class="error-text">${esc(error)}</p>`:''}
          <button class="button" type="submit">${isSignIn ? 'Sign In' : 'Create Account'}</button>
          ${isSignIn?`<p style="margin-top:14px;font-size:.85rem"><button class="linklike" data-nav="forgot-password" style="font-size:.85rem">Forgot your password?</button></p>`:''}
        </form>
      </div>`;
  }

  // ── Forgot Password ───────────────────────────────────────
  function forgotPassword(success = false, error = '') {
    if (success) return `
      <div class="form-page">
        <h1>Check your inbox</h1>
        <div class="success-box">If that username exists and has an email on file, a reset link has been sent. No email address stored? Check your Render server logs for the reset link.</div>
        <p style="margin-top:20px"><button class="button ghost" data-nav="auth">Back to Sign In</button></p>
      </div>`;
    return `
      <div class="form-page">
        <button class="back-link" data-nav="auth">&#8592; Back to Sign In</button>
        <h1>Forgot Password</h1>
        <p class="form-sub">Enter your username. We'll send a reset link to the email on your account — or log it to the server console if no email is stored.</p>
        <form id="forgot-form" novalidate>
          <div class="field"><label>Username</label><input id="f-forgot-username" type="text" autocomplete="username" /></div>
          ${error?`<p class="error-text">${esc(error)}</p>`:''}
          <button class="button" type="submit">Send Reset Link</button>
        </form>
      </div>`;
  }

  // ── Reset Password ────────────────────────────────────────
  function resetPassword(token = '', success = false, error = '') {
    if (success) return `
      <div class="form-page">
        <h1>Password updated</h1>
        <div class="success-box">Your password has been changed. You can now sign in.</div>
        <p style="margin-top:20px"><button class="button" data-nav="auth">Sign In</button></p>
      </div>`;
    if (!token) return `
      <div class="form-page">
        <h1>Invalid link</h1>
        <p class="form-sub">This reset link is missing a token. Please request a new one.</p>
        <button class="button ghost" data-nav="forgot-password">Request Reset</button>
      </div>`;
    return `
      <div class="form-page">
        <h1>Reset Password</h1>
        <p class="form-sub">Choose a new password for your account.</p>
        <form id="reset-form" novalidate>
          <input type="hidden" id="f-reset-token" value="${esc(token)}" />
          <div class="field"><label>New Password</label><input id="f-reset-password" type="password" autocomplete="new-password" /></div>
          <div class="field"><label>Confirm Password</label><input id="f-reset-confirm" type="password" autocomplete="new-password" /></div>
          ${error?`<p class="error-text">${esc(error)}</p>`:''}
          <button class="button" type="submit">Set New Password</button>
        </form>
      </div>`;
  }

  // ── Submit ────────────────────────────────────────────────
  function submit(success = false, error = '') {
    if (success) return `<div class="form-page"><h1>Submitted</h1><div class="success-box">Your piece is in the review queue. Track it under <em>My Submissions</em>.</div></div>`;
    const catOpts = CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('');
    return `
      <div class="form-page">
        <h1>Submit a Piece</h1>
        <p class="form-sub">Share your work with the Grafide editorial team.</p>
        <form id="submit-form" novalidate>
          <div class="field"><label>Title</label><input id="f-title" type="text" /></div>
          <div class="field"><label>Category</label><select id="f-category">${catOpts}</select></div>
          <div class="field" id="video-url-field" style="display:none"><label>Video URL</label><input id="f-video-url" type="url" placeholder="https://youtube.com/embed/... or https://player.vimeo.com/video/..." /></div>
          <div class="field"><label>Short Description</label><input id="f-dek" type="text" /></div>
          <div class="field"><label>Cover Image URL</label><input id="f-cover" type="text" placeholder="https://…" /></div>
          <div class="field"><label>Or upload cover images</label><input id="f-cover-file" type="file" accept="image/*" multiple /><div id="image-preview-strip" class="image-preview-strip"></div></div>
          <div class="field"><label>Article Text</label><div id="quill-container" class="quill-editor"></div></div>
          ${error?`<p class="error-text">${esc(error)}</p>`:''}
          <button class="button" type="submit">Submit Piece</button>
        </form>
      </div>`;
  }

  // ── My Submissions ────────────────────────────────────────
  function mine(submissions) {
    if (!submissions) return `<div class="loading">Loading&hellip;</div>`;
    if (!submissions.length) return `<div class="form-page"><h1>My Submissions</h1><div class="empty-state"><button class="linklike" data-nav="submit">Submit your first piece</button></div></div>`;
    const items = submissions.map(s => `
      <div class="list-item">
        <div style="flex:1">
          <div class="list-item-title">${esc(s.title)}</div>
          <div class="list-item-meta">${esc(s.category)} · ${fmt(s.date)}</div>
          ${s.note?`<div class="review-note">Editor note: ${esc(s.note)}</div>`:''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="status-badge status-${esc(s.status)}">${esc(s.status)}</span>
          ${s.status==='returned'?`<button class="button ghost resubmit-btn" data-id="${esc(s.id)}" style="padding:7px 14px;font-size:.72rem">Edit &amp; Resubmit</button>`:''}
          ${s.status==='pending'?`<button class="button ghost withdraw-btn" data-id="${esc(s.id)}" style="padding:7px 14px;font-size:.72rem;border-color:#B23A48;color:#B23A48">Withdraw</button>`:''}
        </div>
      </div>`).join('');
    return `<div class="form-page" style="max-width:820px"><h1>My Submissions</h1>${items}</div>`;
  }

  // ── Resubmit ──────────────────────────────────────────────
  function resubmit(s, error = '') {
    if (!s) return `<div class="loading">Loading&hellip;</div>`;
    const catOpts = CATEGORIES.map(c=>`<option value="${c}" ${s.category===c?'selected':''}>${c}</option>`).join('');
    return `
      <div class="form-page">
        <button class="back-link" data-nav="mine">&#8592; Back to My Submissions</button>
        <h1>Edit &amp; Resubmit</h1>
        ${s.note?`<div class="success-box" style="border-color:#9A6A1B;background:#FBF1DD;margin-bottom:28px"><strong>Editor's note:</strong> ${esc(s.note)}</div>`:''}
        <p class="form-sub">Make your changes and resubmit for review.</p>
        <form id="resubmit-form" novalidate>
          <input type="hidden" id="f-resub-id" value="${esc(s.id)}" />
          <div class="field"><label>Title</label><input id="f-resub-title" type="text" value="${esc(s.title)}" /></div>
          <div class="field"><label>Category</label><select id="f-resub-category">${catOpts}</select></div>
          <div class="field"><label>Short Description</label><input id="f-resub-dek" type="text" value="${esc(s.dek)}" /></div>
          <div class="field"><label>Cover Image URL</label><input id="f-resub-cover" type="text" value="${esc(s.coverImage||'')}" /></div>
          <div class="field"><label>Article Text</label><div id="quill-container" class="quill-editor"></div></div>
          ${error?`<p class="error-text">${esc(error)}</p>`:''}
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="button" type="submit">Resubmit for Review</button>
            <button class="button ghost" type="button" data-nav="mine">Cancel</button>
          </div>
        </form>
      </div>`;
  }

  // ── Review Queue ──────────────────────────────────────────
  function review(queue, expandedId) {
    if (!queue) return `<div class="loading">Loading&hellip;</div>`;
    if (!queue.length) return `<div class="form-page"><h1>Review Queue</h1><div class="empty-state">Queue is empty.</div></div>`;
    const items = queue.map(s=>`
      <div class="list-item" style="flex-direction:column;align-items:flex-start">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:12px">
          <div><div class="list-item-title">${esc(s.title)}</div><div class="list-item-meta">${esc(s.category)} · By ${esc(s.author)} · ${fmt(s.date)}</div></div>
          <button class="button ghost toggle-review-btn" data-id="${esc(s.id)}">${expandedId===s.id?'Collapse':'Review'}</button>
        </div>
        ${expandedId===s.id?reviewPanel(s):''}
      </div>`).join('');
    return `<div class="form-page" style="max-width:820px"><h1>Review Queue</h1>${items}</div>`;
  }

  function reviewPanel(s) {
    const paras = Array.isArray(s.body)?s.body.map(p=>`<p>${esc(p)}</p>`).join(''):`<p>${esc(s.body??'')}</p>`;
    const bodyHtml = (s.richBody && s.richBody.trim()) ? s.richBody : paras;
    return `
      <div class="review-preview">
        ${((s.coverImage || (Array.isArray(s.coverImageUrls) && s.coverImageUrls.length)) ? `<img src="${esc(s.coverImage || s.coverImageUrls[0])}" class="image-preview" alt="" />` : '')}
        <p class="article-dek" style="margin-top:14px">${esc(s.dek)}</p>
        <div class="article-body" style="margin-top:14px">${bodyHtml}</div>
      </div>
      <div class="review-actions">
        <button class="button approve-btn" data-id="${esc(s.id)}">Publish</button>
        <button class="button ghost return-btn" data-id="${esc(s.id)}">Return to Creator</button>
      </div>
      <textarea class="note-input" id="note-${esc(s.id)}" placeholder="Add a note (optional)…"></textarea>`;
  }

  // ── Manage ────────────────────────────────────────────────
  function manage(articles) {
    if (!articles) return `<div class="loading">Loading&hellip;</div>`;
    if (!articles.length) return `<div class="form-page" style="max-width:860px"><h1>Manage Articles</h1><div class="empty-state">No articles yet.</div></div>`;
    const rows = articles.map(a => {
      const pub = a.published !== false;
      return `
        <div class="list-item" style="${!pub?'opacity:.55':''}">
          <div style="flex:1">
            <div class="list-item-title">${esc(a.title)}${a.pinned?'<span class="status-badge status-published" style="font-size:.62rem;margin-left:8px">Cover Story</span>':''}${!pub?'<span class="status-badge status-returned" style="font-size:.62rem;margin-left:8px">Hidden</span>':''}</div>
            <div class="list-item-meta">${esc(a.category)} · ${esc(a.author)} · ${fmt(a.date)}</div>
          </div>
          <div class="manage-actions">
            ${pub?`<button class="button ghost pin-btn" data-id="${esc(a.id)}" data-pinned="${a.pinned?'1':'0'}">${a.pinned?'Unpin':'Pin as Cover'}</button><button class="button ghost unpublish-btn" data-id="${esc(a.id)}">Hide</button>`:`<button class="button republish-btn" data-id="${esc(a.id)}" style="background:#1F7A5C;border-color:#1F7A5C">Restore</button>`}
            <button class="button ghost edit-article-btn" data-id="${esc(a.id)}">Edit</button>
            <button class="button ghost delete-article-btn" data-id="${esc(a.id)}" style="border-color:#B23A48;color:#B23A48">Delete</button>
          </div>
        </div>`;
    }).join('');
    return `<div class="form-page" style="max-width:900px"><h1>Manage Articles</h1><p class="form-sub">Pin a cover story, edit, hide, or delete articles.</p>${rows}</div>`;
  }

  // ── Edit Article ──────────────────────────────────────────
  function editArticle(a, error = '') {
    if (!a) return `<div class="loading">Loading&hellip;</div>`;
    const catOpts = CATEGORIES.map(c=>`<option value="${c}" ${a.category===c?'selected':''}>${c}</option>`).join('');
    return `
      <div class="form-page">
        <button class="back-link" data-nav="manage">&#8592; Back to Manage</button>
        <h1>Edit Article</h1>
        <p class="form-sub">Changes publish immediately.</p>
        <form id="edit-article-form" novalidate>
          <input type="hidden" id="f-edit-id" value="${esc(a.id)}" />
          <div class="field"><label>Title</label><input id="f-edit-title" type="text" value="${esc(a.title)}" /></div>
          <div class="field"><label>Category</label><select id="f-edit-category">${catOpts}</select></div>
          <div class="field"><label>Short Description</label><input id="f-edit-dek" type="text" value="${esc(a.dek)}" /></div>
          <div class="field"><label>Cover Image URL</label><input id="f-edit-cover" type="text" value="${esc(a.coverImage || (Array.isArray(a.coverImageUrls) && a.coverImageUrls.length ? a.coverImageUrls[0] : ''))}" /></div>
          <div class="field" id="video-url-field" style="display:none"><label>Video URL</label><input id="f-edit-video-url" type="url" value="${esc(a.videoUrl||'')}" placeholder="https://youtube.com/embed/... or https://player.vimeo.com/video/..." /></div>
          <div class="field"><label>Article Text</label><div id="quill-container" class="quill-editor"></div></div>
          ${error?`<p class="error-text">${esc(error)}</p>`:''}
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="button" type="submit">Save Changes</button>
            <button class="button ghost" type="button" data-nav="manage">Cancel</button>
          </div>
        </form>
      </div>`;
  }

  // ── Subscribers ───────────────────────────────────────────
  function subscribers(list) {
    if (!list) return `<div class="loading">Loading&hellip;</div>`;
    if (!list.length) return `<div class="form-page" style="max-width:820px"><h1>Subscribers</h1><div class="empty-state">No subscribers yet.</div></div>`;
    const rows = list.map(s=>`<div class="list-item"><span style="font-size:1rem">${esc(s.email)}</span><span class="list-item-meta">${fmt(s.date)}</span></div>`).join('');
    return `<div class="form-page" style="max-width:820px"><h1>Subscribers <span style="font-family:'Jost',sans-serif;font-size:1.4rem;color:var(--muted);font-weight:300">(${list.length})</span></h1><p class="form-sub">Everyone who signed up.</p>${rows}</div>`;
  }

  function search(results, query) {
    if (!results) return `<div class="loading">Loading&hellip;</div>`;
    const heading = query ? `Results for &ldquo;${esc(query)}&rdquo;` : 'Search';
    const empty   = query ? `No articles found for &ldquo;${esc(query)}&rdquo;. Try a different search.` : 'Enter a search term above.';
    return `
      <section class="section">
        <div class="section-head"><h2>${heading}</h2><div class="line"></div></div>
        ${!results.length
          ? `<div class="empty-state">${empty}</div>`
          : `<div class="grid">${results.map(card).join('')}</div>`
        }
      </section>`;
  }

  function gate(title, reason) {
    return `<div class="form-page"><h1>${esc(title)}</h1><p class="form-sub">${esc(reason)}</p><button class="button" data-nav="auth">Sign In</button></div>`;
  }

  return { header, footer, home, category, article, search, auth, forgotPassword, resetPassword,
           submit, mine, resubmit, review, manage, editArticle, subscribers, gate };
})();

// ============================================================
// APP
// ============================================================
(function App() {

  const storedSession = (() => { try { const r = localStorage.getItem('grafide_session'); return r ? JSON.parse(r) : null; } catch { return null; } })();

  const state = {
    session: storedSession,
    articles: null, _hasMore: false, _articlePage: 0,
    view: { name: 'home' },
    authMode: 'signin',
    submitSuccess: false,
    expandedReviewId: null,
    _articleData: null,
    _categoryData: null, _categoryName: '', _categoryHasMore: false, _categoryPage: 0,
    _mineData: null,
    _reviewData: null,
    _manageData: null,
    _editData: null, _editError: '',
    _resubmitData: null, _resubmitError: '',
    _subscribersData: null,
    _forgotSuccess: false, _forgotError: '',
    _resetSuccess: false, _resetError: '',
    subscribeMsg: '', subscribeError: false,
    _authError: '', _submitError: '',
    _searchResults: null, _searchQuery: '',
    _quillInit: '',  // initial HTML for Quill on next paint
  };

  const $header = document.getElementById('site-header');
  const $main   = document.getElementById('main-content');
  const $footer = document.getElementById('site-footer');
  const $toast  = (() => { const el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); return el; })();

  function paint() {
    quillEditor = null;
    $header.innerHTML = Render.header(state.session, state.view.name + (state.view.cat?'-'+state.view.cat:''), state._searchQuery || '');
    $main.innerHTML   = viewHtml(state.view);
    $footer.innerHTML = Render.footer(state.subscribeMsg, state.subscribeError);
    bindEvents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function viewHtml(v) {
    const s = state.session, ed = s?.role === 'editor';
    switch (v.name) {
      case 'home':            return Render.home(state.articles, state._hasMore);
      case 'category':        return Render.category(state._categoryName, state._categoryData, state._categoryHasMore);
      case 'article':         return Render.article(state._articleData, ed);
      case 'auth':            return Render.auth(state.authMode, state._authError);
      case 'search':          return Render.search(state._searchResults, state._searchQuery);
      case 'forgot-password': return Render.forgotPassword(state._forgotSuccess, state._forgotError);
      case 'reset-password':  return Render.resetPassword(v.token || '', state._resetSuccess, state._resetError);
      case 'submit':          return s ? Render.submit(state.submitSuccess, state._submitError) : Render.gate('Submit','Sign in to submit.');
      case 'mine':            return s ? Render.mine(state._mineData) : Render.gate('My Submissions','Sign in to view.');
      case 'resubmit':        return s ? Render.resubmit(state._resubmitData, state._resubmitError) : Render.gate('Resubmit','Sign in to continue.');
      case 'review':          return ed ? Render.review(state._reviewData, state.expandedReviewId) : Render.gate('Review Queue','Editor access required.');
      case 'manage':          return ed ? Render.manage(state._manageData) : Render.gate('Manage','Editor access required.');
      case 'edit-article':    return ed ? Render.editArticle(state._editData, state._editError) : Render.gate('Edit','Editor access required.');
      case 'subscribers':     return ed ? Render.subscribers(state._subscribersData) : Render.gate('Subscribers','Editor access required.');
      default:                return Render.home(state.articles, state._hasMore);
    }
  }

  async function navigate(viewObj, { push = true } = {}) {
    state.view           = viewObj;
    state._authError     = ''; state._submitError  = '';
    if (viewObj.name !== 'search') state._searchQuery = '';
    state._editError     = ''; state._resubmitError = '';
    state._forgotError   = ''; state._resetError    = '';
    state.submitSuccess  = false; state.expandedReviewId = null;
    state._quillInit     = '';

    if (push) history.pushState({ view: viewObj }, '', viewToUrl(viewObj));
    paint();

    const tok = state.session?.token;

    if (viewObj.name === 'home' && !state.articles) { await loadArticles(); paint(); }

    if (viewObj.name === 'article' && viewObj.id) {
      state._articleData = null;
      try { state._articleData = await Articles.get(viewObj.id); } catch { state._articleData = null; }
      updateMeta(viewObj, state._articleData);
      paint();
    }
    if (viewObj.name === 'category' && viewObj.cat) {
      state._categoryName = viewObj.cat; state._categoryData = null; state._categoryPage = 0; state._categoryHasMore = false;
      try { const r = await Articles.listByCategory(viewObj.cat, 0); state._categoryData = r.articles||[]; state._categoryHasMore = r.hasMore||false; } catch { state._categoryData = []; }
      paint();
    }
    if (viewObj.name === 'search') {
      state._searchQuery   = viewObj.q || '';
      state._searchResults = null;
      paint();
      try   { state._searchResults = state._searchQuery ? await Articles.search(state._searchQuery) : []; }
      catch { state._searchResults = []; }
      paint();
    }

    if (viewObj.name === 'mine')         { state._mineData = null;        try { state._mineData        = await Submissions.mine(tok);     } catch { state._mineData = []; }         paint(); }
    if (viewObj.name === 'review')       { state._reviewData = null;      try { state._reviewData      = await Submissions.queue(tok);    } catch { state._reviewData = []; }       paint(); }
    if (viewObj.name === 'manage')       { state._manageData = null;      try { const r = await Articles.list(0); state._manageData = r.articles||[]; } catch { state._manageData = []; } paint(); }
    if (viewObj.name === 'subscribers')  { state._subscribersData = null; try { state._subscribersData = await Subscribers.list(tok);    } catch { state._subscribersData = []; }  paint(); }
    if (viewObj.name === 'resubmit' && viewObj.id) {
      state._resubmitData = null;
      try { state._resubmitData = await Submissions.get(viewObj.id, tok); } catch { state._resubmitData = null; }
      if (state._resubmitData) {
        state._quillInit = state._resubmitData.richBody || (Array.isArray(state._resubmitData.body) ? state._resubmitData.body.map(p=>`<p>${p}</p>`).join('') : '');
      }
      paint();
    }
    if (viewObj.name === 'edit-article' && viewObj.id) {
      state._editData = null;
      try { state._editData = await Articles.get(viewObj.id); } catch { state._editData = null; }
      if (state._editData) {
        state._quillInit = state._editData.richBody || (Array.isArray(state._editData.body) ? state._editData.body.map(p=>`<p>${p}</p>`).join('') : '');
      }
      paint();
    }
  }

  function showToast(msg) { $toast.textContent = msg; $toast.classList.add('show'); setTimeout(()=>$toast.classList.remove('show'), 3000); }

  // ── Handlers ─────────────────────────────────────────────
  function handleNavClick(e) {
    const el = e.target.closest('[data-nav],[data-view]');
    if (!el) return;
    e.preventDefault();
    const viewName = el.dataset.nav || el.dataset.view;
    const navObj = viewName === 'podcast'
      ? { name: 'category', cat: 'PODCAST' }
      : { name: viewName, id: el.dataset.id, cat: el.dataset.cat };
    navigate(navObj);
  }

  async function handleAuth(e) {
    e.preventDefault();
    const isSignIn = state.authMode === 'signin';
    const username = document.getElementById('f-username')?.value.trim();
    const password = document.getElementById('f-password')?.value;
    const display  = document.getElementById('f-display')?.value.trim();
    const email    = document.getElementById('f-email')?.value.trim() || '';
    const code     = document.getElementById('f-editor-code')?.value.trim() || '';
    if (!username || !password || (!isSignIn && !display)) { state._authError = 'Please fill in all required fields.'; paint(); return; }
    try {
      const result = isSignIn ? await Auth.login(username, password) : await Auth.register(username, password, display, email, code);
      state.session = result;
      localStorage.setItem('grafide_session', JSON.stringify(result));
      navigate({ name: 'home' });
    } catch (err) { state._authError = err.message; paint(); }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    const username = document.getElementById('f-forgot-username')?.value.trim();
    if (!username) { state._forgotError = 'Please enter your username.'; paint(); return; }
    try { await Auth.forgotPassword(username); state._forgotSuccess = true; paint(); }
    catch (err) { state._forgotError = err.message; paint(); }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    const token    = document.getElementById('f-reset-token')?.value;
    const password = document.getElementById('f-reset-password')?.value;
    const confirm  = document.getElementById('f-reset-confirm')?.value;
    if (!password || password.length < 6) { state._resetError = 'Password must be at least 6 characters.'; paint(); return; }
    if (password !== confirm)             { state._resetError = 'Passwords do not match.'; paint(); return; }
    try { await Auth.resetPassword(token, password); state._resetSuccess = true; paint(); }
    catch (err) { state._resetError = err.message; paint(); }
  }

  let selectedImages = [];

  function handleCoverPreview(e) {
    selectedImages = Array.from(e.target.files || []);
    renderImagePreviewStrip();
  }

  function renderImagePreviewStrip() {
    const strip = document.getElementById('image-preview-strip');
    if (!strip) return;
    strip.innerHTML = selectedImages.map((file, idx) => {
      const url = URL.createObjectURL(file);
      return `
        <div class="preview-thumb ${idx===0?'primary':''}" data-index="${idx}">
          <img src="${url}" alt="Selected image ${idx+1}" />
          <button type="button" class="preview-remove" data-index="${idx}" aria-label="Remove image ${idx+1}">×</button>
          ${idx===0?`<span class="preview-label">Primary</span>`:''}
        </div>`;
    }).join('');
  }

  function setupArticleDetailCover(imageUrls, title) {
    const container = document.getElementById('article-detail-cover-container');
    if (!container) return;
    const images = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean);
    if (!images.length) {
      container.innerHTML = '<div class="article-detail-cover-fallback">No cover image available.</div>';
      return;
    }
    const hasMultiple = images.length > 1;
    container.innerHTML = `
      <div class="detail-slideshow" data-index="0">
        <div class="slideshow-frame">
          <img class="detail-slideshow-image" src="${images[0]}" alt="${title}" />
          ${hasMultiple ? `<button type="button" class="slideshow-control prev" aria-label="Previous image">&#10094;</button>
            <button type="button" class="slideshow-control next" aria-label="Next image">&#10095;</button>` : ''}
        </div>
        ${hasMultiple ? `<div class="slideshow-thumbs">
          ${images.map((src, idx) => `<button type="button" class="slideshow-thumb${idx===0?' active':''}" data-index="${idx}" aria-label="Show image ${idx+1}"><img src="${src}" alt="${title} cover ${idx+1}" /></button>`).join('')}
        </div>` : ''}
      </div>`;
    if (!hasMultiple) return;
    const imageEl = container.querySelector('.detail-slideshow-image');
    const thumbButtons = Array.from(container.querySelectorAll('.slideshow-thumb'));
    const prevBtn = container.querySelector('.slideshow-control.prev');
    const nextBtn = container.querySelector('.slideshow-control.next');
    let current = 0;
    const setIndex = idx => {
      current = (idx + images.length) % images.length;
      imageEl.src = images[current];
      thumbButtons.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.index) === current));
    };
    prevBtn?.addEventListener('click', () => setIndex(current - 1));
    nextBtn?.addEventListener('click', () => setIndex(current + 1));
    thumbButtons.forEach(btn => btn.addEventListener('click', () => setIndex(Number(btn.dataset.index))));
  }

  function removeSelectedImage(index) {
    selectedImages = selectedImages.filter((_, idx) => idx !== index);
    renderImagePreviewStrip();
  }
  function toggleVideoUrlField(selectId, fieldId = 'video-url-field') {
    const select = document.getElementById(selectId);
    const field = document.getElementById(fieldId);
    if (!select || !field) return;
    field.style.display = select.value === 'PODCAST' ? 'block' : 'none';
  }
  async function handleSubmit(e) {
    e.preventDefault();
    const title    = document.getElementById('f-title')?.value.trim();
    const dek      = document.getElementById('f-dek')?.value.trim();
    const cat      = document.getElementById('f-category')?.value;
    const cover    = document.getElementById('f-cover')?.value.trim();
    const videoUrl = document.getElementById('f-video-url')?.value?.trim() || '';
    const richBody = getQuillHtml();
    if (!title || !dek || !richBody) { state._submitError = 'Title, description, and article text are required.'; paint(); return; }
    const formData = new FormData();
    formData.append('title', title);
    formData.append('dek', dek);
    formData.append('category', cat);
    formData.append('richBody', richBody);
    formData.append('videoUrl', videoUrl);
    if (cover) formData.append('coverImage', cover);
    selectedImages.forEach(file => formData.append('images', file));
    try {
      const res = await fetch(BASE + '/submissions', {
        method: 'POST',
        headers: state.session?.token ? { 'Authorization': `Bearer ${state.session.token}` } : undefined,
        body: formData
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Submission failed.');
      }
      state.submitSuccess = true;
      selectedImages = [];
      paint();
    } catch (err) {
      state._submitError = err.message;
      paint();
    }
  }

  async function handleResubmit(e) {
    e.preventDefault();
    const id       = document.getElementById('f-resub-id')?.value;
    const title    = document.getElementById('f-resub-title')?.value.trim();
    const dek      = document.getElementById('f-resub-dek')?.value.trim();
    const cat      = document.getElementById('f-resub-category')?.value;
    const cover    = document.getElementById('f-resub-cover')?.value.trim();
    const richBody = getQuillHtml();
    if (!title || !dek || !richBody) { state._resubmitError = 'Title, description, and article text are required.'; paint(); return; }
    try { await Submissions.resubmit(id, { title, dek, category: cat, richBody, coverImage: cover }, state.session.token); showToast('Resubmitted for review.'); navigate({ name: 'mine' }); }
    catch (err) { state._resubmitError = err.message; paint(); }
  }

  async function handleWithdraw(id) {
    if (!confirm('Withdraw this submission? It will be removed from the review queue.')) return;
    try { await Submissions.withdraw(id, state.session.token); showToast('Submission withdrawn.'); state._mineData = state._mineData.filter(s => s.id !== id); paint(); }
    catch (err) { showToast(err.message); }
  }

  async function handleLoadMore(type) {
    try {
      if (type === 'home') {
        const next = state._articlePage + 1;
        const r = await Articles.list(next);
        state.articles = [...(state.articles||[]), ...(r.articles||[])]; state._articlePage = next; state._hasMore = r.hasMore||false;
      } else {
        const next = state._categoryPage + 1;
        const r = await Articles.listByCategory(state._categoryName, next);
        state._categoryData = [...(state._categoryData||[]), ...(r.articles||[])]; state._categoryPage = next; state._categoryHasMore = r.hasMore||false;
      }
    } catch { showToast('Failed to load more.'); return; }
    $main.innerHTML = viewHtml(state.view); bindEvents();
  }

  async function handleReviewToggle(id) { state.expandedReviewId = state.expandedReviewId === id ? null : id; paint(); }
  async function handleApprove(id) {
    try { await Submissions.approve(id, state.session.token); state._reviewData = state._reviewData.filter(s=>s.id!==id); state.expandedReviewId = null; state.articles = null; showToast('Article published.'); paint(); }
    catch (err) { showToast(err.message); }
  }
  async function handleReturn(id) {
    const note = document.getElementById(`note-${id}`)?.value.trim() || '';
    try { await Submissions.return(id, note, state.session.token); state._reviewData = state._reviewData.filter(s=>s.id!==id); state.expandedReviewId = null; showToast('Returned to creator.'); paint(); }
    catch (err) { showToast(err.message); }
  }
  async function handlePinToggle(id, pinned) {
    try { pinned ? await Articles.unpin(id, state.session.token) : await Articles.pin(id, state.session.token); showToast(pinned?'Unpinned.':'Cover story pinned.'); const r = await Articles.list(0); state._manageData = r.articles||[]; state.articles = null; paint(); }
    catch (err) { showToast(err.message); }
  }
  async function handleUnpublish(id) {
    if (!confirm('Hide this article? You can restore it any time.')) return;
    try { await Articles.unpublish(id, state.session.token); showToast('Article hidden.'); const r = await Articles.list(0); state._manageData = r.articles||[]; state.articles = null; paint(); }
    catch (err) { showToast(err.message); }
  }
  async function handleRepublish(id) {
    try { await Articles.republish(id, state.session.token); showToast('Article restored.'); const r = await Articles.list(0); state._manageData = r.articles||[]; state.articles = null; paint(); }
    catch (err) { showToast(err.message); }
  }
  async function handleDeleteArticle(id) {
    if (!confirm('Permanently delete this article? This cannot be undone.')) return;
    try {
      await Articles.delete(id, state.session.token); showToast('Article deleted.'); state.articles = null;
      if (state.view.name === 'article') { navigate({ name: 'home' }); }
      else { const r = await Articles.list(0); state._manageData = r.articles||[]; paint(); }
    } catch (err) { showToast(err.message); }
  }
  async function handleEditArticle(e) {
    e.preventDefault();
    const id       = document.getElementById('f-edit-id')?.value;
    const title    = document.getElementById('f-edit-title')?.value.trim();
    const dek      = document.getElementById('f-edit-dek')?.value.trim();
    const cat      = document.getElementById('f-edit-category')?.value;
    const cover    = document.getElementById('f-edit-cover')?.value.trim();
    const videoUrl = document.getElementById('f-edit-video-url')?.value?.trim() || '';
    const richBody = getQuillHtml();
    if (!title || !dek || !richBody) { state._editError = 'All fields required.'; paint(); return; }
    try { await Articles.update(id, { title, dek, category: cat, coverImage: cover, videoUrl, richBody }, state.session.token); showToast('Article updated.'); state.articles = null; navigate({ name: 'manage' }); }
    catch (err) { state._editError = err.message; paint(); }
  }
  async function handleSubscribe() {
    const email = document.getElementById('subscribe-email')?.value.trim();
    if (!email || !email.includes('@')) { state.subscribeMsg = 'Please enter a valid email address.'; state.subscribeError = true; $footer.innerHTML = Render.footer(state.subscribeMsg, state.subscribeError); bindEvents(); return; }
    try { const r = await Subscribers.subscribe(email); state.subscribeMsg = r.message||'Subscribed.'; state.subscribeError = false; }
    catch (err) { state.subscribeMsg = err.message||'Something went wrong.'; state.subscribeError = true; }
    $footer.innerHTML = Render.footer(state.subscribeMsg, state.subscribeError); bindEvents();
  }

  // ── Bind Events ──────────────────────────────────────────
  function bindEvents() {
    $header.addEventListener('click', handleNavClick);

    const navToggleBtn = document.getElementById('nav-toggle');
    const mainNavEl = document.getElementById('main-nav');

    navToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navToggleBtn.classList.toggle('open');
      mainNavEl.classList.toggle('open');
    });

    // Close menu when clicking anywhere outside the nav or toggle button
    document.addEventListener('click', (e) => {
      const isClickInsideNav = mainNavEl.contains(e.target);
      const isClickOnToggle = navToggleBtn.contains(e.target);
      if (!isClickInsideNav && !isClickOnToggle && mainNavEl.classList.contains('open')) {
        mainNavEl.classList.remove('open');
        navToggleBtn.classList.remove('open');
      }
    });

    // Close menu after a nav link is clicked
    document.querySelectorAll('#main-nav [data-nav], #main-nav [data-view]').forEach(link => {
      link.addEventListener('click', () => {
        mainNavEl.classList.remove('open');
        navToggleBtn.classList.remove('open');
      });
    });

    document.getElementById('header-search-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('header-search-input')?.value.trim();
      if (q) navigate({ name: 'search', q });
    });
    document.getElementById('f-category')?.addEventListener('change', () => toggleVideoUrlField('f-category'));
    document.getElementById('f-edit-category')?.addEventListener('change', () => toggleVideoUrlField('f-edit-category', 'video-url-field'));
    toggleVideoUrlField('f-category');
    toggleVideoUrlField('f-edit-category', 'video-url-field');

    document.getElementById('signout-btn')?.addEventListener('click', () => {
      localStorage.removeItem('grafide_session'); state.session = null; state.articles = null; navigate({ name: 'home' });
    });

    // Init Quill if present (submit, resubmit, edit forms)
    if (document.getElementById('quill-container')) {
      initQuill('quill-container', state._quillInit);
    }

    $main.addEventListener('click', e => {
      handleNavClick(e);
      const t = (cls) => e.target.closest(cls);
      if (t('[data-auth-tab]')) { state.authMode = t('[data-auth-tab]').dataset.authTab; state._authError = ''; paint(); return; }
      if (t('.toggle-review-btn'))    { handleReviewToggle(t('.toggle-review-btn').dataset.id); return; }
      if (t('.approve-btn'))          { handleApprove(t('.approve-btn').dataset.id); return; }
      if (t('.return-btn'))           { handleReturn(t('.return-btn').dataset.id); return; }
      if (t('.pin-btn'))              { handlePinToggle(t('.pin-btn').dataset.id, t('.pin-btn').dataset.pinned==='1'); return; }
      if (t('.unpublish-btn'))        { handleUnpublish(t('.unpublish-btn').dataset.id); return; }
      if (t('.republish-btn'))        { handleRepublish(t('.republish-btn').dataset.id); return; }
      if (t('.edit-article-btn'))     { navigate({ name:'edit-article', id: t('.edit-article-btn').dataset.id }); return; }
      if (t('.delete-article-btn'))   { handleDeleteArticle(t('.delete-article-btn').dataset.id); return; }
      if (t('.resubmit-btn'))         { navigate({ name:'resubmit', id: t('.resubmit-btn').dataset.id }); return; }
      if (t('.withdraw-btn'))         { handleWithdraw(t('.withdraw-btn').dataset.id); return; }
      if (t('.load-more-btn'))        { handleLoadMore(t('.load-more-btn').dataset.type); return; }
    });

    document.getElementById('auth-form')?.addEventListener('submit', handleAuth);
    document.getElementById('forgot-form')?.addEventListener('submit', handleForgotPassword);
    document.getElementById('reset-form')?.addEventListener('submit', handleResetPassword);
    document.getElementById('f-cover-file')?.addEventListener('change', handleCoverPreview);
    document.getElementById('image-preview-strip')?.addEventListener('click', e => {
      const btn = e.target.closest('.preview-remove');
      if (!btn) return;
      const index = Number(btn.dataset.index);
      if (!Number.isNaN(index)) removeSelectedImage(index);
    });
    document.getElementById('submit-form')?.addEventListener('submit', handleSubmit);
    document.getElementById('resubmit-form')?.addEventListener('submit', handleResubmit);
    document.getElementById('edit-article-form')?.addEventListener('submit', handleEditArticle);
    document.getElementById('subscribe-btn')?.addEventListener('click', handleSubscribe);
    document.getElementById('subscribe-email')?.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); handleSubscribe(); } });
  }

  // ── Boot ─────────────────────────────────────────────────
  async function loadArticles() {
    try { const r = await Articles.list(0); state.articles = r.articles||[]; state._hasMore = r.hasMore||false; state._articlePage = 0; }
    catch { state.articles = []; state._hasMore = false; }
  }

  async function init() {
    window.addEventListener('popstate', e => { navigate(e.state?.view || urlToView(), { push: false }); });
    await loadArticles();
    const initialView = urlToView();
    history.replaceState({ view: initialView }, '', viewToUrl(initialView));
    await navigate(initialView, { push: false });
  }

  init();
})();