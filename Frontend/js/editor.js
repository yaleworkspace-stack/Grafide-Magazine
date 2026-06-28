/* ============================================================
   GRAFIDE — editor.js  (Editor Dashboard)
   Tabs: review | manage | upload | subscribers
   ============================================================ */
'use strict';

// ── Guard: editor only ───────────────────────────────────────────
let _session = null;
function guardEditor() {
  _session = getSession();
  if (!_session || !isEditor(_session)) { window.location.href = '/index.html'; return false; }
  return true;
}

// ── Tab switching ────────────────────────────────────────────────
const TABS = ['manage', 'messages', 'orders', 'products', 'brands'];
function switchTab(name) {
  TABS.forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === name ? '' : 'none';
    document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === name);
  });
  // Load tab content on first visit
  if (name === 'manage'   && !_manageLoaded)   loadManage();
  if (name === 'messages' && !_msgsLoaded)     loadMessages();
  if (name === 'orders'   && !_ordersLoaded)   loadOrders();
  if (name === 'products' && !_productsLoaded) loadProducts();
  if (name === 'brands'   && !_brandsLoaded)   loadBrands();
}

// ── ─── REVIEW QUEUE ────────────────────────────────────────────
let _queueLoaded = false;
let _returnTargetId = null;

async function loadQueue() {
  _queueLoaded = true;
  try {
    const subs = await Submissions.queue(_session.token);
    document.getElementById('queue-loading').style.display = 'none';
    if (!subs.length) { document.getElementById('queue-empty').style.display = ''; return; }

    const list = document.getElementById('queue-list');
    list.style.display = '';
    list.innerHTML = subs.map(s => `
      <div class="queue-row" id="qrow-${esc(s.id)}">
        <div>
          <p class="queue-title">${esc(s.title)}</p>
          <p class="queue-meta">
            By ${esc(s.authorDisplayName)} &nbsp;·&nbsp; ${esc(s.category)}
            &nbsp;·&nbsp; ${fmt(s.submittedAt)}
          </p>
          ${s.editorNote ? `<p class="queue-note">${esc(s.editorNote)}</p>` : ''}
        </div>
        <div class="queue-actions">
          <a href="/pages/submit.html?view=preview&id=${esc(s.id)}"
             class="btn sm ghost" target="_blank">Preview</a>
          <button class="btn sm"        data-approve="${esc(s.id)}">Approve</button>
          <button class="btn danger sm" data-return="${esc(s.id)}">Return</button>
        </div>
      </div>`).join('');

    // Approve
    list.querySelectorAll('[data-approve]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Publish this submission?')) return;
        try {
          await Submissions.approve(btn.dataset.approve, _session.token);
          document.getElementById(`qrow-${btn.dataset.approve}`)?.remove();
          showToast('Published!');
          if (!list.children.length) document.getElementById('queue-empty').style.display = '';
        } catch (err) { showToast(err.message || 'Approve failed.'); }
      });
    });

    // Return — open modal
    list.querySelectorAll('[data-return]').forEach(btn => {
      btn.addEventListener('click', () => {
        _returnTargetId = btn.dataset.return;
        document.getElementById('return-note').value = '';
        document.getElementById('return-modal').classList.add('open');
      });
    });
  } catch {
    document.getElementById('queue-loading').style.display = 'none';
    document.getElementById('queue-empty').style.display   = '';
  }
}

function initReturnModal() {
  document.getElementById('return-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('return-modal').classList.remove('open');
    _returnTargetId = null;
  });
  document.getElementById('return-confirm-btn')?.addEventListener('click', async () => {
    const note = document.getElementById('return-note').value.trim();
    if (!note) { showToast('Please add a note for the author.'); return; }
    try {
      await Submissions.return(_returnTargetId, note, _session.token);
      document.getElementById(`qrow-${_returnTargetId}`)?.remove();
      document.getElementById('return-modal').classList.remove('open');
      showToast('Submission returned to author.');
      _returnTargetId = null;
      const list = document.getElementById('queue-list');
      if (!list?.children.length) document.getElementById('queue-empty').style.display = '';
    } catch (err) { showToast(err.message || 'Return failed.'); }
  });
}

// ── ─── MANAGE ARTICLES ──────────────────────────────────────────
let _manageLoaded = false;
let _editQuill    = null;
let _editingId    = null;

async function loadManage() {
  _manageLoaded = true;

  // Load pending submissions count and show inline
  try {
    const queue = await Submissions.queue(_session.token);
    if (queue.length) {
      const manageTab = document.querySelector('[data-tab="manage"]');
      if (manageTab && !manageTab.querySelector('.tab-badge')) {
        manageTab.insertAdjacentHTML('beforeend',
          `<span class="tab-badge">${queue.length}</span>`);
      }
      // Show pending submissions at top of manage tab
      const pendingSection = document.getElementById('manage-pending-section');
      if (pendingSection) {
        pendingSection.style.display = '';
        pendingSection.innerHTML = `
          <h3 style="font-family:'Times New Roman',serif;font-weight:400;font-size:1.3rem;color:var(--navy);margin-bottom:16px;">
            Pending Submissions <span style="font-size:.8rem;color:var(--cobalt);">${queue.length}</span>
          </h3>
          <div class="queue-list">
            ${queue.map(s => `
              <div class="queue-row" id="qrow-${esc(s.id)}">
                <div>
                  <p class="queue-title">${esc(s.title)}</p>
                  <p class="queue-meta">By ${esc(s.authorDisplayName)} · ${esc(s.category)} · ${fmt(s.submittedAt)}</p>
                </div>
                <div class="queue-actions">
                  <button class="btn sm" data-approve="${esc(s.id)}">Approve</button>
                  <button class="btn danger sm" data-return="${esc(s.id)}">Return</button>
                </div>
              </div>`).join('')}
          </div>`;

        // Wire approve/return
        pendingSection.querySelectorAll('[data-approve]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Publish this submission?')) return;
            try {
              await Submissions.approve(btn.dataset.approve, _session.token);
              document.getElementById(\`qrow-\${btn.dataset.approve}\`)?.remove();
              showToast('Published!');
              _manageLoaded = false;
              loadManage();
            } catch (err) { showToast(err.message || 'Failed.'); }
          });
        });
        pendingSection.querySelectorAll('[data-return]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const note = prompt('Note to author:');
            if (!note) return;
            try {
              await Submissions.return(btn.dataset.return, note, _session.token);
              document.getElementById(\`qrow-\${btn.dataset.return}\`)?.remove();
              showToast('Returned to author.');
            } catch (err) { showToast(err.message || 'Failed.'); }
          });
        });
      }
    }
  } catch { /* queue load fails silently */ }

  try {
    const r = await Api.get('/articles?page=0&size=50', _session.token);
    const articles = (r.articles || r || []);
    document.getElementById('manage-loading').style.display = 'none';
    if (!articles.length) { document.getElementById('manage-empty').style.display = ''; return; }

    const list = document.getElementById('manage-list');
    list.style.display = '';
    list.innerHTML = articles.map(a => `
      <div class="queue-row" id="mrow-${esc(a.id)}">
        <div>
          <p class="queue-title">${esc(a.title)}</p>
          <p class="queue-meta">${esc(a.category)} &nbsp;·&nbsp; By ${esc(a.author)} &nbsp;·&nbsp; ${fmt(a.date)}</p>
        </div>
        <div class="queue-actions">
          <a href="/pages/article.html?id=${esc(a.id)}" class="btn sm ghost" target="_blank">View</a>
          <button class="btn sm"          data-edit="${esc(a.id)}"
                  data-title="${esc(a.title)}"
                  data-dek="${esc(a.dek)}"
                  data-category="${esc(a.category)}"
                  data-body="${esc(a.richBody || '')}">Edit</button>
          <button class="btn sm ghost"    data-pin="${esc(a.id)}"   data-pinned="${a.pinned}">${a.pinned ? 'Unpin' : 'Pin'}</button>
          <button class="btn danger sm"   data-delete="${esc(a.id)}">Delete</button>
        </div>
      </div>`).join('');

    // Edit
    list.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEdit(btn));
    });
    // Pin / Unpin
    list.querySelectorAll('[data-pin]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id     = btn.dataset.pin;
        const pinned = btn.dataset.pinned === 'true';
        try {
          pinned ? await Articles.unpin(id, _session.token) : await Articles.pin(id, _session.token);
          btn.textContent   = pinned ? 'Pin' : 'Unpin';
          btn.dataset.pinned = String(!pinned);
          showToast(pinned ? 'Unpinned.' : 'Pinned as cover story.');
        } catch (err) { showToast(err.message || 'Action failed.'); }
      });
    });
    // Delete
    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this article permanently?')) return;
        try {
          await Articles.delete(btn.dataset.delete, _session.token);
          document.getElementById(`mrow-${btn.dataset.delete}`)?.remove();
          showToast('Article deleted.');
        } catch (err) { showToast(err.message || 'Delete failed.'); }
      });
    });
  } catch {
    document.getElementById('manage-loading').style.display = 'none';
    document.getElementById('manage-empty').style.display   = '';
  }
}

function openEdit(btn) {
  _editingId = btn.dataset.edit;
  document.getElementById('edit-title').value    = btn.dataset.title    || '';
  document.getElementById('edit-dek').value      = btn.dataset.dek      || '';
  document.getElementById('edit-category').value = btn.dataset.category || 'Fashion';

  if (!_editQuill) {
    _editQuill = new Quill('#edit-quill', {
      theme: 'snow',
      modules: { toolbar: [[{ header: [2, 3, false] }], ['bold','italic','underline'], ['blockquote','image'], [{ list:'ordered' }, { list:'bullet' }], ['clean']] },
    });
  }
  _editQuill.root.innerHTML = btn.dataset.body || '';

  document.getElementById('edit-panel').style.display = '';
  document.getElementById('edit-panel').scrollIntoView({ behavior: 'smooth' });
}

function initEditPanel() {
  document.getElementById('edit-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('edit-panel').style.display = 'none';
    _editingId = null;
  });
  document.getElementById('edit-save-btn')?.addEventListener('click', async () => {
    const errorEl = document.getElementById('edit-error');
    errorEl.style.display = 'none';
    const title    = document.getElementById('edit-title').value.trim();
    const dek      = document.getElementById('edit-dek').value.trim();
    const category = document.getElementById('edit-category').value;
    const richBody = _editQuill?.root.innerHTML || '';
    if (!title) { errorEl.textContent = 'Title is required.'; errorEl.style.display = ''; return; }
    const btn = document.getElementById('edit-save-btn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      await Articles.update(_editingId, { title, dek, category, richBody }, _session.token);
      showToast('Article updated.');
      document.getElementById('edit-panel').style.display = 'none';
      _manageLoaded = false;
      document.getElementById('manage-list').innerHTML = '';
      document.getElementById('manage-loading').style.display = '';
      loadManage();
    } catch (err) {
      errorEl.textContent   = err.message || 'Update failed.';
      errorEl.style.display = '';
    }
    btn.textContent = 'Save Changes'; btn.disabled = false;
  });
}

// ── ─── UPLOAD MAGAZINE ──────────────────────────────────────────
let _uploadInited = false;
let _uploadQuill  = null;

function initUpload() {
  _uploadInited = true;
  _uploadQuill = new Quill('#upload-quill', {
    theme: 'snow',
    placeholder: 'Write about this issue…',
    modules: { toolbar: [[{ header: [2,3,false] }], ['bold','italic'], ['blockquote','image'], ['clean']] },
  });

  document.getElementById('upload-submit-btn')?.addEventListener('click', async () => {
    const errorEl = document.getElementById('upload-error');
    errorEl.style.display = 'none';
    const title = document.getElementById('f-mag-title').value.trim();
    const dek   = document.getElementById('f-mag-dek').value.trim();
    const cover = document.getElementById('f-mag-cover').files[0];
    if (!title || !cover) {
      errorEl.textContent = 'Title and cover image are required.';
      errorEl.style.display = ''; return;
    }
    const btn = document.getElementById('upload-submit-btn');
    btn.textContent = 'Publishing…'; btn.disabled = true;
    try {
      const data = await uploadImage(cover); // shared.js
      await Api.post('/magazines', {
        title, dek,
        coverImageUrls: [data.url],
        richBody: _uploadQuill.root.innerHTML,
      }, _session.token);
      showToast('Issue published!');
      document.getElementById('f-mag-title').value = '';
      document.getElementById('f-mag-dek').value   = '';
      document.getElementById('f-mag-cover').value = '';
      _uploadQuill.setContents([]);
    } catch (err) {
      errorEl.textContent   = err.message || 'Publish failed.';
      errorEl.style.display = '';
    }
    btn.textContent = 'Publish Issue'; btn.disabled = false;
  });
}

// ── ─── SUBSCRIBERS ──────────────────────────────────────────────
let _subsLoaded = false;
async function loadSubscribers() {
  _subsLoaded = true;
  try {
    const subs = await Subscribers.list(_session.token);
    document.getElementById('sub-loading').style.display = 'none';
    if (!subs.length) { document.getElementById('sub-empty').style.display = ''; return; }
    document.getElementById('sub-count').textContent = `${subs.length} subscriber${subs.length !== 1 ? 's' : ''}`;
    document.getElementById('sub-tbody').innerHTML = subs.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(s.email)}</td>
        <td>${fmt(s.subscribedAt)}</td>
      </tr>`).join('');
    document.getElementById('sub-content').style.display = '';
  } catch {
    document.getElementById('sub-loading').style.display = 'none';
    document.getElementById('sub-empty').style.display   = '';
  }
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  if (!guardEditor()) return;
  initLayout('editor');

  // Tab click handlers
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Deep link via URL hash or param
  const params   = new URLSearchParams(window.location.search);
  const hashTab  = window.location.hash.replace('#', '');
  const startTab = TABS.includes(hashTab) ? hashTab
                 : TABS.includes(params.get('tab')) ? params.get('tab')
                 : 'manage';

  initEditPanel();
  initOrderFilters();
  initProductForm();
  initBrandFilters();
  switchTab(startTab);
}

init();
