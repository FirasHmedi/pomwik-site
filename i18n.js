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
  navHow: 'How it works',
  navPrices: 'Pricing',
  navFaq: 'Questions',
  navCta: 'Free app check',
  eyebrow: 'Mobile apps and app store publishing',
  h1: 'Your app deserves to be finished.',
  lede: 'Your app built with Lovable, Bolt, Rork, or abandoned by your developer: we take it over, secure it and publish it on the App Store and Google Play. Fixed prices, balance paid on approval. Based in Nice, France.',
  ctaMain: 'Free app check',
  ctaSecond: 'See pricing',
  replyNote: 'Reply within 12 hours. No commitment.',
  nNow1: 'now',
  n1t: 'Your app is approved',
  n1b: 'It is ready for distribution on the App Store.',
  nNow2: '2h ago',
  n2t: 'Your app is published',
  n2b: 'It is now available on Google Play.',
  nNow3: '2h ago',
  n3t: 'Publishing complete',
  n3b: 'You can now pay the balance.',
  pDate: 'Thursday',
  phoneCaption: 'Illustration: the day your app is approved',
  signsLabel: 'Who it’s for',
  signsTitle: 'Sounds familiar?',
  sign1: 'The app works in the demo, but it still isn’t on the stores.',
  sign2: 'Apple or Google rejected the app.',
  sign3: 'Every fix you ask the AI for breaks something else.',
  sign4: 'User data or sign-in is causing trouble.',
  sign5: 'Your developer abandoned the project.',
  howLabel: 'Method',
  howTitle: 'How it works',
  howIntro: 'At every step, you know what is happening and what you will pay.',
  how1t: 'Free app check',
  how1p: 'You describe the app, we tell you whether we take it.',
  how2t: 'Assessment',
  how2p: 'A clear report, the list of blockers and a fixed price.',
  how3t: 'Access',
  how3p: 'You invite us to your accounts (code, App Store, Google Play) with limited rights. We never ask for your passwords.',
  how4t: 'Work on a test copy',
  how4p: 'Never on your real users’ data.',
  how5t: 'Publishing',
  how5p: 'Apple and Google approve the app, then you pay the balance.',
  how6t: 'Maintenance, optional',
  how6p: 'Updates required by Apple and Google, and crash monitoring.',
  priceLabel: 'Pricing',
  priceTitle: 'Fixed prices, balance paid on approval',
  priceP: 'The price is set before we start. For publishing, you pay half on order and the rest when Apple and Google approve the app.',
  ledgerLabel: 'Example',
  ledgerTitle: 'Publishing on the App Store + Google Play',
  ledgerHT: 'excl. VAT, fixed price',
  l1: 'On order',
  l1d: '50%',
  l2: 'When Apple approves the app',
  l2d: '25%',
  l3: 'When Google approves the app',
  l3d: '25%',
  ledgerFoot: 'Rejections due to the app’s content or business model are not covered. We tell you at the assessment if your app is at risk of this kind of rejection.',
  f1l: 'Written assessment',
  f1p: 'The list of blockers and a fixed price. Deducted if the job goes ahead.',
  f2l: 'Publishing on both stores',
  f2p: 'Your app on the App Store and Google Play, under your accounts. One store only: €129.',
  f3l: 'Takeover',
  f3p: 'Five blockers fixed: bugs, security, data.',
  figFoot: 'Prices excl. VAT. Fixing a rejection: €149. Maintenance from €49 per month.',
  priceCta: 'See all prices',
  promLabel: 'Our commitments',
  promTitle: 'Your app stays yours',
  p1t: 'Your accounts, your code',
  p1p: 'The app is published under your developer accounts. The code belongs to you.',
  p2t: 'Never your passwords',
  p2p: 'Only invitations with limited rights, which you can revoke whenever you want.',
  p3t: 'Your users stay safe',
  p3p: 'We work on a test copy, never on your real data.',
  p4t: 'One point of contact',
  p4p: 'You talk directly to the person working on your app, from assessment to publishing.',
  whatLabel: 'Scope',
  whatTitle: 'What we take, what we turn down',
  whatIntro: 'We’d rather tell you up front: some apps need a specialised team.',
  takeTag: 'Yes',
  takeTitle: 'We take',
  take1: 'Publishing on the App Store and Google Play.',
  take2: 'Fixing apps built with Lovable or Bolt: security, data. <small>Including with a Supabase database.</small>',
  take3: 'Recent mobile apps. <small>Expo or React Native.</small>',
  take4: 'Turning a website into an app, on quote.',
  take5: 'Rewriting on a solid base, on quote. <small>In Expo.</small>',
  refuseTag: 'No',
  refuseTitle: 'We turn down',
  refuse1: 'Health or banking apps.',
  refuse2: 'Apps tied to a device: Bluetooth, augmented reality.',
  refuse3: 'Apps built on outdated technology. <small>Objective-C, Java, Cordova, React Native 0.70 or older.</small>',
  refuse4: 'Copies of existing apps.',
  refuse5: 'Jobs that require working directly on your real data.',
  faqLabel: 'Questions',
  faqTitle: 'What people often ask',
  faq1q: 'My app was built with Lovable. Can you help?',
  faq1a: 'Yes. Lovable builds web apps: we publish yours on the stores by adapting it to phones, or by rewriting it. We choose together at the assessment.',
  faq2q: 'Do you guarantee approval?',
  faq2a: 'The balance is only paid on approval. Rejections due to the app’s content or business model are excluded (see <a href="/tarifs/">pricing</a>). We tell you at the assessment if your app is at risk of this kind of rejection.',
  faq3q: 'Who owns the code and the accounts?',
  faq3a: 'You do. The app is published under your developer accounts, and the code belongs to you.',
  faq4q: 'Do you need my passwords?',
  faq4a: 'No. Only invitations with limited rights, which you can revoke at any time.',
  faq5q: 'How long does it take?',
  faq5a: 'Publishing takes 1 to 3 weeks, depending on store review. A takeover is priced at the assessment.',
  faq6q: 'Do you work outside France?',
  faq6a: 'Yes: Belgium, Switzerland, Luxembourg, and in English for the UK and Ireland.',
  contactTitle: 'Tell us about your app',
  contactP: 'A few lines are enough: what the app does, what it was built with, what is stuck. We reply within 12 hours.',
  contactCta: 'Free app check',
  contactMail: 'Or write to <a href="mailto:hello@pomwik.com">hello@pomwik.com</a>',
  footAbout: 'Mobile apps and app store publishing. Based in Nice, France.',
  footPages: 'Pages',
  footPrices: 'Pricing',
  footContact: 'Free app check',
  footFaq: 'Questions',
  footReach: 'Contact',
  footLegal: 'Legal notice',
  footPrivacy: 'Privacy',
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
