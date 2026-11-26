# pomwik.com

Site statique servi par GitHub Pages (racine du dépôt) et Worker Cloudflare `pomwik-waitlist` (`worker/`, api.pomwik.com : formulaires, liste d'attente, boîte de réception des e-mails de test, route `/notify` des e-mails de la surveillance vers les agences, destinataires limités par le secret `NOTIFY_ALLOW`).

**Ce dépôt est public.** Aucune note interne, aucun secret, aucun prix en dehors de la grille publique (`/tarifs/` et bloc prix de l'accueil). Les notes de travail sont dans le dépôt privé FirasHmedi/pomwik-memory (`COORDINATION.md` à lire en premier).

## Règles du site
- Offre (brief du 26/11/2026) : reprise d'apps mobiles inachevées (Lovable, Bolt, Rork, abandonnées par une agence…), sécurisation, publication sur l'App Store et Google Play sous les comptes du client, maintenance. La société n'est pas immatriculée : aucun paiement en ligne, aucun compte client, seulement des demandes de devis.
- Pages : accueil (`index.html`), `/tarifs/`, `/contact/` (pré-diagnostic), et leurs versions anglaises statiques `/en/`, `/en/pricing/`, `/en/contact/` ; mentions légales, confidentialité, 404, et les pages d'apps en attente (petty, settled, `noindex` depuis le 26/11/2026, hors du sitemap). `/realm/` et `/audit/` sont retirées : pages courtes `noindex` qui renvoient vers l'accueil (`meta refresh`). `/fieldwrite/` est supprimée (404) et l'API de liste d'attente refuse `fieldwrite` depuis le 26/11/2026. Ne plus parler de Realm, d'afterdb ni d'audit de sites.
- Design (refonte du 26/11/2026) : `accueil.css` pour l'accueil, `/tarifs/`, `/contact/`, les mentions légales, la confidentialité et la 404 ; seules les pages d'apps en attente gardent `style.css`. Fond papier, encre, un seul vert « accepté » ; titres en Source Serif 4, texte en IBM Plex Sans, étiquettes en IBM Plex Mono, polices hébergées dans `/fonts/` (licence OFL, aucun appel à Google Fonts). Pas de dégradé décoratif, pas d'icône emoji, pas de grille de cartes identiques : listes à filets, chiffres en serif. L'en-tête et le pied de page sont identiques sur toutes ces pages.
- Apostrophes typographiques (’) dans le texte visible, droites (') dans le code.
- Accueil, tarifs et contact : une page par langue (vraies pages pour Google, liens `hreflang` croisés, `x-default` = français). Toute modification de texte se fait dans les deux pages (`index.html` ↔ `en/index.html`, `tarifs/` ↔ `en/pricing/`, `contact/` ↔ `en/contact/`). `lang.js` + `<html data-alt="…">` envoie le visiteur vers la page de sa langue (`?lang=`, puis choix mémorisé `pomwik-lang`, puis navigateur ; jamais les robots) ; le bouton FR/EN est un lien vers l'autre page.
- Les autres pages sont bilingues dans la même page : `lang.js` dans `<head>`, `<html data-show="…">`, les deux textes dans la page avec `data-lang="fr"` / `data-lang="en"` (le CSS cache l'autre langue), bouton `data-lang-switch`. Pages d'apps en attente : anglais par défaut (`data-default="en"`). `privacy.html` / `privacy-en.html` : deux pages, redirection par `data-alt`. Textes sans balise (option de liste, placeholder) : attribut `data-fr` / `data-en` et `data-ph-fr` / `data-ph-en` pour la langue qui n'est pas celle de la page. Toute nouvelle page : mêmes règles, les deux langues, même contenu.
- Prix affichés seulement sur `/tarifs/` et dans le bloc prix de l'accueil (échéancier d'exemple + trois prix), en € HT (« Prix HT », pas de mention de TVA définitive tant que le régime n'est pas choisi). Grille à prix unique validée par Firas le 26/11/2026 (pas de prix de lancement). Changer un prix : `/tarifs/`, `/en/pricing/`, `index.html` et `en/index.html` (y compris l'échéancier 50/25/25).
- Mentions légales : éditeur Firas Hmedi sous le nom commercial Pomwik. Ne jamais écrire « SASU » ni « en cours de création » sans SIREN ; forme juridique, capital, SIREN, RCS et TVA sont en commentaire `TODO` dans `mentions-legales.html`, à remplir avec le Kbis.
- Pas de comparaison non prouvée avec la concurrence (« les prix les plus bas… »).
- Ne jamais écrire « acceptation garantie » : écrire « solde payé à l'acceptation ».
- Pas de logo client, de chiffre ni de témoignage inventés. L'illustration du téléphone sur l'accueil est marquée « Illustration ».
- Textes en français, courts et simples, pour des clients non techniques, sans tournures « IA ». Lisible à 360 px de large.
- Ne présenter comme disponible que ce qui est prouvé.
- Mentions légales : l'adresse et le téléphone de Firas restent affichés (choix de Firas, 26/11/2026).
- Délai de réponse annoncé : 12 heures, partout (site, `contact.js`, e-mails du Worker).
- Nom de Firas sur la page Contact seulement, pas sur l'accueil.
- Formulaire de contact : champs facultatifs `outil`, `lien`, `blocage` (listes fixes dans `worker/src/index.js`, à garder alignées avec `contact/index.html`), décrits dans `privacy.html` et `privacy-en.html`. Le formulaire existe en français (`contact/`) et en anglais (`en/contact/`) : garder les deux identiques.
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
