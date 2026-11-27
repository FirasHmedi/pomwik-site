# pomwik.com

Site statique servi par GitHub Pages (racine du dépôt) et Worker Cloudflare `pomwik-waitlist` (`worker/`, api.pomwik.com : formulaires, liste d'attente, boîte de réception des e-mails de test, route `/notify` des e-mails de la surveillance vers les agences, destinataires limités par le secret `NOTIFY_ALLOW`).

**Ce dépôt est public.** Aucune note interne, aucun secret, aucun prix en dehors de la grille publique (`/tarifs/` et bloc prix de l'accueil). Les notes de travail sont dans le dépôt privé FirasHmedi/pomwik-memory (`COORDINATION.md` à lire en premier).

## Règles du site
- Offre (brief du 26/11/2026) : reprise d'apps mobiles inachevées (Lovable, Bolt, Rork, abandonnées par une agence…), sécurisation, publication sur l'App Store et Google Play sous les comptes du client, maintenance. La société n'est pas immatriculée : aucun paiement en ligne, aucun compte client, seulement des demandes de devis.
- Pages : accueil (`index.html`), `/tarifs/`, `/contact/` (pré-diagnostic), et leurs versions anglaises statiques `/en/`, `/en/pricing/`, `/en/contact/` ; mentions légales, confidentialité, 404, `/realm/`, `/audit/`, `/fieldwrite/`, `/petty/` et `/settled/` (26/11/2026) sont retirées : pages courtes `noindex` qui renvoient vers l'accueil (`meta refresh`). Ne plus parler de Realm, d'afterdb ni d'audit de sites.
- Design (refonte du 26/11/2026) : `accueil.css` pour l'accueil, `/tarifs/`, `/contact/`, les mentions légales, la confidentialité et la 404  ; `style.css` ne sert plus qu'à `tests/contact-panne/`. Fond papier, encre, un seul vert « accepté » ; titres en Source Serif 4, texte en IBM Plex Sans, étiquettes en IBM Plex Mono, polices hébergées dans `/fonts/` (licence OFL, aucun appel à Google Fonts). Pas de dégradé décoratif, pas d'icône emoji, pas de grille de cartes identiques : listes à filets, chiffres en serif. L'en-tête et le pied de page sont identiques sur toutes ces pages.
- Apostrophes typographiques (’) dans le texte visible, droites (') dans le code.
- Accueil, tarifs et contact : une page par langue (vraies pages pour Google, liens `hreflang` croisés, `x-default` = français). Toute modification de texte se fait dans les deux pages (`index.html` ↔ `en/index.html`, `tarifs/` ↔ `en/pricing/`, `contact/` ↔ `en/contact/`). Pas de redirection automatique selon la langue (Google la déconseille) : `lang.js` + `<html data-alt="…">` affiche un bandeau qui propose l'autre page quand le visiteur préfère l'autre langue (`?lang=`, puis choix mémorisé `pomwik-lang`, puis navigateur ; jamais pour les robots) ; la croix mémorise la langue de la page. Le bouton FR/EN est un lien vers l'autre page.
- Les autres pages sont bilingues dans la même page : `lang.js` dans `<head>`, `<html data-show="…">`, les deux textes dans la page avec `data-lang="fr"` / `data-lang="en"` (le CSS cache l'autre langue), bouton `data-lang-switch`. `privacy.html` / `privacy-en.html` : deux pages, redirection par `data-alt`. Textes sans balise (option de liste, placeholder) : attribut `data-fr` / `data-en` et `data-ph-fr` / `data-ph-en` pour la langue qui n'est pas celle de la page. Toute nouvelle page : mêmes règles, les deux langues, même contenu.
- Prix affichés seulement sur `/tarifs/` et dans le bloc prix de l'accueil (échéancier d'exemple + trois prix), en euros, franchise de TVA (décision de Firas, 26/11/2026) : « Prix nets. TVA non applicable, art. 293 B du CGI. » / « Net prices. VAT not applicable (French VAT exemption, art. 293 B CGI). ». Grille à prix unique validée par Firas le 26/11/2026 (pas de prix de lancement). Changer un prix : `/tarifs/`, `/en/pricing/` (tableau et données structurées JSON-LD `Service`/`Offer` dans `<head>`), `index.html` et `en/index.html` (y compris l'échéancier 50/25/25).
- Mentions légales : « Pomwik SAS, société en cours de constitution, représentée par Firas Hmedi » (brief de Firas du 26/11/2026). SIREN, RCS, capital et TVA restent en commentaire `TODO` dans `mentions-legales.html`, à remplir avec le Kbis : ne rien inventer. Sous le tableau de `/tarifs/` et `/en/pricing/` : « Devis possibles dès maintenant. Les missions démarrent après l'immatriculation de la société, sans acompte avant. » et le lien vers les CGV.
- CGV : `/cgv/`, en français seulement, texte fourni par Firas repris tel quel (ne pas reformuler, les [crochets] restent visibles). `noindex` et hors du sitemap tant qu'il reste des [crochets] : Firas dira quand l'enlever. Lien « CGV » (pages FR) / « Terms (FR) » (pages EN) dans le pied de page de toutes les pages.
- Offre de lancement (5 premiers clients) : encadré `.offre-lancement` sur l'accueil, `/tarifs/`, `/en/`, `/en/pricing/`. Pour le retirer partout : `--offre-lancement: none` dans `accueil.css`. Texte : 1 mois de maintenance Suivi offert (27/11/2026) (le diagnostic reste payant, 99 € : ne jamais écrire « diagnostic offert »). Pas de compteur de places.
- Sous le tableau des tarifs (FR et EN) : « Tarifs en vigueur au [date de mise en ligne]. » Les prix augmenteront au fil des clients : mettre la date à jour à chaque changement de prix.
- Publication 199 € (129 € un seul store) seulement pour une app déjà native (Expo, React Native, Flutter). App web (Lovable, Bolt, PWA) à transformer : « sur devis après diagnostic ». Mise à jour d'une app existante (versions Android et iOS imposées) : « sur diagnostic » (27/11/2026).
- FAQ de l'accueil : données structurées `FAQPage` dans `<head>` de `index.html` et `en/index.html`, à garder identiques à la FAQ visible (`npm run check:site` dans `worker/`, lancé par le CI, échoue sinon).
- Pas de comparaison non prouvée avec la concurrence (« les prix les plus bas… »).
- Ne jamais écrire « acceptation garantie » : écrire « solde payé à l'acceptation ».
- Pas de logo client, de chiffre ni de témoignage inventés. L'illustration du téléphone sur l'accueil est marquée « Illustration ».
- Textes en français, courts et simples, pour des clients non techniques, sans tournures « IA ». Lisible à 360 px de large.
- Ne présenter comme disponible que ce qui est prouvé.
- Mentions légales : page française unique avec traduction dans la page, sans lien `hreflang` (un `?lang=en` vers la même adresse faisait doublon).
- Mentions légales : l'adresse et le téléphone de Firas restent affichés (choix de Firas, 26/11/2026).
- Délai de réponse annoncé : 12 heures, partout (site, `contact.js`, e-mails du Worker).
- Nom de Firas sur la page Contact seulement, pas sur l'accueil.
- Formulaire de contact : champs facultatifs `outil`, `lien`, `blocage` (listes fixes dans `worker/src/index.js`, à garder alignées avec `contact/index.html`), décrits dans `privacy.html` et `privacy-en.html`. Le formulaire existe en français (`contact/`) et en anglais (`en/contact/`) : garder les deux identiques.
- Mesure d'audience : extrait Cloudflare Web Analytics (sans cookie) en bas de chaque page, mentionné dans `privacy.html`. Le copier sur toute nouvelle page.

## Worker (`worker/`)
- `npm run check:site` : JSON-LD valide, FAQ visible = `FAQPage`, mêmes prix dans `/tarifs/` et `/en/pricing/`, liens internes et fichiers existants, `hreflang` réciproques. Nouvelle page publique : l'ajouter à `PAGES` dans `scripts/check-site.mjs`.
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
