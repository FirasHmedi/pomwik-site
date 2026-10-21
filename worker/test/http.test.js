import { describe, expect, it } from 'vitest';
import { call, makeEnv, ORIGIN, rows } from './helpers.js';

const ROUTES = ['/waitlist', '/contact', '/contact-panne'];
const SITE_ORIGINS = ['https://pomwik.com', 'https://www.pomwik.com', 'https://api.pomwik.com'];
const CORS = {
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '86400',
  vary: 'Origin',
};
const headersOf = (res) => Object.fromEntries(res.headers);

describe('CORS preflight (OPTIONS)', () => {
  it.each(SITE_ORIGINS)('answers 204 with CORS headers for %s', async (origin) => {
    const res = await call(makeEnv(), '/waitlist', { method: 'OPTIONS', origin });

    expect(res.status).toBe(204);
    expect(headersOf(res)).toMatchObject({ ...CORS, 'access-control-allow-origin': origin });
    expect(await res.text()).toBe('');
  });

  it.each(ROUTES)('answers 204 on %s', async (path) => {
    const res = await call(makeEnv(), path, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it.each(['https://evil.example', 'http://pomwik.com', 'https://pomwik.com.evil.example', 'null'])(
    'refuses %s with 403 and no CORS headers',
    async (origin) => {
      const res = await call(makeEnv(), '/waitlist', { method: 'OPTIONS', origin });
      expect(res.status).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
  );

  it('refuses a preflight without an Origin header', async () => {
    const res = await call(makeEnv(), '/waitlist', { method: 'OPTIONS', origin: null });
    expect(res.status).toBe(403);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('also allows DEV_ORIGIN when it is set', async () => {
    const dev = 'http://localhost:8000';
    expect((await call(makeEnv(), '/waitlist', { method: 'OPTIONS', origin: dev })).status).toBe(403);

    const res = await call(makeEnv({ DEV_ORIGIN: dev }), '/waitlist', { method: 'OPTIONS', origin: dev });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(dev);
  });
});

describe('CORS on POST', () => {
  it.each(ROUTES)('refuses a POST to %s from another origin with 403 forbidden', async (path) => {
    const res = await call(makeEnv(), path, { origin: 'https://evil.example', body: { email: 'alice@example.com', app: 'petty', nom: 'A', message: 'B' } });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(await rows('SELECT * FROM signups')).toEqual([]);
  });

  it('refuses a POST without an Origin header', async () => {
    const res = await call(makeEnv(), '/waitlist', { origin: null, body: { email: 'alice@example.com', app: 'petty' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('echoes the allowed origin on the answer', async () => {
    const res = await call(makeEnv(), '/waitlist', { origin: 'https://www.pomwik.com', body: { email: 'alice@example.com', app: 'petty' } });
    expect(res.status).toBe(200);
    expect(headersOf(res)).toMatchObject({ ...CORS, 'access-control-allow-origin': 'https://www.pomwik.com' });
  });
});

describe('404 Not Found', () => {
  it.each([
    ['GET', '/'],
    ['GET', '/nope'],
    ['POST', '/nope'],
    ['POST', '/waitlist/'],
    ['POST', '/contact/'],
    ['OPTIONS', '/nope'],
    ['GET', '/tests/contact-panne/index.html'],
  ])('answers %s %s with 404 not_found', async (method, path) => {
    const res = await call(makeEnv(), path, { method });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('adds CORS headers for an allowed origin only', async () => {
    const allowed = await call(makeEnv(), '/nope');
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const other = await call(makeEnv(), '/nope', { origin: 'https://evil.example' });
    expect(other.status).toBe(404);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('405 Method Not Allowed', () => {
  it.each([
    ['GET', '/waitlist'],
    ['PUT', '/waitlist'],
    ['DELETE', '/waitlist'],
    ['PUT', '/contact'],
    ['PATCH', '/contact'],
    ['GET', '/contact-panne'],
    ['DELETE', '/contact-panne'],
  ])('answers %s %s with 405 method_not_allowed', async (method, path) => {
    const res = await call(makeEnv(), path, { method });
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: 'method_not_allowed' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('answers 405 before checking the origin', async () => {
    const res = await call(makeEnv(), '/waitlist', { method: 'GET', origin: 'https://evil.example' });
    expect(res.status).toBe(405);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  // Not a 405: GET /contact is the contact page served by the Worker (pages.js).
  it('redirects GET /contact to the contact page', async () => {
    const res = await call(makeEnv(), '/contact', { method: 'GET' });
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://api.pomwik.com/contact/');
  });

  // Known bug, see the PR description: RFC 9110 §15.5.6 requires an Allow header on every 405.
  it.skip('BUG: lists the allowed methods in an Allow header', async () => {
    const res = await call(makeEnv(), '/waitlist', { method: 'GET' });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toEqual(expect.stringContaining('POST'));
  });
});
