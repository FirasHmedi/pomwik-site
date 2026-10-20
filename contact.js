// Formulaires de contact et de demande d'audit : envoi au Worker api.pomwik.com, résultat affiché dans la page.
(() => {
'use strict';
// Dans une fonction : app.js déclare aussi isLocal sur la même page.
const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

const SUCCESS = {
  audit: 'Merci, votre demande d’essai gratuit a bien été envoyée. On vous répond sous 48 heures.',
  contact: 'Merci, votre message a bien été envoyé. Je vous réponds sous 48 heures.',
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
      say(`Il manque : ${labelOf(empty)}.`, 'error');
      empty.focus();
      return;
    }
    // Même règle que le Worker : quelque chose@domaine.extension, tout le reste est accepté.
    const email = form.querySelector('[name="email"]');
    if (email && !EMAIL_RE.test(email.value)) {
      say('Cette adresse e-mail semble incomplète (exemple : nom@entreprise.fr).', 'error');
      email.focus();
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
        const code = await res.json().then((j) => j.error).catch(() => '');
        if (res.status === 429) say('Trop d’envois depuis votre connexion. Réessayez dans une heure.', 'error');
        else if (code === 'invalid_email') say('Cette adresse e-mail semble incomplète (exemple : nom@entreprise.fr).', 'error');
        else if (code === 'missing_field') say('Il manque un champ obligatoire.', 'error');
        else say('Votre message n’a pas pu être envoyé. Réessayez dans un instant, ou écrivez à hello@pomwik.com.', 'error');
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
