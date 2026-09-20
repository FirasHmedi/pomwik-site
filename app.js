'use strict';

const WAITLIST_URL = 'https://api.pomwik.com/waitlist';

document.getElementById('year').textContent = new Date().getFullYear();

document.querySelectorAll('form.waitlist').forEach((form) => {
  const input = form.elements.email;
  const button = form.querySelector('button');
  const msg = form.querySelector('.msg');

  const say = (text, kind) => {
    msg.textContent = text;
    msg.dataset.kind = kind || '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!input.checkValidity() || !email) {
      say('Please enter a valid email address.', 'error');
      input.focus();
      return;
    }

    button.disabled = true;
    say('Joining…');
    try {
      const res = await fetch(WAITLIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          app: form.dataset.app,
          website: form.elements.website.value,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.classList.add('done');
      input.value = '';
      say("You're on the list. Thank you!", 'ok');
    } catch (err) {
      button.disabled = false;
      say("Couldn't sign you up just now. Please try again in a moment.", 'error');
    }
  });
});

// Fade sections in as they scroll into view.
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}
