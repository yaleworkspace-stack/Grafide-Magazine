/* ============================================================
   GRAFIDE — cart.js  (Cart + Checkout page)
   ============================================================ */
'use strict';

const SHIPPING_FEE = 2500;

// ── Cart storage ─────────────────────────────────────────────────
function getCart()          { try { return JSON.parse(localStorage.getItem('grafide_cart') || '[]'); } catch { return []; } }
function saveCart(cart)     { localStorage.setItem('grafide_cart', JSON.stringify(cart)); }
function clearCart()        { localStorage.removeItem('grafide_cart'); }

function removeItem(productId) {
  const cart = getCart().filter(i => i.productId !== productId);
  saveCart(cart);
  renderCart();
}

function cartSubtotal(cart) {
  return cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

// ── Render cart ──────────────────────────────────────────────────
function renderCart() {
  const cart   = getCart();
  const empty  = document.getElementById('cart-empty');
  const content = document.getElementById('cart-content');
  const items  = document.getElementById('cart-items');

  if (!cart.length) {
    empty.style.display   = '';
    content.style.display = 'none';
    return;
  }

  empty.style.display   = 'none';
  content.style.display = '';

  items.innerHTML = cart.map(i => `
    <div class="cart-row">
      <img class="cart-row-img" src="${esc(i.imageUrl || '/images/logo.png')}" alt="${esc(i.title)}" />
      <div>
        <p class="cart-row-title">${esc(i.title)}</p>
        <p class="cart-row-brand">${esc(i.ownerName)} &nbsp;·&nbsp; Qty: ${i.quantity}</p>
      </div>
      <p class="cart-row-price">₦${Number(i.price * i.quantity).toLocaleString()}</p>
      <button class="cart-row-remove" data-remove="${esc(i.productId)}" aria-label="Remove">&times;</button>
    </div>`).join('');

  // Remove handlers
  items.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.remove));
  });

  const subtotal = cartSubtotal(cart);
  const total    = subtotal + SHIPPING_FEE;

  document.getElementById('summary-subtotal').textContent = `₦${Number(subtotal).toLocaleString()}`;
  document.getElementById('summary-total').textContent    = `₦${Number(total).toLocaleString()}`;
}

// ── Checkout ──────────────────────────────────────────────────────
async function checkout() {
  const session = getSession();
  if (!session) {
    window.location.href = '/pages/auth.html?redirect=cart';
    return;
  }

  const errorEl = document.getElementById('checkout-error');
  errorEl.style.display = 'none';

  const cart = getCart();
  if (!cart.length) { showToast('Your cart is empty.'); return; }

  // Gather shipping fields
  const shippingName    = document.getElementById('s-name').value.trim();
  const shippingPhone   = document.getElementById('s-phone').value.trim();
  const shippingAddress = document.getElementById('s-address').value.trim();
  const shippingCity    = document.getElementById('s-city').value.trim();
  const shippingState   = document.getElementById('s-state').value.trim();

  if (!shippingName || !shippingPhone || !shippingAddress || !shippingCity || !shippingState) {
    errorEl.textContent   = 'Please fill in all shipping details.';
    errorEl.style.display = '';
    document.querySelector('.shipping-form').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const btn = document.getElementById('checkout-btn');
  btn.textContent = 'Processing…'; btn.disabled = true;

  try {
    // Step 1: Create order
    const orderRes = await Api.post('/orders', {
      items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingCity,
      shippingState,
    }, session.token);

    // Step 2: Initiate Paystack payment
    const payRes = await Api.post('/paystack/initiate',
      { orderId: orderRes.orderId },
      session.token
    );

    // Step 3: Clear cart and redirect to Paystack
    clearCart();
    window.location.href = payRes.authorizationUrl;

  } catch (err) {
    errorEl.textContent   = err.message || 'Checkout failed. Please try again.';
    errorEl.style.display = '';
    btn.textContent = 'Proceed to Payment'; btn.disabled = false;
  }
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  initLayout();

  // Show payment result banners if redirected back
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    document.getElementById('payment-success-banner').style.display = '';
  }
  if (params.get('payment') === 'failed') {
    document.getElementById('payment-failed-banner').style.display = '';
  }

  renderCart();

  document.getElementById('checkout-btn')?.addEventListener('click', checkout);
}

init();
