/* ============================================================
   GRAFIDE — about.js  (About page + portfolio showcase)
   ============================================================ */
'use strict';

const Portfolio = {
  list:     (cat) => Api.get(`/portfolio${cat ? '?category='+encodeURIComponent(cat) : ''}`),
  featured: ()    => Api.get('/portfolio/featured'),
};

function portfolioItemHtml(item, index) {
  const cover = item.coverUrl || (item.imageUrls?.[0]) || '/images/logo.png';
  const isFeatured = item.featured && index === 0;
  return `
    <div class="portfolio-item${isFeatured ? ' featured' : ''}"
         data-id="${esc(item.id)}" role="button" tabindex="0"
         aria-label="${esc(item.title)}">
      <img src="${esc(cover)}" alt="${esc(item.title)}" loading="lazy" />
      <div class="portfolio-item-overlay">
        <p class="portfolio-item-cat">${esc(item.category)}</p>
        <p class="portfolio-item-title">${esc(item.title)}</p>
        ${item.client ? `<p class="portfolio-item-client">${esc(item.client)}</p>` : ''}
      </div>
    </div>`;
}

async function loadPortfolio(category = '') {
  const loading = document.getElementById('portfolio-loading');
  const empty   = document.getElementById('portfolio-empty');
  const grid    = document.getElementById('portfolio-grid');
  if (loading) loading.style.display = '';
  if (empty)   empty.style.display   = 'none';
  if (grid)    grid.style.display    = 'none';

  try {
    const items = await Portfolio.list(category);
    if (loading) loading.style.display = 'none';

    if (!items.length) {
      if (empty) empty.style.display = '';
      return;
    }

    if (grid) {
      grid.innerHTML    = items.map((item, i) => portfolioItemHtml(item, i)).join('');
      grid.style.display = '';
    }
  } catch {
    if (loading) loading.style.display = 'none';
    if (empty)   empty.style.display   = '';
  }
}

function init() {
  initLayout('about');

  // Portfolio filters
  document.querySelectorAll('.portfolio-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.portfolio-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadPortfolio(btn.dataset.cat);
    });
  });

  loadPortfolio();
}

init();
