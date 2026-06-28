/* ============================================================
   GRAFIDE — auth.js  (Auth page)
   Views: signin | register | forgot | reset
   ============================================================ */
'use strict';

// ── View switcher ────────────────────────────────────────────────
function showView(name) {
  ['signin', 'register', 'forgot', 'reset'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.style.display = v === name ? '' : 'none';
  });
  const titles = {
    signin:   'Sign In — Grafide',
    register: 'Register — Grafide',
    forgot:   'Forgot Password — Grafide',
    reset:    'Reset Password — Grafide',
  };
  document.title = titles[name] || 'Grafide';
}

// ── Error / success helpers ──────────────────────────────────────
function setMsg(id, msg, show = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = show ? '' : 'none';
}
function clearMsgs(...ids) { ids.forEach(id => setMsg(id, '', false)); }

// ── Sign in ──────────────────────────────────────────────────────
function initSignIn() {
  const btn = document.getElementById('signin-btn');
  async function submit() {
    clearMsgs('signin-error');
    const username = document.getElementById('signin-username').value.trim();
    const password = document.getElementById('signin-password').value;
    if (!username || !password) {
      setMsg('signin-error', 'Please enter your username and password.'); return;
    }
    btn.textContent = 'Signing in…'; btn.disabled = true;
    try {
      const r = await Auth.login(username, password);
      saveSession({ token: r.token, username: r.username, displayName: r.displayName, role: r.role });
      window.location.href = '/index.html';
    } catch (err) {
      setMsg('signin-error', err.message || 'Sign in failed. Check your credentials.');
      btn.textContent = 'Sign In'; btn.disabled = false;
    }
  }
  btn?.addEventListener('click', submit);
  document.getElementById('signin-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ── Register ─────────────────────────────────────────────────────
function initRegister() {
  document.getElementById('register-btn')?.addEventListener('click', async () => {
    clearMsgs('register-error', 'register-success');
    const displayName = document.getElementById('reg-displayname').value.trim();
    const email       = document.getElementById('reg-email').value.trim();
    const username    = document.getElementById('reg-username').value.trim();
    const password    = document.getElementById('reg-password').value;
    const editorCode  = document.getElementById('reg-editorcode').value.trim();

    if (!displayName || !email || !username || !password) {
      setMsg('register-error', 'Please fill in all required fields.'); return;
    }
    if (password.length < 6) {
      setMsg('register-error', 'Password must be at least 6 characters.'); return;
    }

    const btn = document.getElementById('register-btn');
    btn.textContent = 'Creating account…'; btn.disabled = true;
    try {
      await Auth.register(username, password, displayName, email, editorCode || "");
      setMsg('register-success', 'Account created! You can now sign in.');
      setTimeout(() => { window.location.href = '/pages/auth.html'; }, 1800);
    } catch (err) {
      setMsg('register-error', err.message || 'Registration failed. Please try again.');
      btn.textContent = 'Create Account'; btn.disabled = false;
    }
  });
}

// ── Forgot password ──────────────────────────────────────────────
function initForgot() {
  document.getElementById('forgot-btn')?.addEventListener('click', async () => {
    clearMsgs('forgot-error', 'forgot-success');
    const username = document.getElementById('forgot-username').value.trim();
    if (!username) { setMsg('forgot-error', 'Please enter your username.'); return; }

    const btn = document.getElementById('forgot-btn');
    btn.textContent = 'Sending…'; btn.disabled = true;
    try {
      const r = await Auth.forgotPassword(username);
      setMsg('forgot-success', r.message || 'Reset link sent — check your email.');
    } catch (err) {
      setMsg('forgot-error', err.message || 'Something went wrong. Please try again.');
    }
    btn.textContent = 'Send Reset Link'; btn.disabled = false;
  });
}

// ── Reset password ───────────────────────────────────────────────
function initReset(token) {
  document.getElementById('reset-btn')?.addEventListener('click', async () => {
    clearMsgs('reset-error', 'reset-success');
    const password = document.getElementById('reset-password').value;
    if (!password || password.length < 6) {
      setMsg('reset-error', 'Password must be at least 6 characters.'); return;
    }
    const btn = document.getElementById('reset-btn');
    btn.textContent = 'Updating…'; btn.disabled = true;
    try {
      await Auth.resetPassword(token, password);
      setMsg('reset-success', 'Password updated! Redirecting to sign in…');
      setTimeout(() => { window.location.href = '/pages/auth.html'; }, 1800);
    } catch (err) {
      setMsg('reset-error', err.message || 'Reset failed. The link may have expired.');
      btn.textContent = 'Set New Password'; btn.disabled = false;
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  // Redirect if already signed in
  if (getSession()) { window.location.href = '/index.html'; return; }

  initLayout('auth');

  const params    = new URLSearchParams(window.location.search);
  const view      = params.get('view') || 'signin';
  const resetToken = params.get('token');

  if (resetToken) {
    showView('reset');
    initReset(resetToken);
  } else {
    showView(view);
    initSignIn();
    initRegister();
    initForgot();
  }
}

init();
