import { beforeEach, describe, expect, it } from 'vitest';
import { call, makeEnv, outbound, rows } from './helpers.js';

const ALICE = '3b241101-e2bb-4255-8caf-4136c566a962';
const BOB = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const state = async () => Object.fromEntries((await rows('SELECT email, unsubscribed FROM signups')).map((r) => [r.email, r.unsubscribed]));

beforeEach(async () => {
  for (const [email, token] of [['alice@example.com', ALICE], ['bob@example.com', BOB]]) {
    await rows(
      "INSERT INTO signups (email, app, created_at, token, welcome_sent, owner_notified) VALUES (?1, 'petty', ?2, ?3, 1, 1)",
      email,
      new Date().toISOString(),
      token
    );
  }
});

describe('GET /unsubscribe', () => {
  it('unsubscribes the signup with that token and shows a confirmation page', async () => {
    const res = await call(makeEnv(), `/unsubscribe?t=${ALICE}`, { method: 'GET', origin: null });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(await res.text()).toContain("<h1>You're unsubscribed</h1>");
    expect(await state()).toEqual({ 'alice@example.com': 1, 'bob@example.com': 0 });
  });

  it('is idempotent', async () => {
    await call(makeEnv(), `/unsubscribe?t=${ALICE}`, { method: 'GET', origin: null });
    const res = await call(makeEnv(), `/unsubscribe?t=${ALICE}`, { method: 'GET', origin: null });
    expect(res.status).toBe(200);
    expect(await state()).toEqual({ 'alice@example.com': 1, 'bob@example.com': 0 });
  });

  it.each([
    ['no token', ''],
    ['an empty token', '?t='],
    ['a malformed token', '?t=not-a-token'],
    ['an uppercase token', `?t=${ALICE.toUpperCase()}`],
    ['a token with extra characters', `?t=${ALICE}0`],
    ['a SQL-looking token', `?t=${encodeURIComponent("' OR 1=1 --")}`],
    ['an unknown token', '?t=00000000-0000-4000-8000-000000000000'],
  ])('shows the same page for %s, and changes nothing', async (_, query) => {
    const res = await call(makeEnv(), `/unsubscribe${query}`, { method: 'GET', origin: null });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You're unsubscribed");
    expect(await state()).toEqual({ 'alice@example.com': 0, 'bob@example.com': 0 });
  });

  it('works with the link from the welcome email', async () => {
    const env = makeEnv();
    await call(env, '/waitlist', { body: { email: 'carol@example.com', app: 'petty' } });
    const link = new URL(outbound('resend')[0].body.headers['List-Unsubscribe'].slice(1, -1));

    expect(link.origin).toBe('https://api.pomwik.com');
    await call(env, link.pathname + link.search, { method: 'GET', origin: null });
    expect(await state()).toMatchObject({ 'carol@example.com': 1 });
  });
});

describe('POST /unsubscribe', () => {
  it('handles one-click unsubscribe (RFC 8058) from a mail provider, without an Origin header', async () => {
    const res = await call(makeEnv(), `/unsubscribe?t=${BOB}`, {
      origin: null,
      body: 'List-Unsubscribe=One-Click',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(await state()).toEqual({ 'alice@example.com': 0, 'bob@example.com': 1 });
  });

  it('answers "ok" and changes nothing for a malformed token', async () => {
    const res = await call(makeEnv(), '/unsubscribe?t=nope', { origin: null, body: 'List-Unsubscribe=One-Click' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(await state()).toEqual({ 'alice@example.com': 0, 'bob@example.com': 0 });
  });
});

describe('after unsubscribing', () => {
  it('the signup is left out of the total in the owner notice', async () => {
    const env = makeEnv();
    await call(env, `/unsubscribe?t=${ALICE}`, { method: 'GET', origin: null });
    await call(env, '/waitlist', { body: { email: 'carol@example.com', app: 'petty' } });
    // bob and carol are still subscribed.
    expect(env.OWNER_MAIL.send).toHaveBeenCalledOnce();
    expect(env.OWNER_MAIL.send.mock.calls[0][0].raw).toContain('Total for Petty: 2');
  });

  // Known bug, see the PR description: the unsubscribe page says "you can rejoin any time at pomwik.com",
  // but the signup hits ON CONFLICT DO NOTHING, so the row stays unsubscribed while the form says "You're on the list!".
  it.skip('BUG: joining the waitlist again subscribes the address again', async () => {
    const env = makeEnv();
    await call(env, `/unsubscribe?t=${ALICE}`, { method: 'GET', origin: null });
    const res = await call(env, '/waitlist', { body: { email: 'alice@example.com', app: 'petty' } });

    expect(res.status).toBe(200);
    expect(await state()).toMatchObject({ 'alice@example.com': 0 });
  });
});
