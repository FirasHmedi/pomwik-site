import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const dir = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(async () => {
  // A fresh database is built from schema.sql; an old one is upgraded by migrations/ (see test/schema.test.js).
  const schema = (await readD1Migrations(dir('.'))).filter((m) => m.name === 'schema.sql');
  const upgrade = [...(await readD1Migrations(dir('test/fixtures'))), ...(await readD1Migrations(dir('migrations')))];

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          // The workerd bundled with @cloudflare/vitest-pool-workers stops at this date; wrangler.toml asks for 2026-09-01.
          compatibilityDate: '2026-08-22',
          bindings: { TEST_SCHEMA: schema, TEST_UPGRADE: upgrade },
        },
      }),
    ],
    test: { setupFiles: ['./test/setup.js'] },
  };
});
