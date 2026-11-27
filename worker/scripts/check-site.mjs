// Site checks run by the CI (no network, no dependency):
//  - every JSON-LD block of the public pages parses;
//  - the FAQPage JSON-LD of the home pages matches the visible FAQ (<details> in <div class="faq">);
//  - /tarifs/ and /en/pricing/ declare the same prices in their JSON-LD.
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

const prices = (page) => JSON.stringify([...read(page).matchAll(/"price": *"([0-9.]+)"/g)].map((m) => m[1]));
if (prices('tarifs/index.html') !== prices('en/pricing/index.html')) errors.push('tarifs/ and en/pricing/: JSON-LD prices differ');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Site checks OK (${PAGES.length} pages).`);
