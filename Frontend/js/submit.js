/* ============================================================
   GRAFIDE — submit.js  (Submit page)
   Views: submit | mine | resubmit
   ============================================================ */
'use strict';

// ── Guard: must be signed in ─────────────────────────────────────
function guardAuth() {
  if (!getSession()) { window.location.href = '/pages/auth.html'; return false; }
  return true;
}

// ── View switcher ────────────────────────────────────────────────
function showView(name) {
  ['submit', 'mine', 'resubmit'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.style.display = v === name ? '' : 'none';
  });
}

// ── Quill factory ────────────────────────────────────────────────
function makeQuill(containerId) {
  return new Quill(`#${containerId}`, {
    theme: 'snow',
    placeholder: 'Write your article here…',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        ['blockquote', 'image', 'link'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean'],
      ],
    },
  });
}

// ── Inline image upload handler for Quill — uses shared uploadImage() ──
function attachImageHandler(quill) {
  quill.getModule('toolbar').addHandler('image', () => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.click();
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data  = await uploadImage(file); // shared.js
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', data.url);
      } catch (err) { showToast(err.message || 'Image upload failed.'); }
    };
  });
}

// ── Cover image preview ──────────────────────────────────────────
let _coverFiles = [];

function setupCoverPreviews() {
  const input    = document.getElementById('f-covers');
  const previews = document.getElementById('cover-previews');
  if (!input || !previews) return;

  input.addEventListener('change', () => {
    const files = Array.from(input.files).slice(0, 5);
    _coverFiles = files;
    previews.innerHTML = '';
    files.forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        previews.insertAdjacentHTML('beforeend', `
          <div class="cover-preview" id="preview-${i}">
            <img src="${e.target.result}" alt="Cover ${i + 1}" />
            <button class="cover-preview-remove" data-index="${i}" aria-label="Remove">&times;</button>
          </div>`);
        previews.querySelector(`[data-index="${i}"]`)?.addEventListener('click', () => {
          _coverFiles.splice(i, 1);
          document.getElementById(`preview-${i}`)?.remove();
        });
      };
      reader.readAsDataURL(f);
    });
  });
}

// ── Upload cover images — uses shared uploadImage() from shared.js ──
async function uploadCovers(files) {
  const urls = [];
  for (const file of files) {
    const data = await uploadImage(file); // shared.js
    urls.push(data.url);
  }
  return urls;
}

// ── Submit view ──────────────────────────────────────────────────
function initSubmit() {
  const quill = makeQuill('submit-quill');
  attachImageHandler(quill);
  setupCoverPreviews();

  document.getElementById('submit-btn')?.addEventListener('click', async () => {
    const errorEl   = document.getElementById('submit-error');
    const successEl = document.getElementById('submit-success');
    errorEl.style.display   = 'none';
    successEl.style.display = 'none';

    const session  = getSession();
    const title    = document.getElementById('f-title').value.trim();
    const dek      = document.getElementById('f-dek').value.trim();
    const category = document.getElementById('f-category').value;
    const body     = quill.root.innerHTML.trim();

    if (!title || !category || !body || body === '<p><br></p>') {
      errorEl.textContent   = 'Title, category, and article body are required.';
      errorEl.style.display = '';
      return;
    }

    const btn = document.getElementById('submit-btn');
    btn.textContent = 'Submitting…'; btn.disabled = true;

    try {
      const coverUrls = _coverFiles.length ? await uploadCovers(_coverFiles) : [];
      const r = await Submissions.create({
        title, dek, category,
        coverImageUrls: coverUrls,
        richBody: body,
      }, session.token);

      successEl.textContent   = r.message || 'Article submitted! Our editors will review it shortly.';
      successEl.style.display = '';
      btn.textContent = 'Submit Article'; btn.disabled = false;
      // Clear form
      document.getElementById('f-title').value    = '';
      document.getElementById('f-dek').value      = '';
      document.getElementById('f-category').value = '';
      quill.setContents([]);
      _coverFiles = [];
      document.getElementById('cover-previews').innerHTML = '';
    } catch (err) {
      errorEl.textContent   = err.message || 'Submission failed. Please try again.';
      errorEl.style.display = '';
      btn.textContent = 'Submit Article'; btn.disabled = false;
    }
  });
}

// ── My submissions view ──────────────────────────────────────────
async function initMine() {
  showView('mine');
  document.title = 'My Submissions — Grafide';
  const session = getSession();

  try {
    const subs = await Submissions.mine(session.token);
    document.getElementById('mine-loading').style.display = 'none';

    if (!subs.length) {
      document.getElementById('mine-empty').style.display = '';
      return;
    }

    const list = document.getElementById('mine-list');
    list.style.display = '';
    list.innerHTML = subs.map(s => `
      <div class="submission-row">
        <div>
          <p class="submission-title">${esc(s.title)}</p>
          <p class="submission-meta">${esc(s.category)} &nbsp;·&nbsp; Submitted ${fmt(s.submittedAt)}</p>
          ${s.editorNote ? `<p class="submission-note">${esc(s.editorNote)}</p>` : ''}
        </div>
        <span class="status-badge status-${esc(s.status)}">${esc(s.status)}</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${s.status === 'returned'
            ? `<a href="/pages/submit.html?view=resubmit&id=${esc(s.id)}" class="btn sm">Revise</a>`
            : ''}
          ${s.status === 'pending'
            ? `<button class="btn danger sm" data-withdraw="${esc(s.id)}">Withdraw</button>`
            : ''}
        </div>
      </div>`).join('');

    // Withdraw handlers
    list.querySelectorAll('[data-withdraw]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Withdraw this submission?')) return;
        try {
          await Submissions.withdraw(btn.dataset.withdraw, session.token);
          showToast('Submission withdrawn.');
          initMine();
        } catch (err) { showToast(err.message || 'Withdraw failed.'); }
      });
    });
  } catch {
    document.getElementById('mine-loading').style.display = 'none';
    document.getElementById('mine-empty').style.display   = '';
  }
}

// ── Resubmit view ────────────────────────────────────────────────
async function initResubmit(id) {
  showView('resubmit');
  document.title = 'Revise & Resubmit — Grafide';
  const session = getSession();
  const quill   = makeQuill('resub-quill');
  attachImageHandler(quill);

  // Pre-fill with existing submission data
  try {
    const sub = await Submissions.get(id, session.token);
    document.getElementById('f-resub-title').value    = sub.title    || '';
    document.getElementById('f-resub-dek').value      = sub.dek      || '';
    document.getElementById('f-resub-category').value = sub.category || '';
    if (sub.richBody) quill.root.innerHTML = sub.richBody;
  } catch { /* proceed with empty fields */ }

  document.getElementById('resub-btn')?.addEventListener('click', async () => {
    const errorEl = document.getElementById('resub-error');
    errorEl.style.display = 'none';

    const title    = document.getElementById('f-resub-title').value.trim();
    const dek      = document.getElementById('f-resub-dek').value.trim();
    const category = document.getElementById('f-resub-category').value;
    const body     = quill.root.innerHTML.trim();

    if (!title || !category) {
      errorEl.textContent = 'Title and category are required.';
      errorEl.style.display = '';
      return;
    }

    const btn = document.getElementById('resub-btn');
    btn.textContent = 'Resubmitting…'; btn.disabled = true;

    try {
      await Submissions.resubmit(id, { title, dek, category, richBody: body }, session.token);
      showToast('Resubmitted successfully!');
      setTimeout(() => { window.location.href = '/pages/submit.html?view=mine'; }, 1200);
    } catch (err) {
      errorEl.textContent   = err.message || 'Resubmit failed.';
      errorEl.style.display = '';
      btn.textContent = 'Resubmit'; btn.disabled = false;
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  if (!guardAuth()) return;
  initLayout('submit');

  const params = new URLSearchParams(window.location.search);
  const view   = params.get('view');
  const id     = params.get('id');

  if (view === 'mine')               { initMine(); }
  else if (view === 'resubmit' && id){ initResubmit(id); }
  else                               { showView('submit'); initSubmit(); }
}

init();
