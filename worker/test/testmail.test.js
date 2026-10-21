import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { call, makeEnv, receive, rows } from './helpers.js';

const TOKEN = 'test-read-token';
const DAY = 86_400_000;
const ADDRESS = 't.pomwik-lavande-abc123@pomwik.com';

// A raw email as a site's mail server would send it.
function rawEmail({ to = ADDRESS, from = 'Boutique Lavande <shop@lavande.example>', subject = 'Nouveau message', type = 'text/plain', body = 'Bonjour' } = {}) {
  return [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', `Content-Type: ${type}; charset=utf-8`, '', body].join('\r\n');
}

const tableExists = async (name) => (await rows("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1", name)).length > 0;
// The table is created by the first stored email, so a rejected one leaves no table at all.
const stored = async () => ((await tableExists('test_mail')) ? rows('SELECT * FROM test_mail ORDER BY id') : []);
const readMail = (testEnv, query, { token = TOKEN, method = 'GET' } = {}) =>
  call(testEnv, `/mail?${new URLSearchParams(query)}`, { method, origin: null, headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe('email handler (test inboxes t.<tag>@pomwik.com)', () => {
  it('stores the sender, decoded subject, text, links and authentication results', async () => {
    const message = await receive(makeEnv(), {
      to: ADDRESS,
      raw: rawEmail({
        from: '=?UTF-8?Q?Boutique_Lavande_&_Co?= <shop@lavande.example>',
        subject: '=?UTF-8?B?W1RFU1RdIE5vdXZlYXUgbWVzc2FnZSDDqXTDqQ==?=',
        body: 'Réf. pomwik-lavande-abc123. Voir https://lavande.example/compte?x=1 .',
      }),
      headers: { 'Authentication-Results': 'mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass' },
    });

    expect(message.setReject).not.toHaveBeenCalled();
    expect(message.forward).not.toHaveBeenCalled();
    const [mail, ...others] = await stored();
    expect(others).toEqual([]);
    expect(mail).toMatchObject({
      to_addr: ADDRESS,
      from_addr: 'Boutique Lavande & Co <shop@lavande.example>',
      subject: '[TEST] Nouveau message été',
      auth: 'mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass',
    });
    expect(mail.text).toContain('Réf. pomwik-lavande-abc123');
    expect(JSON.parse(mail.links)).toEqual(['https://lavande.example/compte?x=1']);
  });

  it('matches the address whatever its case', async () => {
    const message = await receive(makeEnv(), { to: 'T.Pomwik-Lavande-ABC123@POMWIK.com', raw: rawEmail() });
    expect(message.setReject).not.toHaveBeenCalled();
    expect(await stored()).toMatchObject([{ to_addr: ADDRESS }]);
  });

  it('turns an HTML-only email into text and keeps where each link points', async () => {
    const html =
      '<html><head><style>p { color: red }</style></head><body><p>Bonjour&nbsp;!</p>' +
      '<p><a class="btn" href="https://site.example/reset?a=1&amp;b=2"><span>Réinitialiser</span></a></p></body></html>';
    await receive(makeEnv(), { to: 't.acct-site-example@pomwik.com', raw: rawEmail({ type: 'text/html', body: html }) });

    const [mail] = await stored();
    expect(mail.text).toBe('Bonjour !\nRéinitialiser (https://site.example/reset?a=1&b=2)');
    expect(JSON.parse(mail.links)).toEqual(['https://site.example/reset?a=1&b=2']);
  });

  it.each(['contact@pomwik.com', 'hello@pomwik.com', 't.@pomwik.com', 't.pomwik-x@other.example', 't.pomwik x@pomwik.com'])(
    'rejects mail to %s, like the old catch-all, and stores nothing',
    async (to) => {
      const message = await receive(makeEnv(), { to, raw: rawEmail({ to }) });
      expect(message.setReject).toHaveBeenCalledWith('Address does not exist');
      expect(message.forward).not.toHaveBeenCalled();
      expect(await stored()).toEqual([]);
    }
  );

  it('rejects a message over 2 MB without storing it', async () => {
    const message = await receive(makeEnv(), { to: ADDRESS, raw: rawEmail(), rawSize: 2_000_001 });
    expect(message.setReject).toHaveBeenCalledWith('Message too large');
    expect(await stored()).toEqual([]);
  });

  it('rejects new mail once 1000 test emails arrived in the last 24 hours', async () => {
    await receive(makeEnv(), { to: ADDRESS, raw: rawEmail() });
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 999)
       INSERT INTO test_mail (received_at, to_addr) SELECT ?1, 't.bulk@pomwik.com' FROM n`
    )
      .bind(Date.now() - 60_000)
      .run();

    const message = await receive(makeEnv(), { to: ADDRESS, raw: rawEmail() });
    expect(message.setReject).toHaveBeenCalledWith('Mailbox full, try again tomorrow');
    expect(await rows('SELECT COUNT(*) AS n FROM test_mail')).toEqual([{ n: 1000 }]);
  });

  it('deletes test emails older than 30 days when a new one arrives', async () => {
    await receive(makeEnv(), { to: ADDRESS, raw: rawEmail({ subject: 'Premier' }) });
    await env.DB.prepare("INSERT INTO test_mail (received_at, to_addr, subject) VALUES (?1, ?2, 'Ancien')").bind(Date.now() - 31 * DAY, ADDRESS).run();

    await receive(makeEnv(), { to: ADDRESS, raw: rawEmail({ subject: 'Deuxième' }) });
    expect((await stored()).map((m) => m.subject)).toEqual(['Premier', 'Deuxième']);
  });
});

describe('GET /mail', () => {
  const testEnv = () => makeEnv({ MAIL_READ_TOKEN: TOKEN });

  it('returns the emails of one test address since a time, oldest first', async () => {
    const mailEnv = testEnv();
    await receive(mailEnv, { to: ADDRESS, raw: rawEmail({ subject: 'Un', body: 'Voir https://lavande.example/a' }) });
    await receive(mailEnv, { to: ADDRESS, raw: rawEmail({ subject: 'Deux' }) });
    await receive(mailEnv, { to: 't.own-autre-site@pomwik.com', raw: rawEmail({ subject: 'Autre site' }) });

    const res = await readMail(mailEnv, { to: ADDRESS, since: Date.now() - 60_000 });

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const { messages } = await res.json();
    expect(messages.map((m) => m.subject)).toEqual(['Un', 'Deux']);
    expect(messages[0]).toMatchObject({ from: 'Boutique Lavande <shop@lavande.example>', links: ['https://lavande.example/a'], auth: null });
    expect(messages[0].receivedAt).toEqual(expect.any(Number));
  });

  it('leaves out emails received before `since`', async () => {
    const mailEnv = testEnv();
    await receive(mailEnv, { to: ADDRESS, raw: rawEmail() });
    const res = await readMail(mailEnv, { to: ADDRESS, since: Date.now() + 60_000 });
    expect(await res.json()).toEqual({ messages: [] });
  });

  it('accepts the address in any case', async () => {
    const mailEnv = testEnv();
    await receive(mailEnv, { to: ADDRESS, raw: rawEmail() });
    const { messages } = await (await readMail(mailEnv, { to: ADDRESS.toUpperCase(), since: 0 })).json();
    expect(messages).toHaveLength(1);
  });

  it.each([
    ['a wrong token', 'not-the-token'],
    ['no token', null],
  ])('answers 401 with %s', async (_, token) => {
    const mailEnv = testEnv();
    await receive(mailEnv, { to: ADDRESS, raw: rawEmail() });
    const res = await readMail(mailEnv, { to: ADDRESS, since: 0 }, { token });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('answers 404 when MAIL_READ_TOKEN is not set', async () => {
    const res = await readMail(makeEnv(), { to: ADDRESS, since: 0 });
    expect(res.status).toBe(404);
  });

  it('answers 404 to anything but GET', async () => {
    const res = await readMail(testEnv(), { to: ADDRESS, since: 0 }, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it.each(['contact@pomwik.com', 't.x@other.example', ''])('answers 400 for the address %j', async (to) => {
    const res = await readMail(testEnv(), { to, since: 0 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_address' });
  });
});
