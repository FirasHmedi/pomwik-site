import PostalMime from 'postal-mime';

// Test inboxes for the audit tool: t.<tag>@pomwik.com. The Email Routing catch-all hands every unknown
// address to this Worker; anything that is not a test address is rejected, as the old catch-all did.
const TEST_ADDRESS_RE = /^t\.[a-z0-9][a-z0-9._-]{0,61}@pomwik\.com$/;
const TEST_MAIL_KEEP_MS = 30 * 86_400_000;
const TEST_MAIL_MAX_BYTES = 2_000_000;
const TEST_MAIL_PER_DAY = 1000;
const TEXT_MAX = 20_000;

async function ensureTestMailTable(env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS test_mail (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         received_at INTEGER NOT NULL,
         to_addr TEXT NOT NULL,
         from_addr TEXT,
         subject TEXT,
         text TEXT,
         links TEXT,
         auth TEXT
       )`
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_test_mail_to ON test_mail(to_addr, received_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_test_mail_time ON test_mail(received_at)'),
  ]);
}

// Plain-text view of an HTML-only email. Link targets are kept so the audit can see where they point.
export function htmlToText(html) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `${label} (${href}) `)
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function linksOf(mail) {
  const found = new Set();
  for (const m of (mail.html || '').matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) found.add(m[1].replace(/&amp;/gi, '&'));
  for (const m of (mail.text || '').matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) found.add(m[0]);
  return [...found].slice(0, 50);
}

export async function receiveTestMail(message, env) {
  const to = String(message.to || '').toLowerCase();
  if (!TEST_ADDRESS_RE.test(to)) return message.setReject('Address does not exist');
  if (message.rawSize > TEST_MAIL_MAX_BYTES) return message.setReject('Message too large');

  await ensureTestMailTable(env);
  const now = Date.now();
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM test_mail WHERE received_at > ?1').bind(now - 86_400_000).first();
  if (day.n >= TEST_MAIL_PER_DAY) return message.setReject('Mailbox full, try again tomorrow');

  const mail = await PostalMime.parse(message.raw);
  const addr = mail.from?.address || message.from;
  const from = mail.from?.name ? `${mail.from.name} <${addr}>` : addr;
  const text = (mail.text || htmlToText(mail.html || '')).slice(0, TEXT_MAX);
  // Authentication results added on arrival (SPF, DKIM, DMARC of the sending site), kept for diagnosis.
  const auth = message.headers.get('authentication-results') || message.headers.get('arc-authentication-results') || '';

  await env.DB.prepare(
    'INSERT INTO test_mail (received_at, to_addr, from_addr, subject, text, links, auth) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
  )
    .bind(now, to, String(from || '').slice(0, 320), (mail.subject || '').slice(0, 500), text, JSON.stringify(linksOf(mail)), auth.slice(0, 1000) || null)
    .run();
  await env.DB.prepare('DELETE FROM test_mail WHERE received_at < ?1').bind(now - TEST_MAIL_KEEP_MS).run();
}

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return crypto.subtle.timingSafeEqual(ha, hb);
}

// Read API for the audit tool, server to server (no CORS):
// GET /mail?to=t.<tag>@pomwik.com&since=<ms>  with  Authorization: Bearer <MAIL_READ_TOKEN>
export async function readTestMail(request, env, url) {
  const reply = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET' || !env.MAIL_READ_TOKEN) return reply({ error: 'not_found' }, 404);
  if (!(await sameSecret(request.headers.get('Authorization') || '', `Bearer ${env.MAIL_READ_TOKEN}`))) return reply({ error: 'unauthorized' }, 401);

  const to = (url.searchParams.get('to') || '').toLowerCase();
  if (!TEST_ADDRESS_RE.test(to)) return reply({ error: 'bad_address' }, 400);
  const since = Number(url.searchParams.get('since')) || 0;

  await ensureTestMailTable(env);
  const { results } = await env.DB.prepare(
    'SELECT received_at, from_addr, subject, text, links, auth FROM test_mail WHERE to_addr = ?1 AND received_at >= ?2 ORDER BY received_at LIMIT 20'
  )
    .bind(to, since)
    .all();
  return reply({
    messages: results.map((r) => ({
      receivedAt: r.received_at,
      from: r.from_addr,
      subject: r.subject,
      text: r.text,
      links: JSON.parse(r.links || '[]'),
      auth: r.auth,
    })),
  });
}
