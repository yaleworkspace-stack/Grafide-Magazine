/* ============================================================
   GRAFIDE — brand-apply.js  (Brand partnership application)
   ============================================================ */
'use strict';

const BrandApi = {
  apply: (d) => Api.post('/brands/apply', d),
};

document.getElementById('apply-submit-btn')?.addEventListener('click', async () => {
  const errorEl   = document.getElementById('apply-error');
  const successEl = document.getElementById('apply-success');
  errorEl.style.display   = 'none';
  successEl.style.display = 'none';

  const name        = document.getElementById('f-brand-name').value.trim();
  const contactName = document.getElementById('f-contact-name').value.trim();
  const email       = document.getElementById('f-brand-email').value.trim();
  const website     = document.getElementById('f-website').value.trim();
  const instagram   = document.getElementById('f-instagram').value.trim();
  const description = document.getElementById('f-description').value.trim();

  if (!name || !contactName || !email) {
    errorEl.textContent   = 'Brand name, contact person, and email are required.';
    errorEl.style.display = '';
    return;
  }
  if (!email.includes('@')) {
    errorEl.textContent   = 'Please enter a valid email address.';
    errorEl.style.display = '';
    return;
  }

  const btn = document.getElementById('apply-submit-btn');
  btn.textContent = 'Submitting…'; btn.disabled = true;

  try {
    await BrandApi.apply({ name, contactName, email, website, instagram, description });
    successEl.style.display = '';
    // Clear form
    ['f-brand-name','f-contact-name','f-brand-email','f-website','f-instagram','f-description']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (err) {
    errorEl.textContent   = err.message || 'Submission failed. Please try again.';
    errorEl.style.display = '';
  }

  btn.textContent = 'Submit Application'; btn.disabled = false;
});

// Init layout (no active nav key — standalone page)
initLayout();
