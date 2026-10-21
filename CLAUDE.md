# pomwik.com

Site statique servi par GitHub Pages (racine du dépôt) et Worker Cloudflare `pomwik-waitlist` (`worker/`, api.pomwik.com : formulaires, liste d'attente, boîte de réception des e-mails de test).

**Ce dépôt est public.** Aucune note interne, aucun prix, aucun secret. Les notes de travail sont dans le dépôt privé FirasHmedi/pomwik-memory (`COORDINATION.md` à lire en premier).

## Règles du site
- Textes en français, courts et simples, sans tournures « IA ».
- Ne présenter comme disponible que ce qui est prouvé ; le reste est « inclus dès l'ouverture ».
- Aucun montant affiché. Délai de réponse annoncé : 12 heures, partout (site, `contact.js`, e-mails du Worker).
- Nom de Firas sur la page Contact seulement, pas sur l'accueil.

## Worker (`worker/`)
- `npm test` : Vitest dans le runtime Workers, D1 local, aucun réseau. Ajouter les tests dans `worker/test/` avec les helpers de `test/helpers.js`.
- `src/pages.js` est généré : ne jamais l'éditer à la main. Après un changement de `contact/index.html`, `tests/contact-panne/index.html` ou `contact.js` : `npm run build:pages`. `npm run check:pages` doit passer.
- Le CI (`.github/workflows/worker.yml`) lance les deux sur chaque PR et chaque push.
- Déploiement : `npx wrangler deploy` depuis `worker/` (session locale connectée à Cloudflare).

## Git
- Les PR sont fusionnées par Firas, sauf demande explicite.
- Messages de commit en français, terminés par la ligne `Co-Authored-By` de la session.
