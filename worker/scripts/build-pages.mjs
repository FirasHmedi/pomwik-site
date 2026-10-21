// Regenerates src/pages.js from the site's contact pages, with contact.js inlined and links made absolute.
// Usage: node scripts/build-pages.mjs          writes src/pages.js
//        node scripts/build-pages.mjs --check  exits 1 if src/pages.js is out of date
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const outFile = new URL('worker/src/pages.js', root);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const SITE = 'https://pomwik.com';
const SCRIPT_TAG = '<script src="/contact.js"></script>';
const PAGES = {
  '/contact/': 'contact/index.html',
  '/tests/contact-panne/': 'tests/contact-panne/index.html',
};

function render(file) {
  const parts = read(file).split(SCRIPT_TAG);
  if (parts.length !== 2) throw new Error(`${file}: expected exactly one ${SCRIPT_TAG}`);
  const [before, after] = parts;
  // The copies on api.pomwik.com are not to be indexed: the canonical link becomes a noindex meta.
  const absolute = (s) => s
    .replace(/<link rel="canonical" href="[^"]*">/, '<meta name="robots" content="noindex, nofollow">')
    .replace(/\b(href|src)="\/(?!\/)/g, `$1="${SITE}/`);
  return `${absolute(before)}<script>\n${read('contact.js')}</script>${absolute(after)}`;
}

const output = [
  '// Generated from contact/index.html, tests/contact-panne/index.html and contact.js.',
  '// Serves the same pages on api.pomwik.com (noindex) so the contact flow can be tested with a Worker deploy alone.',
  'export const PAGES = {',
  Object.entries(PAGES).map(([path, file]) => `${JSON.stringify(path)}: ${JSON.stringify(render(file))}`).join(',\n'),
  '};',
  '',
].join('\n');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outFile, 'utf8');
  } catch {}
  if (current !== output) {
    console.error('worker/src/pages.js is out of date with contact/index.html, tests/contact-panne/index.html or contact.js.');
    console.error('Run `npm run build:pages` in worker/ and commit the result.');
    process.exit(1);
  }
  console.log('worker/src/pages.js is up to date.');
} else {
  writeFileSync(outFile, output);
  console.log('Wrote worker/src/pages.js.');
}
