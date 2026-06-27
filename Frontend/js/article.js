/* ============================================================
   GRAFIDE — article.js  (Article detail page)
   ============================================================ */
'use strict';

// ── Helpers ─────────────────────────────────────────────────────
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

// ── Update page meta tags ────────────────────────────────────────
function updateMeta(a) {
  const img = coverUrl(a);
  document.title = `${a.title} — Grafide`;
  const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); };
  set('meta[name="description"]',          a.dek || '');
  set('meta[property="og:title"]',         `${a.title} — Grafide`);
  set('meta[property="og:description"]',   a.dek || '');
  set('meta[property="og:image"]',         img);
  set('meta[name="twitter:title"]',        `${a.title} — Grafide`);
  set('meta[name="twitter:description"]',  a.dek || '');
  set('meta[name="twitter:image"]',        img);
}

// ── Cover / slideshow ────────────────────────────────────────────
function renderCover(imageUrls, title) {
  const slot   = document.getElementById('cover-slot');
  if (!slot) return;
  const images = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean);

  if (!images.length) {
    slot.innerHTML = `<div class="article-cover-fallback">No cover image.</div>`;
    return;
  }

  if (images.length === 1) {
    slot.innerHTML = `
      <div class="article-cover-wrap">
        <img src="${esc(images[0])}" alt="${esc(title)}" />
      </div>`;
    return;
  }

  // Slideshow
  slot.innerHTML = `
    <div class="detail-slideshow">
      <div class="slideshow-frame">
        <img id="slideshow-main" src="${esc(images[0])}" alt="${esc(title)}" />
        <button class="slideshow-control prev" aria-label="Previous">&#10094;</button>
        <button class="slideshow-control next" aria-label="Next">&#10095;</button>
      </div>
      <div class="slideshow-thumbs">
        ${images.map((src, i) => `
          <button class="slideshow-thumb${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Image ${i + 1}">
            <img src="${esc(src)}" alt="${esc(title)} cover ${i + 1}" />
          </button>`).join('')}
      </div>
    </div>`;

  let current = 0;
  const mainImg   = slot.querySelector('#slideshow-main');
  const thumbBtns = Array.from(slot.querySelectorAll('.slideshow-thumb'));

  function goTo(idx) {
    current = (idx + images.length) % images.length;
    mainImg.src = images[current];
    thumbBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.index) === current));
  }

  slot.querySelector('.slideshow-control.prev')?.addEventListener('click', () => goTo(current - 1));
  slot.querySelector('.slideshow-control.next')?.addEventListener('click', () => goTo(current + 1));
  thumbBtns.forEach(b => b.addEventListener('click', () => goTo(Number(b.dataset.index))));
}

// ── Render article ───────────────────────────────────────────────
function renderArticle(a) {
  updateMeta(a);

  renderCover(a.coverImageUrls, a.title);

  document.getElementById('article-category').textContent = a.category || '';
  document.getElementById('article-title').textContent    = a.title    || '';
  document.getElementById('article-dek').textContent      = a.dek      || '';
  document.getElementById('article-byline').textContent   =
    `By ${a.author || 'Grafide'}  ·  ${fmt(a.date)}`;

  // Body: prefer richBody (Quill HTML), fall back to plain paragraphs
  const bodyEl  = document.getElementById('article-body');
  const bodyHtml = (a.richBody && a.richBody.trim())
    ? a.richBody
    : (Array.isArray(a.body)
        ? a.body.map(p => `<p>${esc(p)}</p>`).join('')
        : `<p>${esc(a.body ?? '')}</p>`);
  if (bodyEl) bodyEl.innerHTML = bodyHtml;

  // Show article, hide loader
  document.getElementById('article-loading').style.display = 'none';
  document.getElementById('article-page').style.display    = '';
}

// ── Editor controls ──────────────────────────────────────────────
function setupEditorControls(a) {
  const session = getSession();
  if (!isEditor(session)) return;

  const controlsEl = document.getElementById('editor-controls');
  if (controlsEl) controlsEl.style.display = 'flex';

  // Edit — go to editor page
  const editBtn = document.getElementById('edit-btn');
  if (editBtn) editBtn.href = `/pages/editor.html?action=edit&id=${esc(a.id)}`;

  // Delete
  document.getElementById('delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Permanently delete this article? This cannot be undone.')) return;
    try {
      await Articles.delete(a.id, session.token);
      showToast('Article deleted.');
      setTimeout(() => { window.location.href = '/index.html'; }, 1200);
    } catch (err) {
      showToast(err.message || 'Delete failed.');
    }
  });
}

// ── Related articles ─────────────────────────────────────────────
async function loadRelated(category, excludeId) {
  try {
    const r = await Articles.listByCategory(category, 0);
    const others = (r.articles || []).filter(a => a.id !== excludeId).slice(0, 3);
    if (!others.length) return;
    const section = document.getElementById('related-section');
    const grid    = document.getElementById('related-grid');
    if (grid)    grid.innerHTML = others.map(articleCardHtml).join('');
    if (section) section.style.display = '';
  } catch { /* silently skip */ }
}

// ── Init ─────────────────────────────────────────────────────────
async function init() {
  initLayout(); // no active nav item — article is reached from any section

  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) {
    document.getElementById('article-loading').style.display = 'none';
    document.getElementById('article-error').style.display   = '';
    return;
  }

  try {
    const article = await Articles.get(id);
    renderArticle(article);
    setupEditorControls(article);
    await loadRelated(article.category, article.id);
  } catch {
    document.getElementById('article-loading').style.display = 'none';
    document.getElementById('article-error').style.display   = '';
  }
}

init();
