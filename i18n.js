// Accueil en français et en anglais. Le texte français est dans la page ; l'anglais est ici.
// La langue est choisie dans <head> (?lang=, choix mémorisé, puis langue du navigateur) ; le bouton FR/EN la change et la mémorise.
(() => {
'use strict';
const KEY = 'pomwik-lang';

const EN = {
  title: 'Pomwik · we finish stuck apps',
  description: 'An app built with Lovable, Bolt or Replit that keeps breaking, or a mobile app rejected by the App Store or Google Play? Pomwik takes over your code, assesses it and finishes the work on a scope agreed upfront.',
  skip: 'Skip to content',
  brandAria: 'Pomwik home',
  navAria: 'Main',
  navWhat: 'What we take over',
  navHow: 'How it works',
  navFaq: 'Questions',
  navCta: 'Assessment',
  eyebrow: 'Web and mobile app rescue',
  h1: 'Your app deserves to be finished.',
  lede: 'An app built with Lovable, Bolt or Replit that no longer holds up, a developer who left halfway, a mobile app rejected by the App Store or Google Play? We take over your code, tell you what needs doing, then finish the work on a scope agreed upfront.',
  ctaMain: 'Get an initial assessment',
  ctaSecond: 'See what we take over',
  replyNote: 'Reply within 12 hours.',
  signsTitle: 'Sounds familiar?',
  sign1: 'the app works in the demo, but breaks with real users;',
  sign2: 'sign-in, the Supabase database or Stripe payments are causing trouble;',
  sign3: 'every fix you ask the AI for breaks something else;',
  sign4: 'the app is rejected or stuck on the App Store or Google Play;',
  sign5: 'nobody knows the code anymore.',
  whatTitle: 'What we take over',
  what1t: 'AI-built web apps',
  what1p: 'Lovable, Bolt, Replit, Cursor: we bring order to the code, the Supabase database, user sign-in and Stripe payments.',
  what2t: 'Stuck mobile apps',
  what2p: 'React Native and Expo: failing builds, App Store or Google Play rejections, a release left unfinished.',
  what3t: 'Abandoned projects',
  what3p: 'A freelancer or an agency left the project hanging? We pick up the code where it is.',
  what4t: 'Going live',
  what4p: 'Hosting, domain, emails, production settings: everything missing between “it works on my machine” and “it’s live”.',
  howTitle: 'How it works',
  how1t: 'An initial assessment',
  how1p: 'You give us access to the code. We look at what works, what is blocking and what is risky, and you get a clear report.',
  how2t: 'A fixed scope and price',
  how2p: 'We propose a plan: what to do, in what order, at what price. You decide before any work starts.',
  how3t: 'We finish the work',
  how3p: 'You follow progress, you test, and the code stays yours from start to finish.',
  proofTitle: 'Build errors are familiar ground',
  proofP: 'We maintain afterdb, the continuation of Realm for React Native, and publish fixes for the iOS and Android build errors we run into.',
  proofCta: 'See solved errors',
  faqTitle: 'Questions',
  faq1q: 'How much does it cost?',
  faq1a: 'The assessment has a fixed price, stated before we start. After that, you get a fixed price for the work, before it starts. No hourly billing.',
  faq2q: 'My app was built entirely with AI. Is that a problem?',
  faq2a: 'No, that’s the most common case. We know how to read that code, spot what is fragile and take it over.',
  faq3q: 'What do you need to get started?',
  faq3a: 'Access to the code (GitHub, a Lovable or Bolt export…) and a few lines on what is blocking. For a mobile app, access to App Store Connect or the Google Play Console helps a lot.',
  faq4q: 'Do you guarantee App Store approval?',
  faq4a: 'No, nobody can. We fix what caused the rejection and prepare a solid new submission.',
  faq5q: 'Are there apps you don’t take over?',
  faq5a: 'Yes. After the assessment, we tell you plainly if an app should rather be rebuilt. We also don’t take health or banking apps, or apps that depend on specific hardware.',
  faq6q: 'What about my code?',
  faq6a: 'It stays yours. We work with access you can revoke at any time.',
  contactTitle: 'Tell us about your app',
  contactP: 'A few lines are enough: what the app does, what it was built with, what is blocking. We reply within 12 hours.',
  contactMail: 'You can also write to <a href="mailto:hello@pomwik.com">hello@pomwik.com</a>.',
  fName: 'Name',
  fEmail: 'Email',
  fMessage: 'Your app and what is blocking',
  fSend: 'Send',
  fFine: 'We only use this information to reply to you. <a href="/privacy-en.html">Privacy</a>',
  footer: '&copy; 2026 Pomwik &middot; <a href="/realm/">Apps on Realm</a> &middot; <a href="/audit/" hreflang="fr">Website audit (FR)</a> &middot; <a href="/contact/" hreflang="fr">Contact (FR)</a> &middot; <a href="/mentions-legales.html" hreflang="fr">Legal notice (FR)</a> &middot; <a href="/privacy-en.html">Privacy</a>',
};

const root = document.documentElement;
const descMeta = document.querySelector('meta[name="description"]');
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
  // Message déjà affiché par le formulaire : effacé, il était dans l'autre langue.
  document.querySelectorAll('form.contact-form .msg').forEach((m) => { if (!m.closest('form').classList.contains('done')) m.textContent = ''; });
  root.classList.remove('i18n-wait');
}

apply(root.lang === 'en' ? 'en' : 'fr');

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
