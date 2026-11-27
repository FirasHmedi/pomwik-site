// Français / anglais.
// Chargé dans <head>. Pages bilingues (data-show) : sans defer, la bonne langue est affichée dès le premier rendu.
// Pages séparées (data-alt) : avec defer, le script ne bloque pas l’affichage (il n'ajoute qu'un bandeau).
// Deux façons de traduire une page :
//  - les deux textes dans la page : <html data-show="fr"> et des éléments data-lang="fr" / data-lang="en"
//    (le CSS cache l'autre langue) ;
//  - deux pages séparées : <html data-alt="/en/">. Pas de redirection automatique (Google la déconseille) :
//    si le visiteur préfère l'autre langue, un bandeau en haut de page propose le lien vers l'autre page.
// Langue préférée : ?lang=, puis choix mémorisé (pomwik-lang), puis navigateur.
// Robots : langue par défaut de la page (data-default, "fr" sinon), jamais de bandeau.
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

  // Pages séparées : bandeau qui propose l'autre page si le visiteur préfère l'autre langue.
  var alt = root.getAttribute('data-alt');
  if (alt) {
    if (lang !== root.lang && !isBot) {
      document.addEventListener('DOMContentLoaded', function () { banner(alt, lang); });
    }
  }

  function banner(href, l) {
    var t = l === 'en'
      ? { link: 'Read this page in English', close: 'Stay on the French page' }
      : { link: 'Lire cette page en français', close: 'Rester sur la page en anglais' };
    var bar = document.createElement('div');
    bar.className = 'lang-banner';
    bar.lang = l;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', l === 'en' ? 'Language' : 'Langue');
    var p = document.createElement('p');
    var a = document.createElement('a');
    a.href = href + '?lang=' + l + location.hash;
    a.hreflang = l;
    a.textContent = t.link;
    p.appendChild(a);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-banner-close';
    b.setAttribute('aria-label', t.close);
    b.textContent = '\u00d7';
    b.addEventListener('click', function () {
      store(root.lang);
      bar.parentNode.removeChild(bar);
    });
    bar.appendChild(p);
    bar.appendChild(b);
    var skip = document.querySelector('body > .skip');
    document.body.insertBefore(bar, skip ? skip.nextSibling : document.body.firstChild);
  }

  // Textes qui ne peuvent pas contenir de balise (option de liste, placeholder) : data-en / data-fr et
  // data-ph-en / data-ph-fr, pour la langue qui n'est pas celle de la page ; l'autre est gardée au premier passage.
  function swapAttrs(l) {
    var els = document.querySelectorAll('[data-en], [data-fr]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.hasAttribute('data-' + pageDefault)) el.setAttribute('data-' + pageDefault, el.textContent);
      if (el.hasAttribute('data-' + l)) el.textContent = el.getAttribute('data-' + l);
    }
    // Liens vers les pages qui existent dans les deux langues : data-href-en (adresse anglaise),
    // l'adresse d'origine est gardée dans data-href-fr au premier passage.
    els = document.querySelectorAll('a[data-href-en]');
    for (var h = 0; h < els.length; h++) {
      var a = els[h];
      if (!a.hasAttribute('data-href-fr')) a.setAttribute('data-href-fr', a.getAttribute('href'));
      a.setAttribute('href', a.getAttribute('data-href-' + l));
    }
    els = document.querySelectorAll('[data-ph-en], [data-ph-fr]');
    for (var j = 0; j < els.length; j++) {
      var f = els[j];
      if (!f.hasAttribute('data-ph-' + pageDefault)) f.setAttribute('data-ph-' + pageDefault, f.placeholder);
      if (f.hasAttribute('data-ph-' + l)) f.placeholder = f.getAttribute('data-ph-' + l);
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
        var msgs = document.querySelectorAll('form.contact-form:not(.done) .msg, form.waitlist:not(.done) .msg');
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
        b.setAttribute('aria-label', other === 'fr' ? 'FR, lire cette page en français' : 'EN, read this page in English');
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
