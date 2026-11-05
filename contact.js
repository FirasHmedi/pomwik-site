// Formulaires de contact et de demande d'essai gratuit : envoi au Worker api.pomwik.com, résultat affiché dans la page.
(() => {
'use strict';
// Dans une fonction : app.js déclare aussi isLocal sur la même page.
const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

const SUCCESS = {
  audit: 'Merci, votre demande d’essai gratuit a bien été envoyée. On vous répond sous 12 heures.',
  contact: 'Merci, votre message a bien été envoyé. Je vous réponds sous 12 heures.',
};

// Pages en anglais (<html lang="en">) : mêmes messages, traduits.
const EN = document.documentElement.lang === 'en';
const T = EN
  ? {
      success: 'Thanks, your message has been sent. We reply within 12 hours.',
      missing: (label) => `Missing: ${label}.`,
      email: 'This email address looks incomplete (example: name@company.com).',
      sending: 'Sending…',
      rate: 'Too many messages from your connection. Please try again in an hour.',
      required: 'A required field is missing.',
      failed: 'Your message could not be sent. Try again in a moment, or write to hello@pomwik.com.',
    }
  : {
      missing: (label) => `Il manque : ${label}.`,
      email: 'Cette adresse e-mail semble incomplète (exemple : nom@entreprise.fr).',
      sending: 'Envoi en cours…',
      rate: 'Trop d’envois depuis votre connexion. Réessayez dans une heure.',
      required: 'Il manque un champ obligatoire.',
      failed: 'Votre message n’a pas pu être envoyé. Réessayez dans un instant, ou écrivez à hello@pomwik.com.',
    };

document.querySelectorAll('form.contact-form').forEach((form) => {
  const button = form.querySelector('button');
  const msg = form.querySelector('.msg');
  const type = form.dataset.type || 'contact';
  // En local uniquement, ?api=http://127.0.0.1:8787 pointe vers un Worker local.
  const base = isLocal && new URLSearchParams(location.search).get('api');
  const endpoint = base ? base + new URL(form.dataset.endpoint).pathname : form.dataset.endpoint;
  const say = (text, kind) => {
    msg.textContent = text;
    msg.dataset.kind = kind || '';
  };

  // Nom du champ tel qu'affiché, sans la mention « (facultatif) ».
  const labelOf = (f) => {
    const l = form.querySelector(`label[for="${f.id}"]`);
    return l ? l.childNodes[0].textContent.trim() : f.name;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll('input[name], select[name], textarea[name]')];
    fields.forEach((f) => { if (f.name !== 'website') f.value = f.value.trim(); });
    const empty = fields.find((f) => f.name !== 'website' && f.required && !f.value);
    if (empty) {
      say(T.missing(labelOf(empty)), 'error');
      empty.focus();
      return;
    }
    // Même règle que le Worker : quelque chose@domaine.extension, tout le reste est accepté.
    const email = form.querySelector('[name="email"]');
    if (email && !EMAIL_RE.test(email.value)) {
      say(T.email, 'error');
      email.focus();
      return;
    }
    const data = { type };
    fields.forEach((f) => { data[f.name] = f.value.trim(); });

    button.disabled = true;
    say(T.sending);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        button.disabled = false;
        const code = await res.json().then((j) => j.error).catch(() => '');
        if (res.status === 429) say(T.rate, 'error');
        else if (code === 'invalid_email') say(T.email, 'error');
        else if (code === 'missing_field') say(T.required, 'error');
        else say(T.failed, 'error');
        return;
      }
      form.classList.add('done');
      say(T.success || SUCCESS[type] || SUCCESS.contact, 'ok');
    } catch {
      button.disabled = false;
      say(T.failed, 'error');
    }
  });
});
})();
