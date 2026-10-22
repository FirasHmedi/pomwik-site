import { describe, expect, it, vi } from 'vitest';
import { call, makeEnv, net, outbound, rows } from './helpers.js';

const TOKEN = 'test-read-token';
const ALLOW = 'firas@pomwik.example,@agence-exemple.fr';
const env = (overrides = {}) => makeEnv({ MAIL_READ_TOKEN: TOKEN, NOTIFY_ALLOW: ALLOW, ...overrides });
const BODY = { to: ['contact@agence-exemple.fr'], subject: '[Pomwik] Formulaire en panne', text: 'Le formulaire de contact ne répond plus.', kind: 'alerte' };
const notify = (testEnv, body = BODY, { token = TOKEN, method = 'POST' } = {}) =>
  call(testEnv, '/notify', { method, origin: null, body: method === 'POST' ? body : undefined, headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe('POST /notify', () => {
  it('sends the e-mail through Resend and answers { ok, id }', async () => {
    const res = await notify(env(), { ...BODY, to: ['Contact@Agence-Exemple.fr', 'firas@pomwik.example'], html: '<p>Le formulaire ne répond plus.</p>' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 'test-email-id' });
    const [mail, ...others] = outbound('resend');
    expect(others).toEqual([]);
    expect(mail.headers.authorization).toBe('Bearer re_test_key');
    expect(mail.body).toEqual({
      from: 'Pomwik <hello@pomwik.com>',
      to: ['contact@agence-exemple.fr', 'firas@pomwik.example'],
      reply_to: 'hello@pomwik.com',
      subject: '[Pomwik] Formulaire en panne',
      text: 'Le formulaire de contact ne répond plus.',
      html: '<p>Le formulaire ne répond plus.</p>',
      headers: { 'X-Pomwik-Kind': 'alerte' },
    });
    expect(await rows('SELECT kind, to_count FROM notify_log')).toEqual([{ kind: 'alerte', to_count: 2 }]);
  });

  it('sends a weekly summary without html', async () => {
    const res = await notify(env(), { ...BODY, kind: 'recap' });
    expect(res.status).toBe(200);
    const [mail] = outbound('resend');
    expect(mail.body.headers).toEqual({ 'X-Pomwik-Kind': 'recap' });
    expect(mail.body).not.toHaveProperty('html');
  });

  it.each([
    ['no token', null],
    ['a wrong token', 'wrong-token'],
  ])('answers 401 with %s', async (_, token) => {
    const res = await notify(env(), BODY, { token });
    expect(res.status).toBe(401);
    expect(outbound('resend')).toEqual([]);
  });

  it('answers 401 when MAIL_READ_TOKEN is not set', async () => {
    const res = await notify(env({ MAIL_READ_TOKEN: undefined }));
    expect(res.status).toBe(401);
  });

  it.each(['GET', 'PUT', 'DELETE'])('answers %s with 405', async (method) => {
    const res = await notify(env(), BODY, { method });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });

  it.each([
    ['no recipient', { to: [] }],
    ['more than 5 recipients', { to: Array.from({ length: 6 }, (_, i) => `a${i}@agence-exemple.fr`) }],
    ['a recipient that is not an address', { to: ['agence-exemple.fr'] }],
    ['to as a string', { to: 'contact@agence-exemple.fr' }],
    ['a subject over 200 characters', { subject: 'x'.repeat(201) }],
    ['a subject on two lines', { subject: 'Alerte\r\nBcc: x@y.fr' }],
    ['an empty text', { text: '' }],
    ['a text over 50 000 characters', { text: 'x'.repeat(50_001) }],
    ['an html over 200 000 characters', { html: 'x'.repeat(200_001) }],
    ['an unknown kind', { kind: 'promo' }],
  ])('answers 400 for %s', async (_, change) => {
    const res = await notify(env(), { ...BODY, ...change });
    expect(res.status).toBe(400);
    expect(outbound('resend')).toEqual([]);
  });

  it('answers 400 for malformed JSON', async () => {
    const res = await notify(env(), '{"to": [');
    expect(res.status).toBe(400);
  });

  it('answers 403 and sends nothing when one recipient is not in NOTIFY_ALLOW', async () => {
    const res = await notify(env(), { ...BODY, to: ['contact@agence-exemple.fr', 'someone@other.example'] });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'recipient_not_allowed', count: 1 });
    expect(outbound('resend')).toEqual([]);
  });

  it('does not take a look-alike domain for an allowed one', async () => {
    const res = await notify(env(), { ...BODY, to: ['contact@fake-agence-exemple.fr'] });
    expect(res.status).toBe(403);
  });

  it('answers 503 « envoi désactivé » without NOTIFY_ALLOW', async () => {
    const res = await notify(env({ NOTIFY_ALLOW: undefined }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ message: 'envoi désactivé' });
    expect(outbound('resend')).toEqual([]);
  });

  it('answers 502 when Resend refuses the e-mail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    net.resend = () => new Response('{"message":"invalid from"}', { status: 422 });
    const res = await notify(env());
    expect(res.status).toBe(502);
    expect(await rows('SELECT * FROM notify_log')).toEqual([]);
  });

  it('allows 50 e-mails per hour, then answers 429', async () => {
    const testEnv = env();
    await notify(testEnv);
    const now = Date.now();
    for (let i = 0; i < 48; i++) await rows("INSERT INTO notify_log (at, kind, to_count) VALUES (?1, 'alerte', 1)", now - 60_000);
    await rows("INSERT INTO notify_log (at, kind, to_count) VALUES (?1, 'alerte', 1)", now - 2 * 3_600_000);
    expect((await notify(testEnv)).status).toBe(200); // 50e envoi de l'heure

    const res = await notify(testEnv);
    expect(res.status).toBe(429);
    expect(outbound('resend')).toHaveLength(2);
  });
});
