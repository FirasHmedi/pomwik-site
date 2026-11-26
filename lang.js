// Français / anglais sur les pages autres que l'accueil (l'accueil a i18n.js).
// Chargé dans <head>, sans defer : la bonne langue est affichée dès le premier rendu.
// Deux façons de traduire une page :
//  - les deux textes dans la page : <html data-show="fr"> et des éléments data-lang="fr" / data-lang="en"
//    (le CSS cache l'autre langue) ;
//  - deux pages séparées : <html data-alt="/privacy-en.html">, redirection vers la page de la langue voulue.
// Langue : ?lang=, puis choix mémorisé (pomwik-lang, partagé avec l'accueil), puis navigateur.
// Robots : langue par défaut de la page (data-default, "fr" sinon), pour ne pas changer ce qui est indexé.
(function () {
  'use strict';
  var KEY = 'pomwik-lang';
  var root = document.documentElement;
  var pageDefault = root.getAttribute('data-default') || 'fr';
  var isBot = /googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|crawler|spider|slurp/i.test(navigator.userAgent);

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(l) { try { localStorage.setItem(KEY, l); } catch (e) { /* navigation privée */ } }

  var param = new URLSearchParams(location.search).get('lang');
  if (param !== 'fr' && param !== 'en') param = null;
  // Langue demandée dans l'adresse : mémorisée, pour la suite de la visite.
  if (param) store(param);
  var lang = param;
  if (lang !== 'fr' && lang !== 'en') lang = stored();
  if (lang !== 'fr' && lang !== 'en') {
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || pageDefault;
    lang = isBot ? pageDefault : (/^fr\b/i.test(nav) ? 'fr' : 'en');
  }

  // Pages séparées : la page dans l'autre langue, si ce n'est pas celle-ci.
  var alt = root.getAttribute('data-alt');
  if (alt && lang !== root.lang && !isBot) {
    location.replace(alt + '?lang=' + lang + location.hash);
    return;
  }

  // Textes qui ne peuvent pas contenir de balise (option de liste, placeholder) : data-en / data-ph-en,
  // sur les pages en français par défaut seulement.
  function swapAttrs(l) {
    var els = document.querySelectorAll('[data-en]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.hasAttribute('data-fr')) el.setAttribute('data-fr', el.textContent);
      el.textContent = el.getAttribute('data-' + l);
    }
    els = document.querySelectorAll('[data-ph-en]');
    for (var j = 0; j < els.length; j++) {
      var f = els[j];
      if (!f.hasAttribute('data-ph-fr')) f.setAttribute('data-ph-fr', f.placeholder);
      f.placeholder = f.getAttribute('data-ph-' + l);
    }
  }

  function apply(l) {
    if (root.hasAttribute('data-show')) {
      root.setAttribute('data-show', l);
      root.lang = l;
      var t = root.getAttribute('data-title-' + l);
      if (t) document.title = t;
      // Adresse de référence de la version affichée (voir les liens hreflang).
      var canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        if (!canonical.hasAttribute('data-base')) canonical.setAttribute('data-base', canonical.href);
        var base = canonical.getAttribute('data-base');
        canonical.href = l === pageDefault ? base : base + '?lang=' + l;
      }
      // Message de formulaire déjà affiché : dans l'ancienne langue, on l'efface (sauf confirmation d'envoi).
      if (document.readyState !== 'loading') {
        var msgs = document.querySelectorAll('form.contact-form:not(.done) .msg');
        for (var k = 0; k < msgs.length; k++) msgs[k].textContent = '';
      }
      if (document.readyState !== 'loading') swapAttrs(l);
    }
  }
  // Titre d'origine (langue par défaut de la page), gardé avant toute traduction.
  if (document.title && !root.getAttribute('data-title-' + pageDefault)) root.setAttribute('data-title-' + pageDefault, document.title);
  apply(lang);

  document.addEventListener('DOMContentLoaded', function () {
    if (!root.getAttribute('data-title-' + pageDefault) && root.hasAttribute('data-show')) {
      // Titre d'origine (langue par défaut de la page), pour revenir en arrière.
      root.setAttribute('data-title-' + pageDefault, document.title);
    }
    apply(root.lang);
    var buttons = document.querySelectorAll('[data-lang-switch]');
    function label() {
      var other = root.lang === 'en' ? 'fr' : 'en';
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (b.tagName === 'A') continue; // lien vers l'autre page : texte fixe
        b.textContent = other.toUpperCase();
        b.lang = other;
        b.setAttribute('aria-label', other === 'fr' ? 'Lire cette page en français' : 'Read this page in English');
      }
    }
    label();
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var next = root.lang === 'en' ? 'fr' : 'en';
        store(next);
        if (this.tagName === 'A') return; // le lien mène à la page de l'autre langue
        e.preventDefault();
        apply(next);
        label();
        if (param) {
          var url = new URL(location.href);
          url.searchParams.delete('lang');
          history.replaceState(null, '', url);
          param = null;
        }
      });
    }
  });
})();
