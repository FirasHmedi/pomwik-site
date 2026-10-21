# pomwik.com

Site statique servi par GitHub Pages (racine du dépôt) et Worker Cloudflare `pomwik-waitlist` (`worker/`, api.pomwik.com : formulaires, liste d'attente, boîte de réception des e-mails de test).

**Ce dépôt est public.** Aucune note interne, aucun prix, aucun secret. Les notes de travail sont dans le dépôt privé FirasHmedi/pomwik-memory (`COORDINATION.md` à lire en premier).

## Règles du site
- Textes en français, courts et simples, sans tournures « IA ».
- Ne présenter comme disponible que ce qui est prouvé ; le reste est « inclus dès l'ouverture ».
- Aucun montant affiché. Délai de réponse annoncé : 12 heures, partout (site, `contact.js`, e-mails du Worker).
- Nom de Firas sur la page Contact seulement, pas sur l'accueil.
- Mesure d'audience : extrait Cloudflare Web Analytics (sans cookie) en bas de chaque page, mentionné dans `privacy.html`. Le copier sur toute nouvelle page.

## Worker (`worker/`)
- `npm test` : Vitest dans le runtime Workers, D1 local, aucun réseau. Ajouter les tests dans `worker/test/` avec les helpers de `test/helpers.js`.
- `src/pages.js` est généré : ne jamais l'éditer à la main. Après un changement de `contact/index.html`, `tests/contact-panne/index.html` ou `contact.js` : `npm run build:pages`. `npm run check:pages` doit passer.
- Le CI (`.github/workflows/worker.yml`) lance les deux sur chaque PR et chaque push.
- Déploiement : automatique après chaque push sur `main` une fois les tests verts (job `deploy` du workflow, secret GitHub `CLOUDFLARE_API_TOKEN`, actif depuis le 21/10/2026). Ne pas déployer à la main sauf urgence.
- `main` est protégée : une PR ne peut être fusionnée que si le contrôle `test` est vert.

## Git
- Les PR sont fusionnées par Firas ou par la session locale, seulement avec le contrôle `test` vert (obligatoire sur `main`).
- Messages de commit en français, terminés par la ligne `Co-Authored-By` de la session.

## Sessions cloud : économiser les crédits
- Une tâche = une PR. Dès la PR ouverte, s'arrêter : ne pas surveiller la CI, ne pas attendre, ne pas envoyer de compte rendu à la session locale (elle lit la PR sur GitHub).
- Lancer les tests une seule fois : typecheck et le seul labo touché. Ne pas relancer ce qui est déjà vert.
- Ne cloner que le dépôt de la tâche. Lire seulement les fichiers utiles, pas tout le dépôt.
- Description de PR courte : ce qui change, ce qui est vérifié, ce qui ne l'est pas.
