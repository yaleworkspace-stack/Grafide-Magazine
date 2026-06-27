/* ============================================================
   GRAFIDE — app.js  (Homepage)
   ============================================================ */
'use strict';

const BRAND_WORDS_HOME = ['Fashion', 'Style', 'Culture', 'Photography', 'Lifestyle'];

let _articles    = [];
let _hasMore     = false;
let _currentPage = 0;

// ── Article card HTML ───────────────────────────────────────────
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

// ── Hero HTML ───────────────────────────────────────────────────
function heroHtml(a) {
  const img = coverUrl(a);
  return `
    <a class="hero" href="/pages/article.html?id=${esc(a.id)}" aria-label="Read: ${esc(a.title)}">
      <img class="hero-img" src="${esc(img)}" alt="${esc(a.title)}" />
      <div class="hero-overlay">
        <div class="hero-eyebrow">
          <span class="diamond"></span>
          ${esc(a.category)}${a.pinned ? '&nbsp;&nbsp;Cover Story' : ''}
        </div>
        <h1 class="hero-title">${esc(a.title)}</h1>
        <p class="hero-dek">${esc(a.dek)}</p>
        <span class="hero-cta">Read Article <span>&#8594;</span></span>
      </div>
    </a>`;
}

// ── Tagline strip ───────────────────────────────────────────────
function renderTagline() {
  const el = document.getElementById('tagline-strip');
  if (!el) return;
  el.innerHTML = BRAND_WORDS_HOME.map((w, i) =>
    i < BRAND_WORDS_HOME.length - 1
      ? `<span>${w}</span><span class="diamond diamond-sm"></span>`
      : `<span>${w}</span>`
  ).join('');
}

// ── Render articles ─────────────────────────────────────────────
function renderArticles() {
  const loading  = document.getElementById('home-loading');
  const empty    = document.getElementById('home-empty');
  const heroSlot = document.getElementById('hero-slot');
  const section  = document.getElementById('latest-section');
  const grid     = document.getElementById('articles-grid');
  const moreWrap = document.getElementById('load-more-wrap');

  loading?.style && (loading.style.display = 'none');

  if (!_articles.length) {
    empty && (empty.style.display = 'block');
    return;
  }

  const [hero, ...rest] = _articles;

  // Hero
  if (heroSlot) heroSlot.innerHTML = heroHtml(hero);

  // Grid (rest of articles)
  if (rest.length && grid && section) {
    section.style.display = '';
    grid.innerHTML = rest.map(articleCardHtml).join('');
  }

  // Load more
  if (moreWrap) moreWrap.style.display = _hasMore ? '' : 'none';
}

// ── Append more articles ────────────────────────────────────────
function appendArticles(newArticles) {
  const grid = document.getElementById('articles-grid');
  if (!grid) return;
  grid.insertAdjacentHTML('beforeend', newArticles.map(articleCardHtml).join(''));
}

// ── Load ────────────────────────────────────────────────────────
async function loadPage(page = 0) {
  try {
    const r = await Articles.list(page);
    return { articles: r.articles || [], hasMore: r.hasMore || false };
  } catch {
    return { articles: [], hasMore: false };
  }
}

// ── Init ────────────────────────────────────────────────────────
async function init() {
  initLayout('home');
  renderTagline();

  const { articles, hasMore } = await loadPage(0);
  _articles    = articles;
  _hasMore     = hasMore;
  _currentPage = 0;

  renderArticles();

  // Load more button
  document.getElementById('load-more-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('load-more-btn');
    if (btn) btn.textContent = 'Loading…';
    const next = _currentPage + 1;
    const { articles: more, hasMore: moreFlag } = await loadPage(next);
    _articles = [..._articles, ...more];
    _currentPage = next;
    _hasMore     = moreFlag;
    appendArticles(more);
    const moreWrap = document.getElementById('load-more-wrap');
    if (moreWrap) moreWrap.style.display = _hasMore ? '' : 'none';
    if (btn) btn.textContent = 'Load More';
  });
}

init();
