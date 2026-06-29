/* ============================================================
   GRAFIDE — portfolio-manage.js  (Hidden portfolio manager)
   URL: /pages/portfolio-manage.html  (not in nav)
   ============================================================ */
'use strict';

let _session   = null;
let _editingId = null;
let _coverUrl  = '';
let _extraUrls = [];

const PortfolioApi = {
  list:   ()         => Api.get('/portfolio'),
  create: (d, tok)   => Api.post('/portfolio', d, tok),
  update: (id, d, tok) => Api.put(`/portfolio/${id}`, d, tok),
  delete: (id, tok)  => Api.delete(`/portfolio/${id}`, tok),
};

// ── Guard ────────────────────────────────────────────────────────
function guard() {
  _session = getSession();
  if (!_session || !isEditor(_session)) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function val(id)  { return (document.getElementById(id)?.value || '').trim(); }

// ── Load list ────────────────────────────────────────────────────
async function loadList() {
  show('pf-list-loading'); hide('pf-list-empty'); hide('pf-list');
  try {
    const items = await PortfolioApi.list();
    hide('pf-list-loading');

    if (!items.length) { show('pf-list-empty'); return; }

    const list = document.getElementById('pf-list');
    list.innerHTML = items.map(item => `
      <div class="portfolio-manage-row" id="pmrow-${esc(item.id)}">
        <div class="portfolio-manage-thumb">
          ${item.coverUrl
            ? `<img src="${esc(item.coverUrl)}" alt="${esc(item.title)}" />`
            : '<div class="portfolio-manage-thumb-empty"></div>'}
        </div>
        <div class="portfolio-manage-info">
          <p class="portfolio-manage-title">${esc(item.title)}</p>
          <p class="portfolio-manage-meta">
            ${esc(item.category)}
            ${item.client ? ` &nbsp;·&nbsp; ${esc(item.client)}` : ''}
            &nbsp;·&nbsp; Order: ${item.sortOrder}
            ${item.featured ? ' &nbsp;·&nbsp; <span style="color:var(--cobalt);font-weight:500;">Featured</span>' : ''}
          </p>
          ${item.description ? `<p class="portfolio-manage-desc">${esc(item.description)}</p>` : ''}
        </div>
        <div class="portfolio-manage-actions">
          <button class="btn sm ghost" data-edit="${esc(item.id)}">Edit</button>
          <button class="btn danger sm" data-del="${esc(item.id)}">Delete</button>
        </div>
      </div>`).join('');

    // Edit handlers
    list.querySelectorAll('[data-edit]').forEach(btn => {
      const id   = btn.dataset.edit;
      const item = items.find(i => i.id === id);
      if (item) btn.addEventListener('click', () => openForm(item));
    });

    // Delete handlers
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this portfolio item?')) return;
        try {
          await PortfolioApi.delete(btn.dataset.del, _session.token);
          document.getElementById(`pmrow-${btn.dataset.del}`)?.remove();
          showToast('Item deleted.');
          if (!list.querySelectorAll('.portfolio-manage-row').length) {
            hide('pf-list'); show('pf-list-empty');
          }
        } catch (err) { showToast(err.message || 'Delete failed.'); }
      });
    });

    list.style.display = '';
  } catch (err) {
    hide('pf-list-loading');
    show('pf-list-empty');
    showToast('Failed to load items: ' + (err.message || ''));
  }
}

// ── Open form ────────────────────────────────────────────────────
function openForm(item = null) {
  _editingId = item?.id || null;
  _coverUrl  = item?.coverUrl || '';
  _extraUrls = item ? [...(item.imageUrls || [])] : [];

  document.getElementById('pf-form-title').textContent = item ? 'Edit Work' : 'Add Work';
  document.getElementById('pf-ttl').value     = item?.title       || '';
  document.getElementById('pf-client').value  = item?.client      || '';
  document.getElementById('pf-cat').value     = item?.category    || '';
  document.getElementById('pf-sort').value    = item?.sortOrder   ?? 0;
  document.getElementById('pf-desc').value    = item?.description || '';
  document.getElementById('pf-featured').checked = item?.featured || false;
  document.getElementById('pf-cover-url').value  = _coverUrl;

  renderCoverPreview();
  renderExtraPreviews();

  hide('pf-err');
  show('portfolio-form');
  document.getElementById('portfolio-form').scrollIntoView({ behavior: 'smooth' });
}

// ── Preview renderers ────────────────────────────────────────────
function renderCoverPreview() {
  const el = document.getElementById('pf-cover-preview');
  if (!el) return;
  el.innerHTML = _coverUrl
    ? `<img src="${esc(_coverUrl)}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--line);" />`
    : '';
}

function renderExtraPreviews() {
  const el = document.getElementById('pf-imgs-preview');
  if (!el) return;
  el.innerHTML = _extraUrls.map((url, i) => `
    <div class="cover-preview">
      <img src="${esc(url)}" alt="Preview ${i+1}" />
      <button class="cover-preview-remove" data-rm="${i}">&times;</button>
    </div>`).join('');
  el.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => {
      _extraUrls.splice(Number(btn.dataset.rm), 1);
      renderExtraPreviews();
    });
  });
}

// ── Cover image upload ───────────────────────────────────────────
function initCoverUpload() {
  document.getElementById('pf-cover-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      showToast('Uploading cover…', 'default', 8000);
      const data = await uploadImage(file);
      _coverUrl = data.url;
      document.getElementById('pf-cover-url').value = _coverUrl;
      renderCoverPreview();
      showToast('Cover uploaded.', 'success');
    } catch (err) {
      showToast(err.message || 'Cover upload failed.', 'error');
    }
  });
}

// ── Extra images upload ──────────────────────────────────────────
function initExtraUpload() {
  document.getElementById('pf-imgs-file')?.addEventListener('change', async (e) => {
    for (const file of Array.from(e.target.files)) {
      try {
        showToast('Uploading image…', 'default', 8000);
        const data = await uploadImage(file);
        _extraUrls.push(data.url);
        renderExtraPreviews();
        showToast('Image uploaded.', 'success');
      } catch (err) {
        showToast(err.message || 'Image upload failed.', 'error');
      }
    }
  });
}

// ── Save ─────────────────────────────────────────────────────────
async function saveForm() {
  const errEl = document.getElementById('pf-err');
  hide('pf-err');

  const title    = val('pf-ttl');
  const category = val('pf-cat');
  const client   = val('pf-client');
  const desc     = val('pf-desc');
  const sortOrder = parseInt(document.getElementById('pf-sort').value) || 0;
  const featured  = document.getElementById('pf-featured').checked;
  const coverUrl  = _coverUrl;

  if (!title || !category) {
    errEl.textContent   = 'Title and category are required.';
    show('pf-err'); return;
  }

  const payload = {
    title, category, client, description: desc,
    coverUrl, imageUrls: _extraUrls,
    sortOrder, featured,
  };

  const btn = document.getElementById('pf-save');
  btn.textContent = 'Saving…'; btn.disabled = true;

  try {
    if (_editingId) {
      await PortfolioApi.update(_editingId, payload, _session.token);
    } else {
      await PortfolioApi.create(payload, _session.token);
    }
    showToast(_editingId ? 'Updated!' : 'Added!', 'success');
    hide('portfolio-form');
    _editingId = null;
    await loadList();
  } catch (err) {
    errEl.textContent   = err.message || 'Save failed.';
    show('pf-err');
  }
  btn.textContent = 'Save'; btn.disabled = false;
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  if (!guard()) return;
  initLayout();

  document.getElementById('pf-add-btn')?.addEventListener('click',    () => openForm());
  document.getElementById('pf-cancel')?.addEventListener('click',     () => hide('portfolio-form'));
  document.getElementById('pf-save')?.addEventListener('click',       saveForm);

  initCoverUpload();
  initExtraUpload();

  loadList();
}

init();
