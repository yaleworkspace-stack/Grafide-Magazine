/* ============================================================
   GRAFIDE — shop.js  (Shop listing page)
   ============================================================ */
'use strict';

const Shop = {
  list: (page, cat) => Api.get(
    `/shop/products?page=${page||0}&size=12${cat ? '&category='+encodeURIComponent(cat) : ''}`
  ),
};

// ── Cart helpers (localStorage) ──────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem('grafide_cart') || '[]'); } catch { return []; }
}
function saveCart(cart) { localStorage.setItem('grafide_cart', JSON.stringify(cart)); }
function cartCount() { return getCart().reduce((sum, i) => sum + i.quantity, 0); }
function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) badge.textContent = cartCount();
}

// ── Product card HTML ────────────────────────────────────────────
function productCardHtml(p) {
  const img = p.imageUrls && p.imageUrls[0] ? p.imageUrls[0] : '/images/logo.png';
  return `
    <a class="product-card" href="/pages/product.html?id=${esc(p.id)}">
      <div class="product-card-img">
        <img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" />
        ${p.outOfStock ? '<span class="out-of-stock-badge">Out of Stock</span>' : ''}
      </div>
      <p class="product-card-brand">${esc(p.ownerName)}</p>
      <p class="product-card-title">${esc(p.title)}</p>
      <p class="product-card-price">₦${Number(p.price).toLocaleString()}</p>
    </a>`;
}

// ── State ────────────────────────────────────────────────────────
let _currentPage = 0;
let _currentCat  = '';
let _hasMore     = false;

// ── Load & render ────────────────────────────────────────────────
async function loadProducts(page = 0, category = '', append = false) {
  try {
    const r        = await Shop.list(page, category);
    const products = r.products || [];
    _hasMore       = r.hasMore  || false;

    document.getElementById('shop-loading').style.display = 'none';

    const grid = document.getElementById('product-grid');
    if (!products.length && !append) {
      document.getElementById('shop-empty').style.display = '';
      return;
    }

    grid.style.display = '';
    if (append) {
      grid.insertAdjacentHTML('beforeend', products.map(productCardHtml).join(''));
    } else {
      grid.innerHTML = products.map(productCardHtml).join('');
    }

    const moreWrap = document.getElementById('load-more-wrap');
    if (moreWrap) moreWrap.style.display = _hasMore ? '' : 'none';
  } catch {
    document.getElementById('shop-loading').style.display = 'none';
    document.getElementById('shop-empty').style.display   = '';
  }
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  initLayout('shop');
  updateCartBadge();

  // Category filters
  document.querySelectorAll('.shop-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shop-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentCat  = btn.dataset.category;
      _currentPage = 0;
      document.getElementById('product-grid').innerHTML  = '';
      document.getElementById('shop-loading').style.display = '';
      document.getElementById('shop-empty').style.display   = 'none';
      loadProducts(0, _currentCat);
    });
  });

  // Load more
  document.getElementById('load-more-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('load-more-btn');
    btn.textContent = 'Loading…'; btn.disabled = true;
    _currentPage++;
    await loadProducts(_currentPage, _currentCat, true);
    btn.textContent = 'Load More'; btn.disabled = false;
  });

  // Check URL for category param
  const params = new URLSearchParams(window.location.search);
  const cat    = params.get('category') || '';
  if (cat) {
    _currentCat = cat;
    const matchBtn = [...document.querySelectorAll('.shop-filter-btn')]
      .find(b => b.dataset.category === cat);
    if (matchBtn) {
      document.querySelectorAll('.shop-filter-btn').forEach(b => b.classList.remove('active'));
      matchBtn.classList.add('active');
    }
  }

  loadProducts(0, _currentCat);
}

init();
