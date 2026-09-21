'use strict';

const DEFAULT_API = 'https://api.pomwik.com/waitlist';
const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);
// On localhost only, ?api=http://127.0.0.1:8787/waitlist lets you test against a local Worker.
const WAITLIST_URL = (isLocal && new URLSearchParams(location.search).get('api')) || DEFAULT_API;

const ERRORS = {
  invalid_email: "That email address doesn't look right. Please check it.",
  invalid_domain: "We couldn't find that email domain. Please check the spelling.",
};

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

document.querySelectorAll('form.waitlist').forEach((form) => {
  const input = form.elements.email;
  const button = form.querySelector('button');
  const msg = form.querySelector('.msg');

  const say = (text, kind) => {
    msg.textContent = text;
    msg.dataset.kind = kind || '';
  };
  const field = (name) => (form.elements[name] ? form.elements[name].value : '');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email || !input.checkValidity()) {
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
          a1: field('a1'),
          a2: field('a2'),
          website: field('website'),
        }),
      });
      if (!res.ok) {
        let code = '';
        try { code = (await res.json()).error; } catch {}
        button.disabled = false;
        say(ERRORS[code] || "Couldn't sign you up just now. Please try again in a moment.", 'error');
        return;
      }
      form.classList.add('done');
      say("You're on the list! Check your inbox for a welcome email.", 'ok');
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
