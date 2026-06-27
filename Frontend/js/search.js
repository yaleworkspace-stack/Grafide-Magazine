/* ============================================================
   GRAFIDE — search.js  (Search results page)
   ============================================================ */
'use strict';

// ── Highlight matched query terms in text ────────────────────────
function highlight(text, query) {
  if (!query || !text) return esc(text);
  const words  = query.trim().split(/\s+/).filter(Boolean);
  const pattern = new RegExp(`(${words.map(w =>
    w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return esc(text).replace(pattern, '<mark>$1</mark>');
}

// ── Article card with highlights ────────────────────────────────
function resultCardHtml(a, query) {
  const thumb = coverUrl(a);
  return `
    <a class="article-card" href="/pages/article.html?id=${esc(a.id)}">
      <div class="article-card-img-wrap">
        <img src="${esc(thumb)}" alt="${esc(a.title)}" loading="lazy" />
      </div>
      <span class="article-card-category">${esc(a.category)}</span>
      <h3 class="article-card-title">${highlight(a.title, query)}</h3>
      <p class="article-card-dek">${highlight(a.dek, query)}</p>
      <span class="article-card-byline">By ${highlight(a.author, query)}</span>
    </a>`;
}

// ── Render results ───────────────────────────────────────────────
function renderResults(articles, query) {
  const loading = document.getElementById('search-loading');
  const grid    = document.getElementById('search-grid');
  const meta    = document.getElementById('search-meta');
  const empty   = document.getElementById('search-empty');
  const prompt  = document.getElementById('search-prompt');
  const emptyQ  = document.getElementById('empty-query');

  loading.style.display = 'none';
  prompt.style.display  = 'none';

  if (!articles.length) {
    empty.style.display  = '';
    if (emptyQ) emptyQ.textContent = `"${query}"`;
    return;
  }

  const count = articles.length;
  meta.innerHTML = `Found <strong>${count}</strong> result${count !== 1 ? 's' : ''} for <strong>"${esc(query)}"</strong>`;
  meta.style.display = '';

  grid.innerHTML = articles.map(a => resultCardHtml(a, query)).join('');
}

// ── Run search ───────────────────────────────────────────────────
async function runSearch(query) {
  if (!query || !query.trim()) return;

  // Update URL without reload so it's shareable
  const url = new URL(window.location.href);
  url.searchParams.set('q', query);
  window.history.replaceState({}, '', url.toString());

  // Update page title and search input
  document.title = `"${query}" — Grafide`;
  const input = document.getElementById('search-input');
  if (input) input.value = query;

  // Show loading
  document.getElementById('search-loading').style.display = '';
  document.getElementById('search-grid').innerHTML        = '';
  document.getElementById('search-meta').style.display    = 'none';
  document.getElementById('search-empty').style.display   = 'none';
  document.getElementById('search-prompt').style.display  = 'none';

  try {
    const results = await Articles.search(query);
    renderResults(results, query);
  } catch {
    document.getElementById('search-loading').style.display = 'none';
    document.getElementById('search-empty').style.display   = '';
    const emptyQ = document.getElementById('empty-query');
    if (emptyQ) emptyQ.textContent = `"${query}"`;
  }
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  initLayout();

  // Search form submit
  document.getElementById('search-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const q = document.getElementById('search-input')?.value.trim();
    if (q) runSearch(q);
  });

  // Auto-run if ?q= is in URL
  const params = new URLSearchParams(window.location.search);
  const q      = params.get('q');
  if (q) {
    runSearch(q);
  } else {
    // Show initial prompt
    document.getElementById('search-prompt').style.display = '';
  }
}

init();
