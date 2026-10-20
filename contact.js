// Formulaires de contact et de demande d'audit : envoi au Worker api.pomwik.com, résultat affiché dans la page.
(() => {
'use strict';
// Dans une fonction : app.js déclare aussi isLocal sur la même page.
const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);

const SUCCESS = {
  audit: 'Merci, votre demande d’audit a bien été envoyée. Nous vous répondons sous 48 heures.',
  contact: 'Merci, votre message a bien été envoyé. Nous vous répondons sous 48 heures.',
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll('input[name], select[name], textarea[name]')];
    const invalid = fields.find((f) => f.name !== 'website' && ((f.required && !f.value.trim()) || !f.checkValidity()));
    if (invalid) {
      say('Merci de remplir les champs obligatoires avec une adresse e-mail valide.', 'error');
      invalid.focus();
      return;
    }
    const data = { type };
    fields.forEach((f) => { data[f.name] = f.value.trim(); });

    button.disabled = true;
    say('Envoi en cours…');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        button.disabled = false;
        say(res.status === 429 ? 'Trop d’envois depuis votre connexion. Réessayez dans une heure.' : 'Votre message n’a pas pu être envoyé. Réessayez dans un instant, ou écrivez à hello@pomwik.com.', 'error');
        return;
      }
      form.classList.add('done');
      say(SUCCESS[type] || SUCCESS.contact, 'ok');
    } catch {
      button.disabled = false;
      say('Votre message n’a pas pu être envoyé. Réessayez dans un instant, ou écrivez à hello@pomwik.com.', 'error');
    }
  });
});
})();
