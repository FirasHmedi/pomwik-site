# pomwik-waitlist

Cloudflare Worker + D1 that stores waitlist signups from pomwik.com at `POST https://api.pomwik.com/waitlist`.

Export signups:

    npx wrangler d1 execute pomwik-waitlist --remote --command "SELECT app, email, created_at FROM signups ORDER BY created_at"

Delete one person's data:

    npx wrangler d1 execute pomwik-waitlist --remote --command "DELETE FROM signups WHERE email = 'someone@example.com'"

Run the tests (Vitest inside the Workers runtime, with a local D1 built from `schema.sql`; no email or DNS request leaves the machine):

    npm install
    npm test

A fresh database only needs `schema.sql`; `migrations/` upgrades a database created before those columns existed. `test/schema.test.js` checks that both give the same table.
