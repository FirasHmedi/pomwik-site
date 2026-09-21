import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';

const ALLOWED_ORIGINS = new Set(['https://pomwik.com', 'https://www.pomwik.com']);

const APPS = {
  petty: { name: 'Petty', tagline: 'watch your puppy or kitten grow' },
  fieldwrite: { name: 'Fieldwrite', tagline: 'field reports in minutes, from your phone' },
  settled: { name: 'Settled', tagline: 'your first 30 days in a new country, step by step' },
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_BODY = 2048;
const RETRY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const SETTLE_DELAY_MS = 3 * 60 * 1000;

// ---------- helpers ----------

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(origin ? corsHeaders(origin) : {}) },
  });
}

// Trim, collapse whitespace, drop control characters, cap the length.
const clean = (v, max) =>
  typeof v === 'string' ? v.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

// Does the email's domain exist and accept mail? Fails open if the DNS lookup itself fails.
async function domainCanReceiveMail(domain) {
  const ask = async (type) => {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
      { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(2500) }
    );
    if (!r.ok) throw new Error('dns lookup failed');
    return r.json();
  };
  try {
    const mx = await ask('MX');
    if (mx.Status === 3) return false; // NXDOMAIN
    const mxAnswers = (mx.Answer || []).filter((a) => a.type === 15);
    if (mxAnswers.length) {
      // A single "0 ." record is a "null MX": the domain says it accepts no mail.
      return !mxAnswers.every((a) => /^0\s+\.?$/.test(String(a.data).trim()));
    }
    const a = await ask('A');
    if ((a.Answer || []).some((x) => x.type === 1)) return true;
    const aaaa = await ask('AAAA');
    return (aaaa.Answer || []).some((x) => x.type === 28);
  } catch {
    return true;
  }
}

// ---------- emails ----------

async function sendOwnerNotice(env, s, total) {
  if (!env.OWNER_EMAIL || !env.OWNER_MAIL) return false;
  const app = APPS[s.app];
  const msg = createMimeMessage();
  msg.setSender({ name: 'Pomwik waitlist', addr: env.NOTIFY_FROM });
  msg.setRecipient(env.OWNER_EMAIL);
  msg.setSubject(`[${app.name}] New waitlist signup`);
  msg.addMessage({
    contentType: 'text/plain',
    data: [
      'New waitlist signup',
      '',
      `App: ${app.name}`,
      `Email: ${s.email}`,
      s.answer ? `Answer 1: ${s.answer}` : null,
      s.answer2 ? `Answer 2: ${s.answer2}` : null,
      `Time: ${s.created_at}`,
      `Total for ${app.name}: ${total}`,
    ]
      .filter((line) => line !== null)
      .join('\n'),
  });
  await env.OWNER_MAIL.send(new EmailMessage(env.NOTIFY_FROM, env.OWNER_EMAIL, msg.asRaw()));
  return true;
}

// Sends through a Google Apps Script web app that mails from the studio's Gmail account (free, no DNS changes).
async function sendViaWebhook(env, to, subject, text, html) {
  const r = await fetch(env.WELCOME_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: env.WELCOME_WEBHOOK_SECRET, to, subject, text, html }),
    redirect: 'follow',
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out.ok !== true) console.error('webhook failed', r.status, JSON.stringify(out).slice(0, 200));
  return r.ok && out.ok === true;
}

async function sendWelcome(env, s) {
  if (!env.WELCOME_WEBHOOK_URL && !env.RESEND_API_KEY) return false;
  const app = APPS[s.app];
  const unsub = `${env.PUBLIC_API}/unsubscribe?t=${s.token}`;
  const text = [
    'Hi,',
    '',
    `Thanks for joining the ${app.name} waitlist: ${app.tagline}.`,
    '',
    "We're aiming to launch in about one month. As soon as it's ready to try, you'll get one email from us.",
    '',
    `In the meantime, just reply to this email and tell us what you'd most like ${app.name} to do. We read every message.`,
    '',
    '- Pomwik',
    '',
    `You're receiving this because you joined the ${app.name} waitlist at pomwik.com.`,
    `Unsubscribe: ${unsub}`,
  ].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.6;color:#0B2A5B;max-width:520px">
<p>Hi,</p>
<p>Thanks for joining the <strong>${app.name}</strong> waitlist: ${app.tagline}.</p>
<p>We're aiming to launch in <strong>about one month</strong>. As soon as it's ready to try, you'll get one email from us.</p>
<p>In the meantime, just reply to this email and tell us what you'd most like ${app.name} to do. We read every message.</p>
<p>- Pomwik</p>
<p style="font-size:13px;color:#47639A">You're receiving this because you joined the ${app.name} waitlist at pomwik.com.<br><a href="${unsub}" style="color:#47639A">Unsubscribe</a></p>
</div>`;
  const subject = `You're on the ${app.name} waitlist`;
  if (env.WELCOME_WEBHOOK_URL) return sendViaWebhook(env, s.email, subject, text, html);

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Pomwik <${env.FROM_EMAIL}>`,
      to: [s.email],
      reply_to: env.FROM_EMAIL,
      subject,
      text,
      html,
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  if (!r.ok) console.error('resend failed', r.status, await r.text());
  return r.ok;
}

// Runs one email step at most once at a time: the flag goes 0 (pending) -> 2 (claimed) -> 1 (done),
// or back to 0 if sending fails or isn't configured yet, so a later retry can pick it up.
async function claimAndSend(env, id, column, send) {
  const claim = await env.DB.prepare(`UPDATE signups SET ${column} = 2 WHERE id = ?1 AND ${column} = 0`).bind(id).run();
  if (claim.meta.changes !== 1) return;
  let ok = false;
  try {
    ok = await send();
  } catch (e) {
    console.error(`${column} failed`, String(e));
  }
  await env.DB.prepare(`UPDATE signups SET ${column} = ?2 WHERE id = ?1`).bind(id, ok ? 1 : 0).run();
}

// Sends whichever emails are still pending for one signup. Never throws.
async function processSignup(env, s) {
  if (!s.owner_notified) {
    await claimAndSend(env, s.id, 'owner_notified', async () => {
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM signups WHERE app = ?1 AND unsubscribed = 0').bind(s.app).first();
      return sendOwnerNotice(env, s, row.n);
    }).catch((e) => console.error('owner step failed', String(e)));
  }
  if (!s.welcome_sent) {
    await claimAndSend(env, s.id, 'welcome_sent', () => sendWelcome(env, s)).catch((e) => console.error('welcome step failed', String(e)));
  }
}

// Cron: retries emails that failed or were waiting for a key. Skips very new rows so it never races the live send.
async function retryPending(env) {
  const now = Date.now();
  const newest = new Date(now - SETTLE_DELAY_MS).toISOString();
  const oldest = new Date(now - RETRY_WINDOW_MS).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT * FROM signups
      WHERE unsubscribed = 0 AND (welcome_sent = 0 OR owner_notified = 0)
        AND token IS NOT NULL AND app IN ('petty', 'fieldwrite', 'settled')
        AND created_at < ?1 AND created_at > ?2
      ORDER BY id LIMIT 20`
  )
    .bind(newest, oldest)
    .all();
  for (const s of results) await processSignup(env, s);
}

// ---------- unsubscribe ----------

async function unsubscribe(request, env, url) {
  const token = url.searchParams.get('t') || '';
  if (/^[0-9a-f-]{36}$/.test(token)) {
    await env.DB.prepare('UPDATE signups SET unsubscribed = 1 WHERE token = ?1').bind(token).run();
  }
  if (request.method === 'POST') return new Response('ok', { status: 200 });
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribed</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#0B2A5B">
<h1>You're unsubscribed</h1><p>We won't email you again about this waitlist. If this was a mistake, you can rejoin any time at <a href="https://pomwik.com">pomwik.com</a>.</p></body>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } }
  );
}

// ---------- entry points ----------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/unsubscribe') return unsubscribe(request, env, url);

    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.has(origin) || (env.DEV_ORIGIN && origin === env.DEV_ORIGIN) ? origin : '';

    if (url.pathname !== '/waitlist') return json({ error: 'not_found' }, 404, allowed);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(allowed) : {} });
    }
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, allowed);
    if (!allowed) return json({ error: 'forbidden' }, 403, '');

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413, allowed);

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: 'bad_json' }, 400, allowed);
    }

    // Honeypot: bots fill the hidden field. Pretend success, store nothing.
    if (typeof data.website === 'string' && data.website !== '') return json({ ok: true }, 200, allowed);

    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const app = typeof data.app === 'string' ? data.app : '';
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400, allowed);
    if (!Object.hasOwn(APPS, app)) return json({ error: 'invalid_app' }, 400, allowed);
    if (!(await domainCanReceiveMail(email.split('@')[1]))) return json({ error: 'invalid_domain' }, 400, allowed);

    const answer = clean(data.a1, 80);
    const answer2 = clean(data.a2, 80);
    const created_at = new Date().toISOString();
    const token = crypto.randomUUID();

    // A repeat of the same email + app is a no-op with an identical reply, so the list can't be probed.
    const inserted = await env.DB.prepare(
      `INSERT INTO signups (email, app, answer, answer2, created_at, token)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(email, app) DO NOTHING RETURNING id`
    )
      .bind(email, app, answer || null, answer2 || null, created_at, token)
      .first();

    if (inserted) {
      const signup = { id: inserted.id, email, app, answer, answer2, created_at, token, welcome_sent: 0, owner_notified: 0 };
      // Send this signup's emails now, then retry anyone still waiting (for example if no email key existed yet).
      ctx.waitUntil(processSignup(env, signup).then(() => retryPending(env)).catch((e) => console.error('retry failed', String(e))));
    }
    return json({ ok: true }, 200, allowed);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(retryPending(env));
  },
};
