/* ============================================================
   GRAFIDE — orders.js  (Customer order history)
   ============================================================ */
'use strict';

const ORDER_STATUS_CLASS = {
  PENDING:    'status-pending',
  PAID:       'status-published',
  PROCESSING: 'status-pending',
  SHIPPED:    'status-pending',
  DELIVERED:  'status-published',
  CANCELLED:  'status-returned',
};

function orderCardHtml(o) {
  return `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <p class="order-card-id">Order #${esc(o.id.slice(-8).toUpperCase())}</p>
          <p class="order-card-date">${fmt(o.createdAt)}</p>
        </div>
        <span class="status-badge ${ORDER_STATUS_CLASS[o.status] || 'status-pending'}">
          ${esc(o.status)}
        </span>
      </div>

      <div class="order-card-items">
        ${o.items.map(i => `
          <div class="order-item-row">
            <img class="order-item-img"
                 src="${esc(i.imageUrl || '/images/logo.png')}"
                 alt="${esc(i.productTitle)}" />
            <div>
              <p class="order-item-title">${esc(i.productTitle)}</p>
              <p class="order-item-meta">
                ${esc(i.brandName)} &nbsp;·&nbsp;
                Qty: ${i.quantity} &nbsp;·&nbsp;
                ₦${Number(i.unitPrice).toLocaleString()} each
              </p>
            </div>
          </div>`).join('')}
      </div>

      <div class="order-card-total">
        <span>
          Shipping to ${esc(o.shippingCity)}, ${esc(o.shippingState)}
        </span>
        <span>Total: <strong>₦${Number(o.total).toLocaleString()}</strong></span>
      </div>
    </div>`;
}

async function init() {
  // Guard — must be signed in
  const session = getSession();
  if (!session) { window.location.href = '/pages/auth.html'; return; }

  initLayout();

  // Show payment success banner if redirected from Paystack
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    const banner = document.createElement('div');
    banner.className = 'payment-success-banner';
    banner.innerHTML = '&#10003; Payment successful! Your order has been placed and is being processed.';
    document.querySelector('.orders-page')?.prepend(banner);
  }

  try {
    const orders = await Api.get('/orders/mine', session.token);
    document.getElementById('orders-loading').style.display = 'none';

    if (!orders.length) {
      document.getElementById('orders-empty').style.display = '';
      return;
    }

    document.getElementById('orders-list').innerHTML = orders.map(orderCardHtml).join('');
  } catch {
    document.getElementById('orders-loading').style.display = 'none';
    document.getElementById('orders-empty').style.display   = '';
  }
}

init();
