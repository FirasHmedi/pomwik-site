import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
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
        miniflare: { bindings: { TEST_SCHEMA: schema, TEST_UPGRADE: upgrade } },
      }),
    ],
    test: { setupFiles: ['./test/setup.js'] },
  };
});
