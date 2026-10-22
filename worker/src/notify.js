import { sameSecret } from './testmail.js';

// E-mails de la surveillance (outil d'audit, GitHub Actions) vers les agences : alertes et récapitulatif hebdomadaire.
// POST /notify  avec  Authorization: Bearer <MAIL_READ_TOKEN>  et  { to, subject, text, html?, kind }
// Destinataires limités par le secret NOTIFY_ALLOW (adresses ou « @domaine », séparés par des virgules).
const KINDS = ['alerte', 'recap'];
const MAX_TO = 5;
const MAX_SUBJECT = 200;
const MAX_TEXT = 50_000;
const MAX_HTML = 200_000;
const PER_HOUR = 50;
const EMAIL_RE = /^[^\s@,<>]{1,64}@[^\s@.,<>]+(\.[^\s@.,<>]+)+$/;

const reply = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

/** Liste NOTIFY_ALLOW : « firas@pomwik.com,@agence-exemple.fr » → adresse exacte ou domaine entier. */
export function allowedBy(list, email) {
  const entries = String(list).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return entries.some((e) => (e.startsWith('@') ? email.endsWith(e) : email === e));
}

async function ensureNotifyTable(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS notify_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, to_count INTEGER NOT NULL)').run();
}

export async function notify(request, env) {
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  if (!env.MAIL_READ_TOKEN || !(await sameSecret(request.headers.get('Authorization') || '', `Bearer ${env.MAIL_READ_TOKEN}`))) {
    return reply({ error: 'unauthorized' }, 401);
  }
  if (!env.NOTIFY_ALLOW || !env.RESEND_API_KEY) return reply({ error: 'disabled', message: 'envoi désactivé' }, 503);

  let data;
  try {
    data = JSON.parse(await request.text());
  } catch {
    return reply({ error: 'bad_json' }, 400);
  }
  if (data === null || typeof data !== 'object') return reply({ error: 'bad_json' }, 400);
  const { to, subject, text, html, kind } = data;
  const bad = (field) => reply({ error: 'invalid', field }, 400);
  if (!Array.isArray(to) || to.length < 1 || to.length > MAX_TO || !to.every((x) => typeof x === 'string' && EMAIL_RE.test(x.trim()))) return bad('to');
  if (typeof subject !== 'string' || !subject.trim() || subject.length > MAX_SUBJECT || /[\r\n]/.test(subject)) return bad('subject');
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return bad('text');
  if (html !== undefined && (typeof html !== 'string' || html.length > MAX_HTML)) return bad('html');
  if (!KINDS.includes(kind)) return bad('kind');

  const recipients = [...new Set(to.map((x) => x.trim().toLowerCase()))];
  const refused = recipients.filter((x) => !allowedBy(env.NOTIFY_ALLOW, x));
  if (refused.length) return reply({ error: 'recipient_not_allowed', count: refused.length }, 403);

  await ensureNotifyTable(env);
  const now = Date.now();
  const sent = await env.DB.prepare('SELECT COUNT(*) AS n FROM notify_log WHERE at > ?1').bind(now - 3_600_000).first();
  if (sent.n >= PER_HOUR) return reply({ error: 'rate_limited' }, 429);

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Pomwik <${env.FROM_EMAIL}>`,
      to: recipients,
      reply_to: env.FROM_EMAIL,
      subject,
      text,
      ...(html ? { html } : {}),
      headers: { 'X-Pomwik-Kind': kind },
    }),
  }).catch((e) => e);
  if (r instanceof Error || !r.ok) {
    console.error('notify: resend failed', r instanceof Error ? String(r) : r.status);
    return reply({ error: 'send_failed', message: "Resend a refusé l'envoi" }, 502);
  }
  const out = await r.json().catch(() => ({}));
  await env.DB.prepare('INSERT INTO notify_log (at, kind, to_count) VALUES (?1, ?2, ?3)').bind(now, kind, recipients.length).run();
  // Le journal sert seulement à la limite horaire : on garde 30 jours
  await env.DB.prepare('DELETE FROM notify_log WHERE at < ?1').bind(now - 30 * 86_400_000).run();
  return reply({ ok: true, id: out.id ?? null });
}
