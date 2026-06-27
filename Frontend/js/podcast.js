/* ============================================================
   GRAFIDE — podcast.js  (Podcast page)
   Views: listing | detail | add (editor only)
   ============================================================ */
'use strict';

// Podcast uses /api/podcasts endpoints
const Podcasts = {
  list:   (page = 0) => Api.get(`/podcasts?page=${page}&size=20`),
  get:    (id)       => Api.get(`/podcasts/${id}`),
  create: (d, tok)   => Api.post('/podcasts', d, tok),
  delete: (id, tok)  => Api.delete(`/podcasts/${id}`, tok),
};

// ── View switcher ────────────────────────────────────────────────
function showView(name) {
  ['listing', 'detail', 'add'].forEach(v => {
    document.getElementById(`view-${v}`).style.display = v === name ? '' : 'none';
  });
}

// ── Embed URL → iframe src ────────────────────────────────────────
function toEmbedSrc(url) {
  if (!url) return null;
  // Spotify episode
  if (url.includes('open.spotify.com/episode/')) {
    const id = url.split('/episode/')[1]?.split('?')[0];
    return `https://open.spotify.com/embed/episode/${id}?utm_source=generator`;
  }
  // YouTube
  if (url.includes('youtube.com/watch')) {
    const v = new URL(url).searchParams.get('v');
    return `https://www.youtube.com/embed/${v}`;
  }
  if (url.includes('youtu.be/')) {
    const v = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${v}`;
  }
  // Apple Podcasts — not embeddable via iframe; return null, show link instead
  return null;
}

// ── Episode card HTML ────────────────────────────────────────────
function episodeCardHtml(ep, index) {
  return `
    <a class="episode-card" href="/pages/podcast.html?id=${esc(ep.id)}">
      <span class="episode-num">${String(index + 1).padStart(2, '0')}</span>
      <div class="episode-meta">
        <p class="episode-title">${esc(ep.title)}</p>
        <p class="episode-dek">${esc(ep.dek)}</p>
      </div>
      <span class="episode-date">${fmt(ep.date)}</span>
    </a>`;
}

// ── Listing view ─────────────────────────────────────────────────
let _currentPage = 0;
let _episodes    = [];

async function loadListing() {
  showView('listing');
  document.title = 'Podcast — Grafide';

  const session = getSession();
  if (isEditor(session)) {
    const wrap = document.getElementById('editor-add-btn');
    if (wrap) wrap.innerHTML = `<a href="/pages/podcast.html?view=add" class="btn sm">+ Add Episode</a>`;
  }

  try {
    const r = await Podcasts.list(0);
    _episodes    = r.episodes || r || [];
    const hasMore = r.hasMore || false;

    document.getElementById('pod-loading').style.display = 'none';

    if (!_episodes.length) {
      document.getElementById('pod-empty').style.display = '';
      return;
    }

    const list = document.getElementById('episode-list');
    list.innerHTML  = _episodes.map((ep, i) => episodeCardHtml(ep, i)).join('');
    list.style.display = '';

    const moreWrap = document.getElementById('load-more-wrap');
    if (moreWrap) moreWrap.style.display = hasMore ? '' : 'none';
  } catch {
    document.getElementById('pod-loading').style.display = 'none';
    document.getElementById('pod-empty').style.display   = '';
  }

  // Load more
  document.getElementById('load-more-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('load-more-btn');
    if (btn) { btn.textContent = 'Loading…'; btn.disabled = true; }
    _currentPage++;
    try {
      const r    = await Podcasts.list(_currentPage);
      const more = r.episodes || r || [];
      _episodes  = [..._episodes, ...more];
      const list = document.getElementById('episode-list');
      list.insertAdjacentHTML('beforeend', more.map((ep, i) =>
        episodeCardHtml(ep, _episodes.length - more.length + i)
      ).join(''));
      const moreWrap = document.getElementById('load-more-wrap');
      if (moreWrap) moreWrap.style.display = (r.hasMore || false) ? '' : 'none';
    } catch { showToast('Failed to load more episodes.'); _currentPage--; }
    if (btn) { btn.textContent = 'Load More'; btn.disabled = false; }
  });
}

// ── Detail view ──────────────────────────────────────────────────
async function loadDetail(id) {
  showView('detail');
  try {
    const ep = await Podcasts.get(id);
    document.title = `${ep.title} — Grafide`;

    document.getElementById('detail-title').textContent  = ep.title;
    document.getElementById('detail-byline').textContent = fmt(ep.date);

    // Embed player
    const embedSrc = toEmbedSrc(ep.embedUrl);
    const embedEl  = document.getElementById('detail-embed');
    if (embedSrc && embedEl) {
      embedEl.innerHTML    = `<iframe src="${esc(embedSrc)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
      embedEl.style.display = '';
    } else if (ep.embedUrl && embedEl) {
      embedEl.innerHTML    = `<p style="padding:16px;font-size:.9rem;">Listen on <a href="${esc(ep.embedUrl)}" target="_blank" rel="noopener" style="color:var(--cobalt)">Apple Podcasts</a></p>`;
      embedEl.style.display = '';
    }

    // Show notes body
    const bodyEl = document.getElementById('detail-body');
    if (bodyEl && ep.body) bodyEl.innerHTML = `<p>${esc(ep.body).replace(/\n/g, '</p><p>')}</p>`;

    // Editor controls
    const session = getSession();
    if (isEditor(session)) {
      document.getElementById('detail-editor-controls').style.display = 'flex';
      document.getElementById('detail-delete-btn')?.addEventListener('click', async () => {
        if (!confirm('Delete this episode?')) return;
        try {
          await Podcasts.delete(ep.id, session.token);
          showToast('Episode deleted.');
          setTimeout(() => { window.location.href = '/pages/podcast.html'; }, 1200);
        } catch (err) { showToast(err.message || 'Delete failed.'); }
      });
    }
  } catch {
    showView('listing');
    showToast('Episode not found.');
  }
}

// ── Add episode view (editor only) ───────────────────────────────
function loadAdd() {
  const session = getSession();
  if (!isEditor(session)) { window.location.href = '/pages/podcast.html'; return; }

  showView('add');
  document.title = 'Add Episode — Grafide';

  document.getElementById('add-submit-btn')?.addEventListener('click', async () => {
    const errorEl = document.getElementById('add-error');
    errorEl.style.display = 'none';

    const title    = document.getElementById('f-ep-title').value.trim();
    const dek      = document.getElementById('f-ep-dek').value.trim();
    const embedUrl = document.getElementById('f-ep-embed').value.trim();
    const body     = document.getElementById('f-ep-body').value.trim();

    if (!title) {
      errorEl.textContent = 'Episode title is required.';
      errorEl.style.display = '';
      return;
    }

    const btn = document.getElementById('add-submit-btn');
    btn.textContent = 'Publishing…';
    btn.disabled    = true;

    try {
      await Podcasts.create({ title, dek, embedUrl, body }, session.token);
      showToast('Episode published!');
      setTimeout(() => { window.location.href = '/pages/podcast.html'; }, 1200);
    } catch (err) {
      errorEl.textContent   = err.message || 'Publish failed. Please try again.';
      errorEl.style.display = '';
      btn.textContent = 'Publish Episode';
      btn.disabled    = false;
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────
function init() {
  initLayout('podcast');
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const view   = params.get('view');

  if (view === 'add') { loadAdd(); }
  else if (id)        { loadDetail(id); }
  else                { loadListing(); }
}

init();
