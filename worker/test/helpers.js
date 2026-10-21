import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { vi } from 'vitest';
import worker from '../src/index.js';

export const ORIGIN = 'https://pomwik.com';
export const IP = '203.0.113.7';
export const WEBHOOK_URL = 'https://script.google.com/macros/s/test-deployment/exec';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---------- calling the Worker ----------

// Bindings and secrets for one test. OWNER_MAIL stands in for the send_email binding, so no email leaves the test.
export function makeEnv(overrides = {}) {
  return {
    ...env,
    OWNER_EMAIL: 'owner@example.com',
    RESEND_API_KEY: 're_test_key',
    OWNER_MAIL: { send: vi.fn(async () => {}) },
    ...overrides,
  };
}

// Sends one request to the Worker, then waits for everything it handed to ctx.waitUntil (the emails).
export async function call(testEnv, path, { method = 'POST', origin = ORIGIN, ip = IP, body, headers = {} } = {}) {
  const h = new Headers(headers);
  if (origin) h.set('Origin', origin);
  if (ip) h.set('CF-Connecting-IP', ip);
  if (body !== undefined && typeof body !== 'string') {
    body = JSON.stringify(body);
    if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
  }
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`https://api.pomwik.com${path}`, { method, headers: h, body }), testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

// ---------- outbound network ----------

// Answers every fetch the Worker makes: DNS-over-HTTPS lookups, Resend and the Apps Script webhook.
// Tests change the answers through `net`; anything else is recorded as unexpected and fails the test (see setup.js).
export const net = { requests: [], dns: new Map(), resend: null, webhook: null };

const RR_TYPES = { A: 1, MX: 15, AAAA: 28 };

// A zone is { status, MX, A, AAAA } (record data strings), 'http-error' or 'unreachable'.
// Domains with no zone set get one MX record.
function answerDns(url) {
  const name = url.searchParams.get('name');
  const type = url.searchParams.get('type');
  const zone = net.dns.get(name) ?? { MX: [`10 mx.${name}.`] };
  if (zone === 'http-error') return new Response('upstream error', { status: 502 });
  if (zone === 'unreachable') throw new TypeError('Network connection lost.');
  const out = { Status: zone.status ?? 0, Question: [{ name: `${name}.`, type: RR_TYPES[type] }] };
  const records = zone[type] ?? [];
  if (records.length) out.Answer = records.map((data) => ({ name: `${name}.`, type: RR_TYPES[type], TTL: 300, data }));
  return Response.json(out, { headers: { 'Content-Type': 'application/dns-json' } });
}

export function installNetMock() {
  net.requests = [];
  net.dns = new Map();
  net.resend = () => Response.json({ id: 'test-email-id' });
  net.webhook = () => Response.json({ ok: true });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const record = { method: req.method, url: req.url, headers: Object.fromEntries(req.headers) };
    if (url.origin === 'https://cloudflare-dns.com' && url.pathname === '/dns-query') {
      net.requests.push({ ...record, kind: 'dns', name: url.searchParams.get('name'), type: url.searchParams.get('type') });
      return answerDns(url);
    }
    const text = req.method === 'GET' ? '' : await req.text();
    if (req.url === 'https://api.resend.com/emails') {
      net.requests.push({ ...record, kind: 'resend', body: JSON.parse(text) });
      return net.resend();
    }
    if (req.url === WEBHOOK_URL) {
      net.requests.push({ ...record, kind: 'webhook', body: JSON.parse(text) });
      return net.webhook();
    }
    net.requests.push({ ...record, kind: 'unexpected', text });
    throw new Error(`unexpected outbound fetch: ${req.method} ${req.url}`);
  });
}

export const outbound = (kind) => net.requests.filter((r) => r.kind === kind);

// ---------- emails given to the send_email binding ----------

const decodeWords = (v) =>
  v.replace(/\?=\s+=\?/g, '?==?').replace(/=\?utf-8\?B\?([^?]*)\?=/gi, (_, b64) => Buffer.from(b64, 'base64').toString('utf8'));

// mimetext ends header lines with os.EOL ("\n" in workerd), so accept both line endings.
function parseMime(raw) {
  const [head] = raw.split(/\r?\n\r?\n/, 1);
  const headers = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    headers[line.slice(0, i).toLowerCase()] = decodeWords(line.slice(i + 1).trim());
  }
  let text = raw.slice(head.length).replace(/^\r?\n\r?\n/, '');
  if (/base64/i.test(headers['content-transfer-encoding'] || '')) text = Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8');
  return { headers, subject: headers.subject, text };
}

// Each email the Worker sent through OWNER_MAIL, with its envelope and parsed content.
export const mails = (testEnv) =>
  testEnv.OWNER_MAIL.send.mock.calls.map(([m]) => ({ from: m.from, to: m.to, ...parseMime(m.raw) }));

// ---------- database ----------

export async function rows(sql, ...params) {
  return (await env.DB.prepare(sql).bind(...params).all()).results;
}
