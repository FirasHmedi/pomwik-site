import { describe, expect, it, vi } from 'vitest';
import { call, makeEnv, mails, net, ORIGIN, outbound, rows, UUID_RE, WEBHOOK_URL } from './helpers.js';

const signups = () => rows('SELECT * FROM signups ORDER BY id');
const join = (env, body, opts) => call(env, '/waitlist', { body, ...opts });

describe('POST /waitlist: valid signup', () => {
  it('stores the signup and answers {ok: true}', async () => {
    const env = makeEnv();
    const res = await join(env, { email: '  Alice@Example.COM ', app: 'petty', a1: '  Labrador\n\tpuppy  ', a2: '', website: '' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const [row, ...others] = await signups();
    expect(others).toEqual([]);
    expect(row).toMatchObject({ email: 'alice@example.com', app: 'petty', answer: 'Labrador puppy', answer2: null, unsubscribed: 0 });
    expect(row.token).toMatch(UUID_RE);
    expect(new Date(row.created_at).toISOString()).toBe(row.created_at);
  });

  it.each(['petty', 'fieldwrite', 'settled'])('accepts the %s app', async (app) => {
    const res = await join(makeEnv(), { email: 'alice@example.com', app });
    expect(res.status).toBe(200);
    expect(await signups()).toMatchObject([{ app }]);
  });

  it('looks up the MX records of the email domain', async () => {
    await join(makeEnv(), { email: 'alice@mail.example.com', app: 'petty' });
    expect(outbound('dns')).toMatchObject([{ name: 'mail.example.com', type: 'MX', headers: { accept: 'application/dns-json' } }]);
  });

  it('notifies the owner through the send_email binding', async () => {
    const env = makeEnv();
    await join(env, { email: 'alice@example.com', app: 'fieldwrite', a1: 'Site visits', a2: 'Weekly' });

    const [mail, ...others] = mails(env);
    expect(others).toEqual([]);
    expect(mail).toMatchObject({ from: 'waitlist@pomwik.com', to: 'owner@example.com', subject: '[Fieldwrite] New signup: alice@example.com' });
    expect(mail.text).toContain('Email: alice@example.com');
    expect(mail.text).toContain('Answer 1: Site visits');
    expect(mail.text).toContain('Answer 2: Weekly');
    expect(mail.text).toContain('Total for Fieldwrite: 1');
    expect(await signups()).toMatchObject([{ owner_notified: 1 }]);
  });

  it('sends the welcome email through Resend, with a one-click unsubscribe link', async () => {
    await join(makeEnv(), { email: 'alice@example.com', app: 'settled' });

    const [{ token }] = await signups();
    const unsubscribe = `https://api.pomwik.com/unsubscribe?t=${token}`;
    const [welcome, ...others] = outbound('resend');
    expect(others).toEqual([]);
    expect(welcome.headers.authorization).toBe('Bearer re_test_key');
    expect(welcome.body).toMatchObject({
      from: 'Pomwik <hello@pomwik.com>',
      to: ['alice@example.com'],
      reply_to: 'hello@pomwik.com',
      subject: "You're on the Settled waitlist",
      headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    expect(welcome.body.text).toContain(`Unsubscribe: ${unsubscribe}`);
    expect(welcome.body.html).toContain(`href="${unsubscribe}"`);
    expect(await signups()).toMatchObject([{ welcome_sent: 1 }]);
  });

  it('sends the welcome email through the Apps Script webhook when there is no Resend key', async () => {
    const env = makeEnv({ RESEND_API_KEY: undefined, WELCOME_WEBHOOK_URL: WEBHOOK_URL, WELCOME_WEBHOOK_SECRET: 'hook-secret' });
    await join(env, { email: 'alice@example.com', app: 'petty' });

    expect(outbound('resend')).toEqual([]);
    expect(outbound('webhook')).toMatchObject([
      { body: { secret: 'hook-secret', to: 'alice@example.com', subject: "You're on the Petty waitlist" } },
    ]);
    expect(await signups()).toMatchObject([{ welcome_sent: 1 }]);
  });

  it('keeps both emails pending when no sender is configured', async () => {
    const env = makeEnv({ OWNER_EMAIL: undefined, RESEND_API_KEY: undefined });
    const res = await join(env, { email: 'alice@example.com', app: 'petty' });

    expect(res.status).toBe(200);
    expect(mails(env)).toEqual([]);
    expect(outbound('resend')).toEqual([]);
    expect(await signups()).toMatchObject([{ owner_notified: 0, welcome_sent: 0 }]);
  });

  it('keeps the welcome email pending when Resend fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    net.resend = () => new Response('{"message":"rate limited"}', { status: 429 });
    const res = await join(makeEnv(), { email: 'alice@example.com', app: 'petty' });

    expect(res.status).toBe(200);
    expect(await signups()).toMatchObject([{ owner_notified: 1, welcome_sent: 0 }]);
    expect(log).toHaveBeenCalledWith('resend failed', 429, expect.any(String));
  });
});

describe('POST /waitlist: duplicate signup', () => {
  it('answers exactly like a new signup and keeps one row', async () => {
    const env = makeEnv();
    const first = await join(env, { email: 'alice@example.com', app: 'petty', a1: 'First' });
    const second = await join(env, { email: ' ALICE@example.com', app: 'petty', a1: 'Second' });

    expect(second.status).toBe(first.status);
    expect(await second.text()).toBe(await first.text());
    expect(await signups()).toMatchObject([{ email: 'alice@example.com', answer: 'First' }]);
  });

  it('does not send the emails again', async () => {
    const env = makeEnv();
    await join(env, { email: 'alice@example.com', app: 'petty' });
    await join(env, { email: 'alice@example.com', app: 'petty' });

    expect(mails(env)).toHaveLength(1);
    expect(outbound('resend')).toHaveLength(1);
  });

  it('accepts the same email on another app', async () => {
    const env = makeEnv();
    await join(env, { email: 'alice@example.com', app: 'petty' });
    await join(env, { email: 'alice@example.com', app: 'settled' });

    expect(await signups()).toMatchObject([{ app: 'petty' }, { app: 'settled' }]);
  });
});

describe('POST /waitlist: invalid input', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a string', 42],
    ['without @', 'alice.example.com'],
    ['without a dot in the domain', 'alice@localhost'],
    ['with an empty domain label', 'alice@example..com'],
    ['with a space', 'alice smith@example.com'],
    ['with two @', 'alice@bob@example.com'],
    ['with a local part over 64 characters', `${'a'.repeat(65)}@example.com`],
    ['over 254 characters', `alice@${'a'.repeat(250)}.com`],
  ])('rejects an email %s with 400 invalid_email', async (_, email) => {
    const res = await join(makeEnv(), { email, app: 'petty' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_email' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(outbound('dns')).toEqual([]);
    expect(await signups()).toEqual([]);
  });

  it.each([undefined, 'unknown', 'toString', '__proto__'])('rejects the app %j with 400 invalid_app', async (app) => {
    const res = await join(makeEnv(), { email: 'alice@example.com', app });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_app' });
    expect(await signups()).toEqual([]);
  });

  it('rejects malformed JSON with 400 bad_json', async () => {
    const res = await join(makeEnv(), '{"email": "alice@example.com",');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_json' });
  });

  it('rejects a body over 2048 characters with 413', async () => {
    const res = await join(makeEnv(), { email: 'alice@example.com', app: 'petty', a1: 'x'.repeat(2048) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
    expect(await signups()).toEqual([]);
  });

  // Known bug, see the PR description: the body `null` is valid JSON, and reading `data.website` on it throws.
  it.skip('BUG: answers 400 to a JSON null body instead of throwing', async () => {
    const res = await join(makeEnv(), 'null');
    expect(res.status).toBe(400);
  });
});

describe('POST /waitlist: email domain check', () => {
  const rejects = async (zone) => {
    net.dns.set('example.net', zone);
    const res = await join(makeEnv(), { email: 'alice@example.net', app: 'petty' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_domain' });
    expect(await signups()).toEqual([]);
  };
  const accepts = async (zone) => {
    net.dns.set('example.net', zone);
    const res = await join(makeEnv(), { email: 'alice@example.net', app: 'petty' });
    expect(res.status).toBe(200);
    expect(await signups()).toHaveLength(1);
  };

  it('rejects a domain with no MX, A or AAAA record', async () => {
    await rejects({ MX: [], A: [], AAAA: [] });
    expect(outbound('dns').map((q) => q.type)).toEqual(['MX', 'A', 'AAAA']);
  });

  it('rejects a domain that does not exist (NXDOMAIN)', async () => {
    await rejects({ status: 3 });
    expect(outbound('dns').map((q) => q.type)).toEqual(['MX']);
  });

  it('rejects a domain whose only MX is the null MX "0 ."', async () => {
    await rejects({ MX: ['0 .'] });
  });

  it('accepts a domain with no MX but an A record (implicit MX)', async () => {
    await accepts({ A: ['192.0.2.10'] });
  });

  it('accepts a domain with no MX but an AAAA record (implicit MX)', async () => {
    await accepts({ AAAA: ['2001:db8::10'] });
  });

  it('accepts the signup when the DNS server answers with an HTTP error (fails open)', async () => {
    await accepts('http-error');
  });

  it('accepts the signup when the DNS server is unreachable (fails open)', async () => {
    await accepts('unreachable');
  });

  // Known bug, see the PR description: SERVFAIL comes back as HTTP 200 with Status 2 and no answers,
  // so it reads as "no records" and the signup is refused, although the code means to fail open on lookup failures.
  it.skip('BUG: accepts the signup when the resolver answers SERVFAIL (fails open)', async () => {
    await accepts({ status: 2 });
  });
});

describe('POST /waitlist: honeypot', () => {
  it('pretends success but stores and sends nothing when the hidden "website" field is filled', async () => {
    const env = makeEnv();
    const res = await join(env, { email: 'alice@example.com', app: 'petty', website: 'https://spam.example' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await signups()).toEqual([]);
    expect(net.requests).toEqual([]);
    expect(mails(env)).toEqual([]);
  });

  it('answers a bot the same way even when the rest of the form is invalid', async () => {
    const res = await join(makeEnv(), { email: 'nope', app: 'nope', website: 'x' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
