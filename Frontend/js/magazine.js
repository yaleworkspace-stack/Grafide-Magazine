/* ============================================================
   GRAFIDE — magazine.js  (Magazines page)
   Views: listing | detail | upload (editor only)
   ============================================================ */
'use strict';

// ── View switcher ────────────────────────────────────────────────
function showView(name) {
  ['listing', 'detail', 'upload'].forEach(v => {
    document.getElementById(`view-${v}`).style.display = v === name ? '' : 'none';
  });
}

// ── Magazine card HTML ───────────────────────────────────────────
function magCardHtml(m) {
  const cover = (m.coverImageUrls && m.coverImageUrls[0]) || '/images/logo.png';
  return `
    <a class="magazine-card" href="/pages/magazine.html?id=${esc(m.id)}">
      <div class="magazine-cover-wrap">
        <img src="${esc(cover)}" alt="${esc(m.title)}" loading="lazy" />
      </div>
      <p class="magazine-card-title">${esc(m.title)}</p>
      <p class="magazine-card-dek">${esc(m.dek)}</p>
    </a>`;
}

// ── Listing view ─────────────────────────────────────────────────
async function loadListing() {
  showView('listing');
  document.title = 'Magazines — Grafide';

  const session = getSession();
  if (isEditor(session)) {
    const wrap = document.getElementById('editor-upload-btn');
    if (wrap) wrap.innerHTML = `<a href="/pages/magazine.html?view=upload" class="btn sm">+ Upload Issue</a>`;
  }

  try {
    const issues = await Magazines.list();
    document.getElementById('mag-loading').style.display = 'none';

    if (!issues.length) {
      document.getElementById('mag-empty').style.display = '';
      return;
    }
    const grid = document.getElementById('mag-grid');
    grid.innerHTML = issues.map(magCardHtml).join('');
    grid.style.display = '';
  } catch {
    document.getElementById('mag-loading').style.display = 'none';
    document.getElementById('mag-empty').style.display   = '';
  }
}

// ── Detail view ──────────────────────────────────────────────────
async function loadDetail(id) {
  showView('detail');

  try {
    const m = await Magazines.get(id);
    document.title = `${m.title} — Grafide`;

    const cover = (m.coverImageUrls && m.coverImageUrls[0]) || '/images/logo.png';
    document.getElementById('detail-cover-img').src     = cover;
    document.getElementById('detail-cover-img').alt     = m.title;
    document.getElementById('detail-title').textContent = m.title;
    document.getElementById('detail-dek').textContent   = m.dek || '';
    document.getElementById('detail-body').innerHTML    = m.richBody || '';

    // Editor delete
    const session = getSession();
    if (isEditor(session)) {
      document.getElementById('detail-editor-controls').style.display = 'flex';
      document.getElementById('detail-delete-btn')?.addEventListener('click', async () => {
        if (!confirm('Delete this issue permanently?')) return;
        try {
          await Magazines.delete(m.id, session.token);
          showToast('Issue deleted.');
          setTimeout(() => { window.location.href = '/pages/magazine.html'; }, 1200);
        } catch (err) {
          showToast(err.message || 'Delete failed.');
        }
      });
    }
  } catch {
    showView('listing');
    showToast('Issue not found.');
  }
}

// ── Upload view (editor only) ─────────────────────────────────────
function loadUpload() {
  const session = getSession();
  if (!isEditor(session)) { window.location.href = '/pages/magazine.html'; return; }

  showView('upload');
  document.title = 'Upload Issue — Grafide';

  // Init Quill
  const quill = new Quill('#quill-container', {
    theme: 'snow',
    placeholder: 'Write about this issue…',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        ['blockquote', 'image'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean'],
      ],
    },
  });

  // Quill inline image handler
  quill.getModule('toolbar').addHandler('image', () => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.click();
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res  = await fetch('/api/upload/image', { method: 'POST', body: fd });
        const data = await res.json();
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', data.url);
      } catch {
        showToast('Image upload failed.');
      }
    };
  });

  // Submit
  document.getElementById('upload-submit-btn')?.addEventListener('click', async () => {
    const errorEl = document.getElementById('upload-error');
    errorEl.style.display = 'none';

    const title  = document.getElementById('f-mag-title').value.trim();
    const dek    = document.getElementById('f-mag-dek').value.trim();
    const cover  = document.getElementById('f-mag-cover').files[0];
    const body   = quill.root.innerHTML.trim();

    if (!title || !cover) {
      errorEl.textContent    = 'Title and cover image are required.';
      errorEl.style.display  = '';
      return;
    }

    const btn = document.getElementById('upload-submit-btn');
    btn.textContent  = 'Publishing…';
    btn.disabled     = true;

    try {
      // Upload cover image via shared helper, then create magazine entry
      const uploadData = await uploadImage(cover); // shared.js
      await Api.post('/magazines', {
        title,
        dek,
        coverImageUrls: [uploadData.url],
        richBody: body,
      }, session.token);

      showToast('Issue published!');
      setTimeout(() => { window.location.href = '/pages/magazine.html'; }, 1200);
    } catch (err) {
      errorEl.textContent   = err.message || 'Publish failed. Please try again.';
      errorEl.style.display = '';
      btn.textContent = 'Publish Issue';
      btn.disabled    = false;
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  initLayout('magazine');
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const view   = params.get('view');

  if (view === 'upload') { loadUpload(); }
  else if (id)           { loadDetail(id); }
  else                   { loadListing(); }
}

init();
