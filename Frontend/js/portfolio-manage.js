/* ============================================================
   GRAFIDE — portfolio-manage.js  (Hidden portfolio manager)
   URL: /pages/portfolio-manage.html  (not in nav)
   Supports image URL paste OR file upload for all images.
   ============================================================ */
'use strict';

let _session   = null;
let _editingId = null;
let _coverUrl  = '';
let _extraUrls = [];

const PortfolioApi = {
  list:   ()              => Api.get('/portfolio'),
  create: (d, tok)        => Api.post('/portfolio', d, tok),
  update: (id, d, tok)    => Api.put(`/portfolio/${id}`, d, tok),
  delete: (id, tok)       => Api.delete(`/portfolio/${id}`, tok),
};

function guard() {
  _session = getSession();
  if (!_session || !isEditor(_session)) { window.location.href = '/index.html'; return false; }
  return true;
}

function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function val(id)  { return (document.getElementById(id)?.value || '').trim(); }
function isValidUrl(s) { try { new URL(s); return true; } catch { return false; } }

// ── Load list ────────────────────────────────────────────────────
async function loadList() {
  show('pf-list-loading'); hide('pf-list-empty');
  const list = document.getElementById('pf-list');
  if (list) { list.style.display = 'none'; list.innerHTML = ''; }

  try {
    const items = await PortfolioApi.list();
    hide('pf-list-loading');
    if (!items.length) { show('pf-list-empty'); return; }

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

    list.querySelectorAll('[data-edit]').forEach(btn => {
      const item = items.find(i => i.id === btn.dataset.edit);
      if (item) btn.addEventListener('click', () => openForm(item));
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this item?')) return;
        try {
          await PortfolioApi.delete(btn.dataset.del, _session.token);
          document.getElementById(`pmrow-${btn.dataset.del}`)?.remove();
          showToast('Deleted.', 'success');
          if (!list.querySelectorAll('.portfolio-manage-row').length) {
            hide('pf-list'); show('pf-list-empty');
          }
        } catch (err) { showToast(err.message || 'Delete failed.', 'error'); }
      });
    });

    list.style.display = '';
  } catch (err) {
    hide('pf-list-loading'); show('pf-list-empty');
    showToast('Failed to load: ' + (err.message || ''), 'error');
  }
}

// ── Open form ────────────────────────────────────────────────────
function openForm(item = null) {
  _editingId = item?.id || null;
  _coverUrl  = item?.coverUrl || '';
  _extraUrls = item ? [...(item.imageUrls || [])] : [];

  document.getElementById('pf-form-title').textContent = item ? 'Edit Work' : 'Add Work';
  document.getElementById('pf-ttl').value              = item?.title       || '';
  document.getElementById('pf-client').value           = item?.client      || '';
  document.getElementById('pf-cat').value              = item?.category    || '';
  document.getElementById('pf-sort').value             = item?.sortOrder   ?? 0;
  document.getElementById('pf-desc').value             = item?.description || '';
  document.getElementById('pf-featured').checked       = item?.featured    || false;
  document.getElementById('pf-cover-url').value        = _coverUrl;
  document.getElementById('pf-cover-url-input').value  = '';
  document.getElementById('pf-extra-url-input').value  = '';
  ['pf-cover-file','pf-imgs-file'].forEach(id => { const el = document.getElementById(id); if (el) el.value=''; });

  hide('pf-err');
  renderCoverPreview();
  renderExtraPreviews();
  show('portfolio-form');
  document.getElementById('portfolio-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Previews ─────────────────────────────────────────────────────
function renderCoverPreview() {
  const el = document.getElementById('pf-cover-preview');
  if (!el) return;
  el.innerHTML = _coverUrl
    ? `<div class="cover-preview"><img src="${esc(_coverUrl)}" alt="Cover" /><button class="cover-preview-remove" id="rm-cover">&times;</button></div>`
    : '';
  document.getElementById('rm-cover')?.addEventListener('click', () => {
    _coverUrl = ''; document.getElementById('pf-cover-url').value = ''; renderCoverPreview();
  });
}

function renderExtraPreviews() {
  const el = document.getElementById('pf-imgs-preview');
  if (!el) return;
  el.innerHTML = _extraUrls.map((url, i) => `
    <div class="cover-preview"><img src="${esc(url)}" alt="img ${i+1}" /><button class="cover-preview-remove" data-rm="${i}">&times;</button></div>`
  ).join('');
  el.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => { _extraUrls.splice(Number(btn.dataset.rm), 1); renderExtraPreviews(); });
  });
}

// ── URL inputs ───────────────────────────────────────────────────
function initUrlInputs() {
  const coverBtn = document.getElementById('pf-cover-url-btn');
  const extraBtn = document.getElementById('pf-extra-url-btn');

  coverBtn?.addEventListener('click', () => {
    const url = val('pf-cover-url-input');
    if (!url || !isValidUrl(url)) { showToast('Please paste a valid image URL.', 'error'); return; }
    _coverUrl = url;
    document.getElementById('pf-cover-url').value      = url;
    document.getElementById('pf-cover-url-input').value = '';
    renderCoverPreview();
    showToast('Cover image set.', 'success');
  });

  document.getElementById('pf-cover-url-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); coverBtn?.click(); }
  });

  extraBtn?.addEventListener('click', () => {
    const url = val('pf-extra-url-input');
    if (!url || !isValidUrl(url)) { showToast('Please paste a valid image URL.', 'error'); return; }
    _extraUrls.push(url);
    document.getElementById('pf-extra-url-input').value = '';
    renderExtraPreviews();
    showToast('Image added.', 'success');
  });

  document.getElementById('pf-extra-url-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); extraBtn?.click(); }
  });
}

// ── File uploads ─────────────────────────────────────────────────
function initFileUploads() {
  document.getElementById('pf-cover-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    showToast('Uploading…');
    try {
      const data = await uploadImage(file);
      _coverUrl  = data.url;
      document.getElementById('pf-cover-url').value = _coverUrl;
      renderCoverPreview();
      showToast('Cover uploaded.', 'success');
    } catch { showToast('Upload failed — paste the image URL instead.', 'error'); }
    e.target.value = '';
  });

  document.getElementById('pf-imgs-file')?.addEventListener('change', async (e) => {
    for (const file of Array.from(e.target.files)) {
      showToast(`Uploading ${file.name}…`);
      try {
        const data = await uploadImage(file);
        _extraUrls.push(data.url);
        renderExtraPreviews();
        showToast('Uploaded.', 'success');
      } catch { showToast('Upload failed — paste the image URL instead.', 'error'); }
    }
    e.target.value = '';
  });
}

// ── Save ─────────────────────────────────────────────────────────
async function saveForm() {
  const errEl = document.getElementById('pf-err');
  hide('pf-err');
  const title    = val('pf-ttl');
  const category = val('pf-cat');
  if (!title || !category) {
    errEl.textContent = 'Title and category are required.'; show('pf-err'); return;
  }
  const payload = {
    title, category,
    client:      val('pf-client'),
    description: val('pf-desc'),
    coverUrl:    _coverUrl,
    imageUrls:   _extraUrls,
    sortOrder:   parseInt(document.getElementById('pf-sort').value) || 0,
    featured:    document.getElementById('pf-featured').checked,
  };
  const btn = document.getElementById('pf-save');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    _editingId
      ? await PortfolioApi.update(_editingId, payload, _session.token)
      : await PortfolioApi.create(payload, _session.token);
    showToast(_editingId ? 'Updated!' : 'Added!', 'success');
    hide('portfolio-form');
    _editingId = null;
    await loadList();
  } catch (err) { errEl.textContent = err.message || 'Save failed.'; show('pf-err'); }
  btn.textContent = 'Save'; btn.disabled = false;
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  if (!guard()) return;
  initLayout();
  document.getElementById('pf-add-btn')?.addEventListener('click', () => openForm());
  document.getElementById('pf-cancel')?.addEventListener('click', () => { hide('portfolio-form'); _editingId = null; });
  document.getElementById('pf-save')?.addEventListener('click', saveForm);
  initUrlInputs();
  initFileUploads();
  loadList();
}

init();
