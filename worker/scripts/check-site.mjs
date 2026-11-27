// Site checks run by the CI (no network, no dependency):
//  - every JSON-LD block of the public pages parses;
//  - the FAQPage JSON-LD of the home pages matches the visible FAQ (<details> in <div class="faq">);
//  - /tarifs/ and /en/pricing/ declare the same prices in their JSON-LD;
//  - internal links and assets exist, hreflang alternates link back.
// Usage: node scripts/check-site.mjs
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const PAGES = [
  'index.html', 'en/index.html', 'tarifs/index.html', 'en/pricing/index.html', 'contact/index.html', 'en/contact/index.html',
  'mentions-legales.html', 'privacy.html', 'privacy-en.html', '404.html', 'cgv/index.html',
];
const errors = [];

const entities = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&middot;': '·' };
const text = (s) => s
  .replace(/<[^>]+>/g, '')
  .replace(/&[a-z#0-9]+;/g, (e) => entities[e] ?? e)
  .replace(/ /g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const jsonLd = {};
for (const page of PAGES) {
  const blocks = [...read(page).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  jsonLd[page] = [];
  for (const [, body] of blocks) {
    try { jsonLd[page].push(JSON.parse(body)); } catch (e) { errors.push(`${page}: JSON-LD does not parse (${e.message})`); }
  }
}

for (const page of ['index.html', 'en/index.html']) {
  const html = read(page);
  const faq = html.match(/<div class="faq">([\s\S]*?)<\/div>/);
  const visible = faq ? [...faq[1].matchAll(/<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map(([, q, a]) => [text(q), text(a)]) : [];
  const ld = jsonLd[page].find((b) => b['@type'] === 'FAQPage');
  if (!ld) { errors.push(`${page}: FAQPage JSON-LD missing`); continue; }
  const declared = ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
  if (JSON.stringify(visible) !== JSON.stringify(declared)) {
    errors.push(`${page}: FAQPage JSON-LD differs from the visible FAQ. Update the JSON-LD in <head> with the same questions and answers.`);
  }
}

// Internal links and assets: each /path (or relative path, or https://pomwik.com/path) must exist in the repo.
const exists = (path) => {
  let p = decodeURI(path.split('#')[0].split('?')[0]).replace(/^\//, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  try { readFileSync(new URL(p, root)); return true; } catch { return false; }
};
for (const page of PAGES) {
  const dir = page.includes('/') ? '/' + page.slice(0, page.lastIndexOf('/') + 1) : '/';
  for (const [, url] of read(page).matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(mailto:|#|data:)/.test(url)) continue;
    if (/^https?:/.test(url)) {
      if (url.startsWith('https://pomwik.com/') && !exists(url.slice('https://pomwik.com'.length))) errors.push(`${page}: broken link ${url}`);
      continue;
    }
    if (!exists(url.startsWith('/') ? url : dir + url)) errors.push(`${page}: broken link ${url}`);
  }
}

// hreflang: each alternate page links back to the page that declares it.
for (const page of PAGES) {
  const self = read(page).match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  for (const [, lang, href] of read(page).matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
    if (!href.startsWith('https://pomwik.com/') || href === self) continue;
    let target = href.slice('https://pomwik.com/'.length);
    if (target === '' || target.endsWith('/')) target += 'index.html';
    const back = PAGES.includes(target) &&
      [...read(target).matchAll(/<link rel="alternate" hreflang="[^"]+" href="([^"]+)"/g)].some(([, h]) => h === self);
    if (!back) errors.push(`${page}: hreflang ${lang} -> ${href} does not link back to ${self}`);
  }
}

// English visitors stay on English pages: links to the home, pricing or contact page must point to the
// English version (EN pages), or carry data-href-en (pages with both languages, swapped by lang.js).
// The FR/EN switch (hreflang="fr") is the only exception.
const FR_ONLY = /^\/(tarifs\/|contact\/|privacy\.html)?(#[a-z-]+)?$/;
for (const page of PAGES) {
  const html = read(page);
  const english = html.match(/<html[^>]*\blang="en"/) !== null;
  const bilingual = /<html[^>]*\bdata-show=/.test(html);
  if (!english && !bilingual) continue;
  for (const [tag, href] of html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>/g)) {
    if (!FR_ONLY.test(href) || /hreflang="fr"/.test(tag)) continue;
    if (english) errors.push(`${page}: English page links to the French page ${href}`);
    else if (!/data-href-en="/.test(tag)) errors.push(`${page}: link ${href} needs data-href-en (English address)`);
  }
}

const prices = (page) => JSON.stringify([...read(page).matchAll(/"price": *"([0-9.]+)"/g)].map((m) => m[1]));
if (prices('tarifs/index.html') !== prices('en/pricing/index.html')) errors.push('tarifs/ and en/pricing/: JSON-LD prices differ');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Site checks OK (${PAGES.length} pages).`);
