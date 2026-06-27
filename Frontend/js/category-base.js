/* ============================================================
   GRAFIDE — category-base.js
   Shared logic for Fashion, Lifestyle, Photography, Culture.
   Each page calls: initCategory({ name, dek, navKey })
   ============================================================ */
'use strict';

// ── Card HTML ────────────────────────────────────────────────────
function articleCardHtml(a) {
  const thumb = coverUrl(a);
  return `
    <a class="article-card" href="/pages/article.html?id=${esc(a.id)}">
      <div class="article-card-img-wrap">
        <img src="${esc(thumb)}" alt="${esc(a.title)}" loading="lazy" />
      </div>
      <span class="article-card-category">${esc(a.category)}</span>
      <h3 class="article-card-title">${esc(a.title)}</h3>
      <p class="article-card-dek">${esc(a.dek)}</p>
      <span class="article-card-byline">By ${esc(a.author)}</span>
    </a>`;
}

// ── Featured card HTML (first article — full-width) ──────────────
function featuredCardHtml(a) {
  const thumb = coverUrl(a);
  return `
    <a class="category-featured" href="/pages/article.html?id=${esc(a.id)}">
      <div class="category-featured-img-wrap">
        <img src="${esc(thumb)}" alt="${esc(a.title)}" loading="lazy" />
      </div>
      <div class="category-featured-meta">
        <span class="article-card-category">${esc(a.category)}</span>
        <h2 class="category-featured-title">${esc(a.title)}</h2>
        <p class="category-featured-dek">${esc(a.dek)}</p>
        <span class="category-featured-byline">By ${esc(a.author)} &nbsp;·&nbsp; ${fmt(a.date)}</span>
        <span class="category-featured-cta">Read Article <span>&#8594;</span></span>
      </div>
    </a>`;
}

// ── Render grid ──────────────────────────────────────────────────
function renderGrid(articles, hasMore, firstLoad = true) {
  const loading  = document.getElementById('cat-loading');
  const empty    = document.getElementById('cat-empty');
  const grid     = document.getElementById('cat-grid');
  const moreWrap = document.getElementById('load-more-wrap');

  if (loading) loading.style.display = 'none';

  if (!articles.length && firstLoad) {
    if (empty) empty.style.display = '';
    return;
  }

  if (!grid) return;

  if (firstLoad) {
    const [featured, ...rest] = articles;
    grid.innerHTML = featuredCardHtml(featured) + rest.map(articleCardHtml).join('');
  } else {
    // Append for load-more
    grid.insertAdjacentHTML('beforeend', articles.map(articleCardHtml).join(''));
  }

  if (moreWrap) moreWrap.style.display = hasMore ? '' : 'none';
}

// ── Main init ────────────────────────────────────────────────────
async function initCategory({ name, dek, navKey }) {
  initLayout(navKey);

  // Set page title & meta
  document.title = `${name} — Grafide`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', dek);

  // Populate banner text (set in each page's HTML slots)
  const titleEl = document.getElementById('banner-title');
  const dekEl   = document.getElementById('banner-dek');
  if (titleEl) titleEl.textContent = name;
  if (dekEl)   dekEl.textContent   = dek;

  let currentPage = 0;
  let hasMore     = false;

  // Initial load
  try {
    const r = await Articles.listByCategory(name, 0);
    const articles = r.articles || [];
    hasMore = r.hasMore || false;
    renderGrid(articles, hasMore, true);
  } catch {
    document.getElementById('cat-loading').style.display = 'none';
    document.getElementById('cat-empty').style.display   = '';
  }

  // Load more
  document.getElementById('load-more-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('load-more-btn');
    if (btn) btn.textContent = 'Loading…';
    currentPage++;
    try {
      const r = await Articles.listByCategory(name, currentPage);
      const more = r.articles || [];
      hasMore = r.hasMore || false;
      renderGrid(more, hasMore, false);
    } catch {
      showToast('Failed to load more articles.');
      currentPage--;
    }
    if (btn) btn.textContent = 'Load More';
  });
}
