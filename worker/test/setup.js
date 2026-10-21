import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { installNetMock, outbound } from './helpers.js';

// Stand-in for the runtime's EmailMessage that keeps the raw MIME, so tests can read the emails back.
vi.mock('cloudflare:email', () => ({
  EmailMessage: class EmailMessage {
    constructor(from, to, raw) {
      Object.assign(this, { from, to, raw });
    }
  },
}));

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_SCHEMA);
  installNetMock();
});

afterEach(async () => {
  const unexpected = outbound('unexpected');
  vi.restoreAllMocks();
  await reset();
  expect(unexpected, 'outbound requests with no mock').toEqual([]);
});
