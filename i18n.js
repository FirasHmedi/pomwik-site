// Accueil en français et en anglais. Le texte français est dans la page ; l'anglais est ici.
// La langue est choisie dans <head> (?lang=, choix mémorisé, puis langue du navigateur) ; le bouton FR/EN la change et la mémorise.
(() => {
'use strict';
const KEY = 'pomwik-lang';

const EN = {
  title: 'Pomwik · your stuck app, published on the stores',
  description: 'Your app built with Lovable, Bolt, Rork, or abandoned by your developer: Pomwik takes it over, secures it and publishes it on the App Store and Google Play. Fixed prices, balance paid on approval.',
  skip: 'Skip to content',
  brandAria: 'Pomwik home',
  navAria: 'Main',
  navWhat: 'What we take',
  navHow: 'How it works',
  navPrices: 'Pricing',
  navFaq: 'Questions',
  navCta: 'Free check',
  eyebrow: 'Mobile apps and app store publishing',
  h1: 'Your app deserves to be finished.',
  lede: 'Your app built with Lovable, Bolt, Rork, or abandoned by your developer: we take it over, secure it and publish it on the App Store and Google Play. Fixed prices, balance paid on approval. Based in Nice, France.',
  ctaMain: 'Free pre-assessment',
  ctaSecond: 'See pricing',
  replyNote: 'Reply within 12 hours.',
  signsTitle: 'Sounds familiar?',
  sign1: 'the app works in the demo, but still isn’t on the stores;',
  sign2: 'Apple or Google rejected the app;',
  sign3: 'every fix you ask the AI for breaks something else;',
  sign4: 'the Supabase database or user sign-in is causing trouble;',
  sign5: 'your developer abandoned the project.',
  whatTitle: 'What we take, what we turn down',
  takeTitle: 'We take',
  take1: 'publishing on the App Store and Google Play;',
  take2: 'fixing Lovable or Bolt apps built on Supabase: security, data;',
  take3: 'recent Expo or React Native apps;',
  take4: 'turning a website into an app: quote on request;',
  take5: 'rewriting in Expo: quote on request.',
  refuseTitle: 'We turn down',
  refuse1: 'health or banking apps;',
  refuse2: 'apps tied to hardware (Bluetooth, augmented reality);',
  refuse3: 'old native apps (Objective-C, Java), Cordova, React Native 0.70 or older;',
  refuse4: 'copies of existing apps;',
  refuse5: 'jobs that require direct access to production.',
  priceTitle: 'Fixed prices, balance paid on approval',
  priceP: 'Publishing on the App Store and Google Play: €390 excl. VAT at launch price. You pay the balance when Apple and Google approve the app.',
  priceCta: 'See all prices',
  howTitle: 'How it works',
  how1t: 'Free pre-assessment',
  how1p: 'You describe the app, we tell you whether we take it.',
  how2t: 'Assessment',
  how2p: 'A clear report, the list of blockers and a fixed price.',
  how3t: 'Access',
  how3p: 'You invite us to GitHub, App Store Connect and Google Play Console with limited roles. We never ask for your passwords.',
  how4t: 'Work on a test copy',
  how4p: 'Never on your production data.',
  how5t: 'Publishing',
  how5p: 'Apple and Google approve the app, then you pay the balance.',
  how6t: 'Maintenance, optional',
  how6p: 'Updates required by Apple and Google, and crash monitoring.',
  faqTitle: 'Questions',
  faq1q: 'My app was built with Lovable. Can you help?',
  faq1a: 'Yes. Lovable builds web apps: we publish yours on the stores inside a mobile wrapper or by rewriting it. We choose together at the assessment.',
  faq2q: 'Do you guarantee approval?',
  faq2a: 'The balance is only paid on approval. Rejections due to the app’s content or business model are excluded (see <a href="/tarifs/">pricing</a>).',
  faq3q: 'Who owns the code and the accounts?',
  faq3a: 'You do. The app is published under your developer accounts, and the code belongs to you.',
  faq4q: 'Do you need my passwords?',
  faq4a: 'No. Only invitations with limited roles, which you can revoke at any time.',
  faq5q: 'How long does it take?',
  faq5a: 'Publishing takes 1 to 3 weeks, depending on store review. A takeover is priced at the assessment.',
  faq6q: 'Do you work outside France?',
  faq6a: 'Yes: Belgium, Switzerland, Luxembourg, and in English for the UK and Ireland.',
  contactTitle: 'Tell us about your app',
  contactP: 'A few lines are enough: what the app does, what it was built with, what is stuck. We reply within 12 hours.',
  contactMail: 'You can also write to <a href="mailto:hello@pomwik.com">hello@pomwik.com</a>.',
  contactCta: 'Free pre-assessment',
  footer: '&copy; 2026 Pomwik &middot; <a href="/tarifs/">Pricing</a> &middot; <a href="/contact/">Contact</a> &middot; <a href="/mentions-legales.html">Legal notice</a> &middot; <a href="/privacy-en.html">Privacy</a>',
};

const root = document.documentElement;
const descMeta = document.querySelector('meta[name="description"]');
const canonical = document.querySelector('link[rel="canonical"]');
const textEls = [...document.querySelectorAll('[data-i18n]')];
const ariaEls = [...document.querySelectorAll('[data-i18n-aria]')];
// Texte français d'origine, pour revenir en arrière sans recharger.
const FR = { title: document.title, description: descMeta ? descMeta.content : '' };
textEls.forEach((el) => { FR[el.dataset.i18n] = el.innerHTML; });
ariaEls.forEach((el) => { FR[el.dataset.i18nAria] = el.getAttribute('aria-label'); });

const button = document.querySelector('[data-lang-switch]');

function apply(lang) {
  const dict = lang === 'en' ? EN : FR;
  const t = (k) => (k in dict ? dict[k] : FR[k]);
  root.lang = lang;
  document.title = t('title');
  if (descMeta) descMeta.content = t('description');
  textEls.forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  ariaEls.forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  if (button) {
    // Le bouton montre l'autre langue, dans cette langue.
    const other = lang === 'en' ? 'fr' : 'en';
    button.textContent = other.toUpperCase();
    button.lang = other;
    button.setAttribute('aria-label', other === 'fr' ? 'Lire cette page en français' : 'Read this page in English');
  }
  // Adresse de référence de la version affichée (voir les liens hreflang dans <head>).
  if (canonical) canonical.href = lang === 'en' ? 'https://pomwik.com/?lang=en' : 'https://pomwik.com/';
  root.classList.remove('i18n-wait');
}

apply(root.dataset.want === 'en' ? 'en' : 'fr');

if (button) {
  button.addEventListener('click', () => {
    const next = root.lang === 'en' ? 'fr' : 'en';
    try { localStorage.setItem(KEY, next); } catch { /* navigation privée : choix non mémorisé */ }
    apply(next);
    // ?lang= dans l'adresse l'emporterait au prochain chargement : on le retire.
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.delete('lang');
      history.replaceState(null, '', url);
    }
  });
}
})();
