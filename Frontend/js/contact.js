/* ============================================================
   GRAFIDE — contact.js  (Contact page)
   ============================================================ */
'use strict';

document.getElementById('contact-submit-btn')?.addEventListener('click', async () => {
  const errorEl   = document.getElementById('contact-error');
  const successEl = document.getElementById('contact-success');
  errorEl.style.display   = 'none';
  successEl.style.display = 'none';

  const name    = document.getElementById('f-name').value.trim();
  const email   = document.getElementById('f-email').value.trim();
  const subject = document.getElementById('f-subject').value;
  const message = document.getElementById('f-message').value.trim();

  if (!name || !email || !subject || !message) {
    errorEl.textContent   = 'Please fill in all fields.';
    errorEl.style.display = '';
    return;
  }
  if (!email.includes('@')) {
    errorEl.textContent   = 'Please enter a valid email address.';
    errorEl.style.display = '';
    return;
  }

  const btn = document.getElementById('contact-submit-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;

  try {
    await Contact.send({ name, email, subject, message });
    successEl.style.display = '';
    document.getElementById('f-name').value    = '';
    document.getElementById('f-email').value   = '';
    document.getElementById('f-subject').value = '';
    document.getElementById('f-message').value = '';
  } catch (err) {
    errorEl.textContent   = err.message || 'Something went wrong. Please try again.';
    errorEl.style.display = '';
  }

  btn.textContent = 'Send Message'; btn.disabled = false;
});
