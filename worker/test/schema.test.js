import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { rows } from './helpers.js';

// Columns and indexes of the signups table, in a form that ignores column order.
async function describeSignups() {
  const columns = Object.fromEntries(
    (await rows('PRAGMA table_info(signups)')).map(({ name, type, notnull, dflt_value, pk }) => [name, { type, notnull, dflt_value, pk }])
  );
  const indexes = {};
  for (const { name, unique } of await rows('PRAGMA index_list(signups)')) {
    indexes[name] = { unique, columns: (await rows(`PRAGMA index_info(${name})`)).map((c) => c.name) };
  }
  return { columns, indexes };
}

it('migrations/ bring the first deployed schema up to schema.sql', async () => {
  const fresh = await describeSignups(); // setup.js built this database from schema.sql

  await reset();
  await applyD1Migrations(env.DB, env.TEST_UPGRADE); // test/fixtures/0001_initial.sql, then migrations/*.sql

  expect(await describeSignups()).toEqual(fresh);
  expect(Object.keys(fresh.columns)).toContain('unsubscribed');
});
