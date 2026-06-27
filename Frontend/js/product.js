/* ============================================================
   GRAFIDE — product.js  (Product detail page)
   ============================================================ */
'use strict';

// ── Cart helpers ─────────────────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem('grafide_cart') || '[]'); } catch { return []; }
}
function saveCart(cart) { localStorage.setItem('grafide_cart', JSON.stringify(cart)); }

function addToCart(product, qty) {
  const cart  = getCart();
  const exist = cart.find(i => i.productId === product.id);
  if (exist) {
    exist.quantity += qty;
  } else {
    cart.push({
      productId:    product.id,
      title:        product.title,
      ownerName:    product.ownerName,
      price:        product.price,
      imageUrl:     (product.imageUrls && product.imageUrls[0]) || '',
      quantity:     qty,
    });
  }
  saveCart(cart);
}

// ── Gallery ──────────────────────────────────────────────────────
let _currentImg = 0;

function renderGallery(imageUrls, title) {
  const mainImg  = document.getElementById('detail-main-img');
  const thumbs   = document.getElementById('detail-thumbs');
  const images   = (imageUrls || []).filter(Boolean);
  const fallback = '/images/logo.png';

  if (!images.length) {
    mainImg.src = fallback;
    mainImg.alt = title;
    return;
  }

  mainImg.src = images[0];
  mainImg.alt = title;

  if (images.length > 1) {
    thumbs.innerHTML = images.map((src, i) => `
      <button class="product-detail-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="View image ${i + 1}">
        <img src="${esc(src)}" alt="${esc(title)} ${i + 1}" />
      </button>`).join('');

    thumbs.querySelectorAll('.product-detail-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        _currentImg = Number(btn.dataset.idx);
        mainImg.src = images[_currentImg];
        thumbs.querySelectorAll('.product-detail-thumb')
              .forEach(b => b.classList.toggle('active', Number(b.dataset.idx) === _currentImg));
      });
    });
  }
}

// ── Render product ───────────────────────────────────────────────
function renderProduct(p) {
  document.title = `${p.title} — Grafide Shop`;

  renderGallery(p.imageUrls, p.title);

  document.getElementById('detail-brand').textContent = p.ownerName || 'Grafide';
  document.getElementById('detail-title').textContent = p.title;
  document.getElementById('detail-price').textContent = `₦${Number(p.price).toLocaleString()}`;
  document.getElementById('detail-desc').textContent  = p.description || '';

  if (p.outOfStock) {
    document.getElementById('out-of-stock-msg').style.display = '';
    document.getElementById('qty-row').style.display           = 'none';
    const addBtn = document.getElementById('add-to-cart-btn');
    addBtn.textContent = 'Out of Stock';
    addBtn.disabled    = true;
    addBtn.style.opacity = '0.5';
  }

  document.getElementById('product-loading').style.display = 'none';
  document.getElementById('product-detail').style.display  = '';
}

// ── Qty controls ─────────────────────────────────────────────────
function initQty(maxStock) {
  const input = document.getElementById('qty-val');
  document.getElementById('qty-up')?.addEventListener('click', () => {
    const v = parseInt(input.value) || 1;
    if (v < maxStock) input.value = v + 1;
  });
  document.getElementById('qty-down')?.addEventListener('click', () => {
    const v = parseInt(input.value) || 1;
    if (v > 1) input.value = v - 1;
  });
  input?.addEventListener('change', () => {
    let v = parseInt(input.value) || 1;
    if (v < 1)        v = 1;
    if (v > maxStock) v = maxStock;
    input.value = v;
  });
}

// ── Init ─────────────────────────────────────────────────────────
async function init() {
  initLayout();

  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) {
    document.getElementById('product-loading').style.display = 'none';
    document.getElementById('product-error').style.display   = '';
    return;
  }

  try {
    const p = await Api.get(`/shop/products/${id}`);
    renderProduct(p);
    initQty(p.stock);

    // Add to cart
    document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
      if (p.outOfStock) return;
      const qty = parseInt(document.getElementById('qty-val').value) || 1;
      addToCart(p, qty);
      const msg = document.getElementById('add-cart-msg');
      msg.textContent   = `Added ${qty} × ${p.title} to cart.`;
      msg.style.display = '';
      setTimeout(() => { msg.style.display = 'none'; }, 2500);
    });

  } catch {
    document.getElementById('product-loading').style.display = 'none';
    document.getElementById('product-error').style.display   = '';
  }
}

init();
