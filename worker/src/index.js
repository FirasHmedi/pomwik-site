import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage, Mailbox } from 'mimetext';
import { PAGES } from './pages.js';

const ALLOWED_ORIGINS = new Set(['https://pomwik.com', 'https://www.pomwik.com', 'https://api.pomwik.com']);

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
  msg.setSubject(`[${app.name}] New signup: ${s.email}`);
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
  // Resend (authenticated pomwik.com sender) is preferred; the Gmail webhook is only a fallback.
  if (!env.RESEND_API_KEY) return sendViaWebhook(env, s.email, subject, text, html);

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

// ---------- contact form ----------

const CONTACT_MAX = 4000;
const CONTACT_PER_IP_HOUR = 5;
const CONTACT_PER_DAY = 100;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function ensureContactTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS contact_log (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       created_at TEXT NOT NULL,
       ip_hash TEXT NOT NULL,
       mode TEXT NOT NULL,
       notified INTEGER NOT NULL DEFAULT 0,
       acked INTEGER NOT NULL DEFAULT 0
     )`
  ).run();
}

// Notification to the site owner, through Email Routing (the recipient must be a verified destination).
async function sendContactNotice(env, c) {
  const to = env.CONTACT_TO || env.OWNER_EMAIL;
  if (!to || !env.OWNER_MAIL) return false;
  const from = env.CONTACT_FROM || env.NOTIFY_FROM;
  const msg = createMimeMessage();
  msg.setSender({ name: 'Formulaire pomwik.com', addr: from });
  msg.setRecipient(to);
  msg.setHeader('Reply-To', new Mailbox(c.email)); // mimetext only accepts a Mailbox here
  msg.setSubject(c.audit ? `Demande d'audit : ${c.agence} (${c.email})` : `Nouveau message de ${c.nom} (${c.email})`);
  const lines = c.audit
    ? ["Nouvelle demande d'audit depuis pomwik.com", '', `Nom : ${c.nom}`, `Agence : ${c.agence}`, `E-mail : ${c.email}`, `Site de l'agence : ${c.siteAgence || '-'}`, `Sites maintenus : ${c.nbSites}`, `Date : ${c.created_at}`, '', 'Plateformes et remarques :', c.message || '-']
    : ['Nouveau message depuis le formulaire de contact de pomwik.com', '', `Nom : ${c.nom}`, `E-mail : ${c.email}`, `Date : ${c.created_at}`, '', 'Message :', c.message];
  const body = lines.join('\r\n');
  // Accents in the body: send it base64-encoded (mimetext does not encode it by itself), lines of 76 characters.
  msg.addMessage({ contentType: 'text/plain', encoding: 'base64', data: Buffer.from(body, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n') });
  await env.OWNER_MAIL.send(new EmailMessage(from, to, msg.asRaw()));
  return true;
}

// Automatic acknowledgement to the visitor. Fixed text only (nothing the visitor typed), so it can't be used to relay content.
async function sendContactAck(env, c) {
  if (!env.RESEND_API_KEY && !env.WELCOME_WEBHOOK_URL) return false;
  const subject = c.audit ? "Nous avons bien reçu votre demande d'audit" : 'Nous avons bien reçu votre message';
  const text = [
    'Bonjour,',
    '',
    c.audit
      ? "Nous avons bien reçu votre demande d'audit envoyée depuis pomwik.com. Nous vous répondons sous 48 heures avec le formulaire d'accord et les étapes."
      : 'Nous avons bien reçu votre message envoyé depuis pomwik.com. Nous vous répondons sous 48 heures.',
    '',
    '- Pomwik',
    '',
    "Ceci est une réponse automatique. Si vous n'avez rien envoyé, ignorez cet e-mail.",
  ].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.6;color:#0B2A5B;max-width:520px">
<p>Bonjour,</p><p>${c.audit ? "Nous avons bien reçu votre demande d'audit envoyée depuis pomwik.com. Nous vous répondons sous 48 heures avec le formulaire d'accord et les étapes." : 'Nous avons bien reçu votre message envoyé depuis pomwik.com. Nous vous répondons sous 48 heures.'}</p><p>- Pomwik</p>
<p style="font-size:13px;color:#47639A">Ceci est une réponse automatique. Si vous n'avez rien envoyé, ignorez cet e-mail.</p></div>`;
  if (!env.RESEND_API_KEY) return sendViaWebhook(env, c.email, subject, text, html);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Pomwik <${env.FROM_EMAIL}>`, to: [c.email], reply_to: env.FROM_EMAIL, subject, text, html }),
  });
  if (!r.ok) console.error('resend ack failed', r.status, await r.text());
  return r.ok;
}

// POST /contact sends the emails. POST /contact-panne is a control page: same answer, but it never sends anything,
// to reproduce a form that says "sent" while no email goes out.
async function handleContact(request, env, ctx, allowed, mode) {
  const raw = await request.text();
  if (raw.length > CONTACT_MAX + 1024) return json({ error: 'too_large' }, 413, allowed);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_json' }, 400, allowed);
  }
  if (typeof data.website === 'string' && data.website !== '') return json({ ok: true }, 200, allowed);

  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const nom = clean(data.nom, 100);
  const message = typeof data.message === 'string' ? data.message.replace(/\r\n?/g, '\n').trim().slice(0, CONTACT_MAX) : '';
  // Audit request from the home page: agency details, message optional.
  const audit = data.type === 'audit';
  const agence = clean(data.agence, 100);
  const siteAgence = clean(data.site_agence, 200);
  const nbSites = clean(data.nb_sites, 20);
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400, allowed);
  if (!nom || (audit ? !agence || !nbSites : !message)) return json({ error: 'missing_field' }, 400, allowed);

  await ensureContactTable(env);
  const now = Date.now();
  const ipHash = await sha256(`${request.headers.get('CF-Connecting-IP') || ''}|${new Date(now).toISOString().slice(0, 10)}`);
  const hourAgo = new Date(now - 3600_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();
  const perIp = await env.DB.prepare('SELECT COUNT(*) AS n FROM contact_log WHERE ip_hash = ?1 AND created_at > ?2').bind(ipHash, hourAgo).first();
  const perDay = await env.DB.prepare('SELECT COUNT(*) AS n FROM contact_log WHERE created_at > ?1').bind(dayAgo).first();
  if (perIp.n >= CONTACT_PER_IP_HOUR || perDay.n >= CONTACT_PER_DAY) return json({ error: 'rate_limited' }, 429, allowed);

  const created_at = new Date(now).toISOString();
  // The log only serves the rate limit: keep 30 days, as stated on the privacy page.
  await env.DB.prepare('DELETE FROM contact_log WHERE created_at < ?1').bind(new Date(now - 30 * 86_400_000).toISOString()).run();
  const row = await env.DB.prepare('INSERT INTO contact_log (created_at, ip_hash, mode) VALUES (?1, ?2, ?3) RETURNING id')
    .bind(created_at, ipHash, mode)
    .first();
  if (mode === 'panne') return json({ ok: true }, 200, allowed);

  const c = { nom, email, message, created_at, audit, agence, siteAgence, nbSites };
  ctx.waitUntil(
    (async () => {
      let notified = false;
      let acked = false;
      try {
        notified = await sendContactNotice(env, c);
      } catch (e) {
        console.error('contact notice failed', String(e));
      }
      try {
        acked = await sendContactAck(env, c);
      } catch (e) {
        console.error('contact ack failed', String(e));
      }
      await env.DB.prepare('UPDATE contact_log SET notified = ?2, acked = ?3 WHERE id = ?1').bind(row.id, notified ? 1 : 0, acked ? 1 : 0).run();
    })()
  );
  return json({ ok: true }, 200, allowed);
}

// ---------- entry points ----------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/unsubscribe') return unsubscribe(request, env, url);
    if (request.method === 'GET') {
      const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      if (Object.hasOwn(PAGES, path)) {
        if (path !== url.pathname) return Response.redirect(`${url.origin}${path}`, 301);
        return new Response(PAGES[path], { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } });
      }
    }

    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.has(origin) || (env.DEV_ORIGIN && origin === env.DEV_ORIGIN) ? origin : '';

    const routes = ['/waitlist', '/contact', '/contact-panne'];
    if (!routes.includes(url.pathname)) return json({ error: 'not_found' }, 404, allowed);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(allowed) : {} });
    }
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, allowed);
    if (!allowed) return json({ error: 'forbidden' }, 403, '');
    if (url.pathname === '/contact') return handleContact(request, env, ctx, allowed, 'normal');
    if (url.pathname === '/contact-panne') return handleContact(request, env, ctx, allowed, 'panne');

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
