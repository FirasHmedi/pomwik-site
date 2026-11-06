import { describe, expect, it, vi } from 'vitest';
import { call, IP, makeEnv, mails, net, ORIGIN, outbound, rows, WEBHOOK_URL } from './helpers.js';

const contactLog = () => rows('SELECT * FROM contact_log ORDER BY id');
const tableExists = async (name) => (await rows("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1", name)).length > 0;

const MESSAGE = { nom: 'Élodie Dupont', email: 'elodie@example.fr', message: 'Bonjour,\r\nça marche ?' };
const AUDIT = { type: 'audit', nom: 'Jean Martin', agence: 'Agence Web', email: 'jean@agence.example', site_agence: 'agence.example', nb_sites: '6-20', message: '' };

describe('POST /contact', () => {
  it('logs the message without the IP address and answers {ok: true}', async () => {
    const res = await call(makeEnv(), '/contact', { body: MESSAGE });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const [entry, ...others] = await contactLog();
    expect(others).toEqual([]);
    expect(entry).toMatchObject({ mode: 'normal', notified: 1, acked: 1 });
    expect(entry.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(entry)).not.toContain(IP);
  });

  it('emails the owner through the send_email binding, with the visitor as Reply-To', async () => {
    const env = makeEnv();
    await call(env, '/contact', { body: MESSAGE });

    const [mail, ...others] = mails(env);
    expect(others).toEqual([]);
    expect(mail).toMatchObject({ from: 'contact@pomwik.com', to: 'pomwikapps@gmail.com', subject: 'Nouveau message de Élodie Dupont (elodie@example.fr)' });
    expect(mail.headers['reply-to']).toBe('<elodie@example.fr>');
    expect(mail.text).toContain('Nom : Élodie Dupont');
    expect(mail.text).toContain('Message :\r\nBonjour,\nça marche ?');
  });

  it('sends the notice to OWNER_EMAIL when CONTACT_TO is not set', async () => {
    const env = makeEnv({ CONTACT_TO: undefined });
    await call(env, '/contact', { body: MESSAGE });
    expect(mails(env)).toMatchObject([{ to: 'owner@example.com' }]);
  });

  it('sends the visitor a fixed acknowledgement that does not repeat what they typed', async () => {
    await call(makeEnv(), '/contact', { body: { ...MESSAGE, message: 'Visit https://spam.example now' } });

    const [ack, ...others] = outbound('resend');
    expect(others).toEqual([]);
    expect(ack.body).toMatchObject({ from: 'Pomwik <hello@pomwik.com>', to: ['elodie@example.fr'], subject: 'Nous avons bien reçu votre message' });
    expect(JSON.stringify(ack.body)).not.toContain('spam.example');
    expect(JSON.stringify(ack.body)).not.toContain('Élodie');
  });

  it('does not look up the email domain', async () => {
    await call(makeEnv(), '/contact', { body: MESSAGE });
    expect(outbound('dns')).toEqual([]);
  });

  it('handles an audit request, where the message is optional', async () => {
    const env = makeEnv();
    const res = await call(env, '/contact', { body: AUDIT });

    expect(res.status).toBe(200);
    const [mail] = mails(env);
    expect(mail.subject).toBe("Demande d'audit : Agence Web (jean@agence.example)");
    expect(mail.text).toContain("Site de l'agence : agence.example");
    expect(mail.text).toContain('Sites maintenus : 6-20');
    expect(outbound('resend')).toMatchObject([{ body: { to: ['jean@agence.example'], subject: "Nous avons bien reçu votre demande d'essai gratuit" } }]);
  });

  it('still answers {ok: true} and records the failure when the emails cannot be sent', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = makeEnv();
    env.OWNER_MAIL.send.mockRejectedValue(new Error('destination address not verified'));
    net.resend = () => new Response('{}', { status: 500 });
    const res = await call(env, '/contact', { body: MESSAGE });

    expect(res.status).toBe(200);
    expect(await contactLog()).toMatchObject([{ notified: 0, acked: 0 }]);
    expect(log).toHaveBeenCalledWith('contact notice failed', expect.stringContaining('not verified'));
  });

  it.each([
    ['without a name', { ...MESSAGE, nom: '  ' }],
    ['without a message', { ...MESSAGE, message: '' }],
    ['for an audit without an agency', { ...AUDIT, agence: '' }],
    ['for an audit without a number of sites', { ...AUDIT, nb_sites: undefined }],
  ])('rejects a message %s with 400 missing_field', async (_, body) => {
    const res = await call(makeEnv(), '/contact', { body });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'missing_field' });
    expect(await tableExists('contact_log')).toBe(false);
  });

  it.each(['', 'elodie', 'elodie@example', 'élodie @example.fr'])('rejects the email %j with 400 invalid_email', async (email) => {
    const res = await call(makeEnv(), '/contact', { body: { ...MESSAGE, email } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_email' });
  });

  it('rejects malformed JSON with 400 bad_json', async () => {
    const res = await call(makeEnv(), '/contact', { body: 'nom=Jean' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_json' });
  });

  it('rejects a body over 5024 characters with 413', async () => {
    const res = await call(makeEnv(), '/contact', { body: { ...MESSAGE, message: 'x'.repeat(5024) } });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
  });

  it.each([
    ['/contact', 'null'],
    ['/contact', '42'],
    ['/contact-panne', 'null'],
  ])('%s rejects the JSON body %s with 400 bad_json', async (path, body) => {
    const res = await call(makeEnv(), path, { body });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_json' });
    expect(await tableExists('contact_log')).toBe(false);
  });
});

describe('POST /contact: page language and source page', () => {
  const REALM = { nom: 'Sam Lee', email: 'sam@example.com', message: 'realm 12.13, React Native 0.74', lang: 'en', page: 'pomwik.com/realm/' };

  it('sends an English acknowledgement for a form on an English page', async () => {
    await call(makeEnv(), '/contact', { body: { ...REALM, message: 'Visit https://spam.example now' } });

    const [ack, ...others] = outbound('resend');
    expect(others).toEqual([]);
    expect(ack.body).toMatchObject({ from: 'Pomwik <hello@pomwik.com>', to: ['sam@example.com'], subject: 'We received your message' });
    expect(ack.body.text).toBe(
      'Hello,\n\nWe received your message sent from pomwik.com. We will reply within 12 hours.\n\n- Pomwik\n\n' +
        'This is an automatic reply. If you did not send anything, please ignore this email.'
    );
    expect(ack.body.html).toContain('We will reply within 12 hours.');
    expect(ack.body.html).not.toMatch(/<img|<a |Bonjour/);
    expect(JSON.stringify(ack.body)).not.toContain('spam.example');
    expect(JSON.stringify(ack.body)).not.toContain('Sam Lee');
  });

  it('sends the English acknowledgement through the webhook too, when Resend is not set', async () => {
    const env = makeEnv({ RESEND_API_KEY: undefined, WELCOME_WEBHOOK_URL: WEBHOOK_URL, WELCOME_WEBHOOK_SECRET: 'test-secret' });
    await call(env, '/contact', { body: REALM });

    expect(outbound('resend')).toEqual([]);
    expect(outbound('webhook')).toMatchObject([{ body: { to: 'sam@example.com', subject: 'We received your message' } }]);
    expect(await contactLog()).toMatchObject([{ acked: 1 }]);
  });

  it.each([
    ['no language', undefined],
    ['an unknown language', 'de'],
    ['a language that is not a string', ['en']],
  ])('keeps the French acknowledgement with %s', async (_, lang) => {
    await call(makeEnv(), '/contact', { body: { ...MESSAGE, lang } });
    const [ack] = outbound('resend');
    expect(ack.body.subject).toBe('Nous avons bien reçu votre message');
    expect(ack.body.text).toContain('Nous vous répondons sous 12 heures.');
  });

  it('names the source page and the language in the owner notice', async () => {
    const env = makeEnv();
    await call(env, '/contact', { body: REALM });

    const [mail] = mails(env);
    expect(mail.subject).toBe('Nouveau message de Sam Lee (sam@example.com) depuis pomwik.com/realm/');
    expect(mail.text).toContain('Page : pomwik.com/realm/\r\nLangue : anglais\r\n');
    expect(mail.text).toContain('Message :\r\nrealm 12.13, React Native 0.74');
  });

  it('keeps the owner notice subject as before when no page is sent', async () => {
    const env = makeEnv();
    await call(env, '/contact', { body: MESSAGE });

    const [mail] = mails(env);
    expect(mail.subject).toBe('Nouveau message de Élodie Dupont (elodie@example.fr)');
    expect(mail.text).toContain('Page : -\r\nLangue : français\r\n');
  });

  it('keeps the audit subject (used by a mail filter) and adds the page to its body', async () => {
    const env = makeEnv();
    await call(env, '/contact', { body: { ...AUDIT, lang: 'fr', page: 'pomwik.com/audit/' } });

    const [mail] = mails(env);
    expect(mail.subject).toBe("Demande d'audit : Agence Web (jean@agence.example)");
    expect(mail.text).toContain('Page : pomwik.com/audit/');
  });

  it('cannot add a header through the page, and caps it at 200 characters', async () => {
    const env = makeEnv();
    await call(env, '/contact', { body: { ...REALM, page: `pomwik.com/realm/\r\nBcc: victim@example.net ${'x'.repeat(300)}` } });

    const [mail] = mails(env);
    expect(mail.headers.bcc).toBeUndefined();
    expect(mail.subject).toContain('depuis pomwik.com/realm/ Bcc: victim@example.net x');
    const page = mail.text.match(/^Page : (.*)$/m)[1].replace(/\r$/, '');
    expect(page).toHaveLength(200);
  });
});

describe('POST /contact-panne', () => {
  it('answers like /contact and logs the attempt, but sends nothing', async () => {
    const env = makeEnv();
    const res = await call(env, '/contact-panne', { body: MESSAGE });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await contactLog()).toMatchObject([{ mode: 'panne', notified: 0, acked: 0 }]);
    expect(mails(env)).toEqual([]);
    expect(net.requests).toEqual([]);
  });

  it('validates the form like /contact', async () => {
    const res = await call(makeEnv(), '/contact-panne', { body: { ...MESSAGE, email: 'elodie' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_email' });
  });
});

describe('POST /contact and /contact-panne: honeypot', () => {
  it.each(['/contact', '/contact-panne'])('%s pretends success but logs and sends nothing when "website" is filled', async (path) => {
    const env = makeEnv();
    const res = await call(env, path, { body: { ...MESSAGE, website: 'https://spam.example' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await tableExists('contact_log')).toBe(false);
    expect(mails(env)).toEqual([]);
    expect(net.requests).toEqual([]);
  });

  it('answers a bot the same way even when the rest of the form is invalid', async () => {
    const res = await call(makeEnv(), '/contact', { body: { website: 'x' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('POST /contact and /contact-panne: rate limiting', () => {
  const send = (env, ip, path = '/contact-panne') => call(env, path, { body: MESSAGE, ip });
  const statuses = async (env, n, ip, path) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push((await send(env, ip, path)).status);
    return out;
  };
  const insertLog = (createdAt, ipHash) =>
    rows("INSERT INTO contact_log (created_at, ip_hash, mode) VALUES (?1, ?2, 'normal')", createdAt.toISOString(), ipHash);
  const ago = (ms) => new Date(Date.now() - ms);

  it('allows 5 messages per IP per hour, then answers 429 rate_limited', async () => {
    const env = makeEnv();
    expect(await statuses(env, 5, IP)).toEqual([200, 200, 200, 200, 200]);

    const res = await send(env, IP);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(await contactLog()).toHaveLength(5);
  });

  it('sends no email for a rate-limited message', async () => {
    const env = makeEnv();
    await statuses(env, 5, IP, '/contact');
    const res = await send(env, IP, '/contact');

    expect(res.status).toBe(429);
    expect(mails(env)).toHaveLength(5);
    expect(outbound('resend')).toHaveLength(5);
  });

  it('counts /contact and /contact-panne together', async () => {
    const env = makeEnv();
    await statuses(env, 3, IP, '/contact');
    expect(await statuses(env, 3, IP, '/contact-panne')).toEqual([200, 200, 429]);
  });

  it('limits each IP separately', async () => {
    const env = makeEnv();
    await statuses(env, 5, IP);
    expect((await send(env, IP)).status).toBe(429);
    expect((await send(env, '198.51.100.20')).status).toBe(200);
  });

  it('only counts the last hour for one IP', async () => {
    const env = makeEnv();
    await send(env, IP);
    const [{ ip_hash }] = await contactLog();
    for (let i = 0; i < 5; i++) await insertLog(ago(61 * 60_000), ip_hash);

    expect(await statuses(env, 5, IP)).toEqual([200, 200, 200, 200, 429]);
  });

  it('allows 100 messages per day across all IPs', async () => {
    const env = makeEnv();
    await send(env, IP);
    for (let i = 0; i < 99; i++) await insertLog(ago(23 * 3600_000), `other-ip-${i}`);

    expect((await send(env, '198.51.100.20')).status).toBe(429);
  });

  it('forgets log entries after 30 days', async () => {
    const env = makeEnv();
    await send(env, IP);
    await insertLog(ago(31 * 86_400_000), 'old-visitor');
    await insertLog(ago(29 * 86_400_000), 'recent-visitor');
    await send(env, IP);

    expect((await contactLog()).map((e) => e.ip_hash)).not.toContain('old-visitor');
    expect((await contactLog()).map((e) => e.ip_hash)).toContain('recent-visitor');
  });
});
