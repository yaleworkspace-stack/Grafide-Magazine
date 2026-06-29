/* ============================================================
   GRAFIDE — editor.js  (Editor Dashboard)
   Tabs: articles | queue | messages | subscribers | orders | products | brands
   ============================================================ */
'use strict';

let _session = null;

function guardEditor() {
  _session = getSession();
  if (!_session || !isEditor(_session)) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// ── Tab switching ────────────────────────────────────────────────
const TABS = ['articles','queue','messages','subscribers','orders','products','brands'];
const _loaded = {};

function switchTab(name) {
  TABS.forEach(t => {
    const el  = document.getElementById(`tab-${t}`);
    const btn = document.querySelector(`[data-tab="${t}"]`);
    if (el)  el.style.display  = t === name ? '' : 'none';
    if (btn) btn.classList.toggle('active', t === name);
  });
  if (!_loaded[name]) {
    _loaded[name] = true;
    ({
      articles:    loadArticles,
      queue:       loadQueue,
      messages:    loadMessages,
      subscribers: loadSubscribers,
      orders:      () => loadOrders(''),
      products:    loadProducts,
      brands:      () => loadBrands(''),
    })[name]?.();
  }
}

// ── Helpers ──────────────────────────────────────────────────────
const Shop = {
  products: {
    list:   ()         => Api.get('/shop/products?page=0&size=100', _session.token),
    create: (d)        => Api.post('/shop/products', d, _session.token),
    update: (id, d)    => Api.put(`/shop/products/${id}`, d, _session.token),
    delete: (id)       => Api.delete(`/shop/products/${id}`, _session.token),
  },
  orders: {
    all:    (status)   => Api.get(`/orders${status ? '?status='+status : ''}`, _session.token),
    status: (id, s)    => Api.put(`/orders/${id}/status`, { status: s }, _session.token),
  },
  brands: {
    list:    (status)  => Api.get(`/brands${status ? '?status='+status : ''}`, _session.token),
    approve: (id, rate)=> Api.put(`/brands/${id}/approve`, { commissionRate: rate }, _session.token),
    reject:  (id, note)=> Api.put(`/brands/${id}/reject`, { note }, _session.token),
    delete:  (id)      => Api.delete(`/brands/${id}`, _session.token),
  },
};

function show(id)  { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id)  { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function html(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }

// ── ARTICLES ─────────────────────────────────────────────────────
let _editQuill = null;
let _editingId = null;

async function loadArticles() {
  try {
    const r = await Api.get('/articles?page=0&size=100', _session.token);
    const articles = r.articles || r || [];
    hide('articles-loading');
    if (!articles.length) { show('articles-empty'); return; }

    const list = document.getElementById('articles-list');
    if (!list) return;
    list.style.display = '';
    list.innerHTML = articles.map(a => `
      <div class="queue-row" id="arow-${esc(a.id)}">
        <div>
          <p class="queue-title">${esc(a.title)}</p>
          <p class="queue-meta">${esc(a.category)} &nbsp;·&nbsp; By ${esc(a.author)} &nbsp;·&nbsp; ${fmt(a.date)}</p>
        </div>
        <div class="queue-actions">
          <a href="/pages/article.html?id=${esc(a.id)}" class="btn sm ghost" target="_blank">View</a>
          <button class="btn sm" data-edit-id="${esc(a.id)}"
            data-title="${esc(a.title)}" data-dek="${esc(a.dek||'')}"
            data-category="${esc(a.category)}" data-body="${esc(a.richBody||'')}">Edit</button>
          <button class="btn sm ghost" data-pin-id="${esc(a.id)}" data-pinned="${a.pinned}">
            ${a.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button class="btn danger sm" data-del-id="${esc(a.id)}">Delete</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => openEdit(btn));
    });
    list.querySelectorAll('[data-pin-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pinned = btn.dataset.pinned === 'true';
        try {
          pinned ? await Articles.unpin(btn.dataset.pinId, _session.token)
                 : await Articles.pin(btn.dataset.pinId, _session.token);
          btn.textContent    = pinned ? 'Pin' : 'Unpin';
          btn.dataset.pinned = String(!pinned);
          showToast(pinned ? 'Unpinned.' : 'Pinned as cover story.');
        } catch (err) { showToast(err.message || 'Failed.'); }
      });
    });
    list.querySelectorAll('[data-del-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this article permanently?')) return;
        try {
          await Articles.delete(btn.dataset.delId, _session.token);
          document.getElementById(`arow-${btn.dataset.delId}`)?.remove();
          showToast('Article deleted.');
        } catch (err) { showToast(err.message || 'Delete failed.'); }
      });
    });
  } catch (err) {
    hide('articles-loading');
    show('articles-empty');
    showToast('Failed to load articles: ' + (err.message || ''));
  }
}

function openEdit(btn) {
  _editingId = btn.dataset.editId;
  document.getElementById('edit-title').value    = btn.dataset.title    || '';
  document.getElementById('edit-dek').value      = btn.dataset.dek      || '';
  document.getElementById('edit-category').value = btn.dataset.category || 'Fashion';

  if (!_editQuill) {
    _editQuill = new Quill('#edit-quill', {
      theme: 'snow',
      modules: { toolbar: [[{header:[2,3,false]}],['bold','italic','underline'],['blockquote'],['clean']] },
    });
  }
  _editQuill.root.innerHTML = btn.dataset.body || '';
  show('edit-panel');
  document.getElementById('edit-panel').scrollIntoView({ behavior: 'smooth' });
  hide('edit-error');
}

function initEditPanel() {
  document.getElementById('edit-cancel-btn')?.addEventListener('click', () => {
    hide('edit-panel'); _editingId = null;
  });
  document.getElementById('edit-save-btn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('edit-error');
    hide('edit-error');
    const title    = document.getElementById('edit-title').value.trim();
    const dek      = document.getElementById('edit-dek').value.trim();
    const category = document.getElementById('edit-category').value;
    const richBody = _editQuill?.root.innerHTML || '';
    if (!title) { errEl.textContent = 'Title is required.'; show('edit-error'); return; }
    const btn = document.getElementById('edit-save-btn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      await Articles.update(_editingId, { title, dek, category, richBody }, _session.token);
      showToast('Article updated.');
      hide('edit-panel');
      _loaded.articles = false;
      html('articles-list', '');
      show('articles-loading');
      loadArticles();
    } catch (err) { errEl.textContent = err.message || 'Update failed.'; show('edit-error'); }
    btn.textContent = 'Save Changes'; btn.disabled = false;
  });
}

// ── REVIEW QUEUE ─────────────────────────────────────────────────
let _returnTargetId = null;

async function loadQueue() {
  try {
    const subs = await Submissions.queue(_session.token);
    hide('queue-loading');
    if (!subs.length) { show('queue-empty'); return; }

    const list = document.getElementById('queue-list');
    list.style.display = '';
    list.innerHTML = subs.map(s => `
      <div class="queue-row" id="qrow-${esc(s.id)}">
        <div>
          <p class="queue-title">${esc(s.title)}</p>
          <p class="queue-meta">By ${esc(s.authorDisplayName)} &nbsp;·&nbsp; ${esc(s.category)} &nbsp;·&nbsp; ${fmt(s.submittedAt)}</p>
          ${s.editorNote ? `<p class="queue-note">${esc(s.editorNote)}</p>` : ''}
        </div>
        <div class="queue-actions">
          <button class="btn sm" data-approve="${esc(s.id)}">Approve</button>
          <button class="btn danger sm" data-return="${esc(s.id)}">Return</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-approve]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Publish this submission as an article?')) return;
        try {
          await Submissions.approve(btn.dataset.approve, _session.token);
          document.getElementById(`qrow-${btn.dataset.approve}`)?.remove();
          showToast('Published successfully!');
          if (!list.children.length) { hide('queue-list'); show('queue-empty'); }
          // Refresh articles tab badge
          _loaded.articles = false;
        } catch (err) { showToast(err.message || 'Approve failed.'); }
      });
    });
    list.querySelectorAll('[data-return]').forEach(btn => {
      btn.addEventListener('click', () => {
        _returnTargetId = btn.dataset.return;
        document.getElementById('return-note').value = '';
        document.getElementById('return-modal').classList.add('open');
      });
    });
  } catch (err) {
    hide('queue-loading');
    show('queue-empty');
    showToast('Failed to load queue: ' + (err.message || ''));
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
      showToast('Returned to author.');
      _returnTargetId = null;
      const list = document.getElementById('queue-list');
      if (!list?.children.length) { hide('queue-list'); show('queue-empty'); }
    } catch (err) { showToast(err.message || 'Return failed.'); }
  });
}

// ── MESSAGES ─────────────────────────────────────────────────────
async function loadMessages() {
  try {
    const messages = await Contact.list(_session.token);
    hide('msg-loading');
    if (!messages.length) { show('msg-empty'); return; }

    const list = document.getElementById('msg-list');
    list.style.display = '';
    list.innerHTML = messages.map(m => `
      <div class="queue-row" id="msgrow-${esc(m.id)}" style="${m.read ? 'opacity:.65' : ''}">
        <div>
          <p class="queue-title">
            ${esc(m.name)}
            ${!m.read ? '<span class="status-badge status-pending" style="font-size:.6rem;margin-left:8px;">Unread</span>' : ''}
          </p>
          <p class="queue-meta">${esc(m.email)} &nbsp;·&nbsp; ${esc(m.subject)} &nbsp;·&nbsp; ${fmt(m.receivedAt)}</p>
          <p style="margin-top:10px;font-size:.9rem;font-weight:300;color:var(--ink);line-height:1.6;white-space:pre-wrap;">${esc(m.message)}</p>
        </div>
        <div class="queue-actions">
          ${!m.read ? `<button class="btn sm ghost" data-markread="${esc(m.id)}">Mark Read</button>` : ''}
          <a href="mailto:${esc(m.email)}?subject=Re: ${esc(m.subject)}" class="btn sm">Reply</a>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-markread]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await Contact.markRead(btn.dataset.markread, _session.token);
          const row = document.getElementById(`msgrow-${btn.dataset.markread}`);
          if (row) { row.style.opacity = '.65'; btn.remove(); }
          showToast('Marked as read.');
        } catch (err) { showToast(err.message || 'Failed.'); }
      });
    });
  } catch (err) {
    hide('msg-loading');
    show('msg-empty');
    showToast('Failed to load messages: ' + (err.message || ''));
  }
}

// ── SUBSCRIBERS ───────────────────────────────────────────────────
async function loadSubscribers() {
  try {
    const subs = await Subscribers.list(_session.token);
    hide('sub-loading');
    if (!subs.length) { show('sub-empty'); return; }
    document.getElementById('sub-count').textContent =
      `${subs.length} subscriber${subs.length !== 1 ? 's' : ''}`;
    document.getElementById('sub-tbody').innerHTML = subs.map((s, i) => `
      <tr><td>${i+1}</td><td>${esc(s.email)}</td><td>${fmt(s.subscribedAt)}</td></tr>`).join('');
    show('sub-content');
  } catch (err) {
    hide('sub-loading');
    show('sub-empty');
    showToast('Failed to load subscribers: ' + (err.message || ''));
  }
}

// ── ORDERS ────────────────────────────────────────────────────────
const ORDER_STATUS_CSS = { PENDING:'status-pending', PAID:'status-published',
  PROCESSING:'status-pending', SHIPPED:'status-pending',
  DELIVERED:'status-published', CANCELLED:'status-returned' };

async function loadOrders(status) {
  show('orders-loading'); hide('orders-empty');
  html('orders-list', '');
  try {
    const orders = await Shop.orders.all(status);
    hide('orders-loading');
    if (!orders.length) { show('orders-empty'); return; }

    const list = document.getElementById('orders-list');
    list.style.display = '';
    list.innerHTML = orders.map(o => `
      <div class="queue-row">
        <div>
          <p class="queue-title">#${esc(o.id.slice(-8).toUpperCase())} &nbsp;·&nbsp; ${esc(o.customerName)}</p>
          <p class="queue-meta">${esc(o.customerEmail)} &nbsp;·&nbsp; ₦${Number(o.total).toLocaleString()} &nbsp;·&nbsp; ${fmt(o.createdAt)}</p>
          <p class="queue-meta" style="margin-top:4px;">${o.items.map(i=>`${esc(i.productTitle)} ×${i.quantity}`).join(', ')}</p>
          <p class="queue-meta" style="margin-top:2px;">
            Ship to: ${esc(o.shippingName)}, ${esc(o.shippingAddress)}, ${esc(o.shippingCity)}, ${esc(o.shippingState)}
          </p>
        </div>
        <div class="queue-actions">
          <span class="status-badge ${ORDER_STATUS_CSS[o.status]||'status-pending'}">${esc(o.status)}</span>
          ${o.status==='PAID'        ? `<button class="btn sm" data-order="${esc(o.id)}" data-next="PROCESSING">Process</button>` : ''}
          ${o.status==='PROCESSING'  ? `<button class="btn sm" data-order="${esc(o.id)}" data-next="SHIPPED">Mark Shipped</button>` : ''}
          ${o.status==='SHIPPED'     ? `<button class="btn sm" data-order="${esc(o.id)}" data-next="DELIVERED">Delivered</button>` : ''}
          ${['PAID','PROCESSING'].includes(o.status) ? `<button class="btn danger sm" data-order="${esc(o.id)}" data-next="CANCELLED">Cancel</button>` : ''}
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-order]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await Shop.orders.status(btn.dataset.order, btn.dataset.next);
          showToast('Order updated.');
          _loaded.orders = false;
          loadOrders(status);
        } catch (err) { showToast(err.message || 'Update failed.'); }
      });
    });
  } catch (err) {
    hide('orders-loading');
    show('orders-empty');
    showToast('Failed to load orders: ' + (err.message || ''));
  }
}

function initOrderFilters() {
  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _loaded.orders = false;
      loadOrders(btn.dataset.status);
    });
  });
}

// ── PRODUCTS ──────────────────────────────────────────────────────
let _editingProductId = null;
let _productImageUrls = [];

async function loadProducts() {
  try {
    // Populate brand select
    try {
      const brands = await Shop.brands.list('approved');
      const sel = document.getElementById('pf-brand');
      if (sel) sel.innerHTML = '<option value="">Grafide (own product)</option>' +
        brands.map(b => `<option value="${esc(b.id)}">${esc(b.name)} (${b.commissionRate}%)</option>`).join('');
    } catch { /* silent */ }

    const r = await Shop.products.list();
    const products = r.products || r || [];
    hide('products-loading');
    if (!products.length) { show('products-empty'); return; }

    const list = document.getElementById('products-list');
    list.style.display = '';
    list.innerHTML = products.map(p => `
      <div class="queue-row" id="prodrow-${esc(p.id)}">
        <div style="display:flex;gap:14px;align-items:flex-start;">
          ${p.imageUrls?.[0]
            ? `<img src="${esc(p.imageUrls[0])}" style="width:56px;height:56px;object-fit:cover;border-radius:4px;flex-shrink:0;" />`
            : '<div style="width:56px;height:56px;background:var(--line);border-radius:4px;flex-shrink:0;"></div>'}
          <div>
            <p class="queue-title">${esc(p.title)}</p>
            <p class="queue-meta">${esc(p.category)} &nbsp;·&nbsp; ₦${Number(p.price).toLocaleString()} &nbsp;·&nbsp; Stock: ${p.stock}</p>
            <p class="queue-meta">${esc(p.ownerName)}${p.commissionRate<100?` (${p.commissionRate}% commission)`:''}</p>
            ${p.outOfStock ? '<span class="status-badge status-returned">Out of Stock</span>' : ''}
          </div>
        </div>
        <div class="queue-actions">
          <button class="btn sm ghost" data-edit-prod="${esc(p.id)}" data-prod='${JSON.stringify({id:p.id,title:p.title,description:p.description||'',category:p.category,price:p.price,stock:p.stock,brandId:p.brandId||'',imageUrls:p.imageUrls||[]})}'>Edit</button>
          <button class="btn danger sm" data-del-prod="${esc(p.id)}">Delete</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-edit-prod]').forEach(btn => {
      btn.addEventListener('click', () => {
        try { openProductForm(JSON.parse(btn.dataset.prod)); } catch { openProductForm(null); }
      });
    });
    list.querySelectorAll('[data-del-prod]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this product?')) return;
        try {
          await Shop.products.delete(btn.dataset.delProd);
          document.getElementById(`prodrow-${btn.dataset.delProd}`)?.remove();
          showToast('Product deleted.');
        } catch (err) { showToast(err.message || 'Delete failed.'); }
      });
    });
  } catch (err) {
    hide('products-loading');
    show('products-empty');
    showToast('Failed to load products: ' + (err.message || ''));
  }
}

function openProductForm(p = null) {
  _editingProductId = p?.id || null;
  _productImageUrls = p ? [...(p.imageUrls || [])] : [];
  document.getElementById('product-form-title').textContent = p ? 'Edit Product' : 'Add Product';
  document.getElementById('pf-title').value       = p?.title       || '';
  document.getElementById('pf-description').value = p?.description || '';
  document.getElementById('pf-category').value    = p?.category    || '';
  document.getElementById('pf-price').value       = p?.price       || '';
  document.getElementById('pf-stock').value       = p?.stock       || '';
  document.getElementById('pf-brand').value       = p?.brandId     || '';
  renderProductPreviews();
  show('product-form-panel');
  document.getElementById('product-form-panel').scrollIntoView({ behavior: 'smooth' });
  hide('product-form-error');
}

function renderProductPreviews() {
  const prev = document.getElementById('pf-image-previews');
  if (!prev) return;
  prev.innerHTML = _productImageUrls.map((url, i) => `
    <div class="cover-preview">
      <img src="${esc(url)}" alt="Preview" />
      <button class="cover-preview-remove" data-rm="${i}">&times;</button>
    </div>`).join('');
  prev.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => {
      _productImageUrls.splice(Number(btn.dataset.rm), 1);
      renderProductPreviews();
    });
  });
}

function initProductForm() {
  document.getElementById('add-product-btn')?.addEventListener('click', () => openProductForm());
  document.getElementById('pf-cancel-btn')?.addEventListener('click', () => hide('product-form-panel'));
  document.getElementById('pf-images')?.addEventListener('change', async (e) => {
    for (const file of Array.from(e.target.files)) {
      try {
        const data = await uploadImage(file);
        _productImageUrls.push(data.url);
        renderProductPreviews();
      } catch (err) { showToast(err.message || 'Image upload failed.'); }
    }
  });
  document.getElementById('pf-save-btn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('product-form-error');
    hide('product-form-error');
    const payload = {
      title:       document.getElementById('pf-title').value.trim(),
      description: document.getElementById('pf-description').value.trim(),
      category:    document.getElementById('pf-category').value,
      price:       parseFloat(document.getElementById('pf-price').value) || 0,
      stock:       parseInt(document.getElementById('pf-stock').value)   || 0,
      brandId:     document.getElementById('pf-brand').value || null,
      imageUrls:   _productImageUrls,
    };
    if (!payload.title || !payload.category || payload.price <= 0) {
      errEl.textContent = 'Title, category, and a valid price are required.';
      show('product-form-error'); return;
    }
    const btn = document.getElementById('pf-save-btn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      _editingProductId
        ? await Shop.products.update(_editingProductId, payload)
        : await Shop.products.create(payload);
      showToast(_editingProductId ? 'Product updated.' : 'Product added.');
      hide('product-form-panel');
      _editingProductId = null;
      _loaded.products = false;
      html('products-list', '');
      show('products-loading');
      loadProducts();
    } catch (err) { errEl.textContent = err.message || 'Save failed.'; show('product-form-error'); }
    btn.textContent = 'Save Product'; btn.disabled = false;
  });
}

// ── BRANDS ────────────────────────────────────────────────────────
async function loadBrands(status) {
  show('brands-loading'); hide('brands-empty');
  html('brands-list', '');
  try {
    const brands = await Shop.brands.list(status);
    hide('brands-loading');
    if (!brands.length) { show('brands-empty'); return; }

    const list = document.getElementById('brands-list');
    list.style.display = '';
    list.innerHTML = brands.map(b => `
      <div class="queue-row" id="brandrow-${esc(b.id)}">
        <div>
          <p class="queue-title">${esc(b.name)}</p>
          <p class="queue-meta">
            ${esc(b.contactName)} &nbsp;·&nbsp; ${esc(b.email)}
            ${b.website ? ` &nbsp;·&nbsp; <a href="${esc(b.website)}" target="_blank" rel="noopener" style="color:var(--cobalt)">Website</a>` : ''}
          </p>
          ${b.description ? `<p class="queue-meta" style="margin-top:4px;">${esc(b.description)}</p>` : ''}
          ${b.status==='approved' ? `<p class="queue-meta" style="margin-top:4px;">Commission: <strong>${b.commissionRate}%</strong></p>` : ''}
          ${b.editorNote ? `<p class="queue-note">${esc(b.editorNote)}</p>` : ''}
        </div>
        <div class="queue-actions">
          <span class="status-badge ${b.status==='approved'?'status-published':b.status==='rejected'?'status-returned':'status-pending'}">${esc(b.status)}</span>
          ${b.status==='pending' ? `
            <button class="btn sm" data-approve-brand="${esc(b.id)}">Approve</button>
            <button class="btn danger sm" data-reject-brand="${esc(b.id)}">Reject</button>` : ''}
          ${b.status==='approved' ? `
            <button class="btn ghost sm" data-commission="${esc(b.id)}" data-rate="${b.commissionRate}">Edit Rate</button>` : ''}
          <button class="btn danger sm" data-del-brand="${esc(b.id)}">Remove</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-approve-brand]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = prompt('Set commission rate (%):', '15');
        if (r === null) return;
        const rate = parseFloat(r);
        if (isNaN(rate) || rate < 0 || rate > 100) { showToast('Invalid rate.'); return; }
        try {
          await Shop.brands.approve(btn.dataset.approveBrand, rate);
          showToast('Brand approved.'); _loaded.brands = false; loadBrands(status);
        } catch (err) { showToast(err.message || 'Failed.'); }
      });
    });
    list.querySelectorAll('[data-reject-brand]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const note = prompt('Reason (optional):') || '';
        try {
          await Shop.brands.reject(btn.dataset.rejectBrand, note);
          showToast('Brand rejected.'); _loaded.brands = false; loadBrands(status);
        } catch (err) { showToast(err.message || 'Failed.'); }
      });
    });
    list.querySelectorAll('[data-commission]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = prompt('New rate (%):', btn.dataset.rate);
        if (r === null) return;
        const rate = parseFloat(r);
        if (isNaN(rate)) { showToast('Invalid rate.'); return; }
        try {
          await Api.put(`/brands/${btn.dataset.commission}/commission`, { commissionRate: rate }, _session.token);
          showToast('Rate updated.'); _loaded.brands = false; loadBrands(status);
        } catch (err) { showToast(err.message || 'Failed.'); }
      });
    });
    list.querySelectorAll('[data-del-brand]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this brand?')) return;
        try {
          await Shop.brands.delete(btn.dataset.delBrand);
          document.getElementById(`brandrow-${btn.dataset.delBrand}`)?.remove();
          showToast('Brand removed.');
        } catch (err) { showToast(err.message || 'Failed.'); }
      });
    });
  } catch (err) {
    hide('brands-loading');
    show('brands-empty');
    showToast('Failed to load brands: ' + (err.message || ''));
  }
}

function initBrandFilters() {
  document.querySelectorAll('.brand-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.brand-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _loaded.brands = false;
      loadBrands(btn.dataset.status);
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────
function init() {
  if (!guardEditor()) return;
  initLayout('editor');

  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  initEditPanel();
  initReturnModal();
  initOrderFilters();
  initProductForm();
  initBrandFilters();

  const params   = new URLSearchParams(window.location.search);
  const hash     = window.location.hash.replace('#', '');
  const startTab = TABS.includes(hash) ? hash
                 : TABS.includes(params.get('tab')) ? params.get('tab')
                 : 'articles';
  switchTab(startTab);
}

init();
