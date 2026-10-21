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

## Contact pages

`src/pages.js` serves copies of `contact/index.html` and `tests/contact-panne/index.html` on api.pomwik.com, with `contact.js` inlined and links pointing to https://pomwik.com. It is generated, so don't edit it by hand. After changing any of those three files, run from `worker/`:

    npm run build:pages

To check that `src/pages.js` is up to date (exits with an error if it isn't):

    npm run check:pages

## Test inboxes (audit tool)

Mail to `t.<tag>@pomwik.com` reaches this Worker through the Email Routing catch-all (`email` handler in `src/testmail.js`). It is kept 30 days in the `test_mail` table (sender, subject, text, links, SPF/DKIM/DMARC results); mail to any other unknown address is rejected. The audit tool reads it with:

    GET https://api.pomwik.com/mail?to=t.<tag>@pomwik.com&since=<ms>
    Authorization: Bearer <MAIL_READ_TOKEN>

`MAIL_READ_TOKEN` is a Worker secret (`wrangler secret put MAIL_READ_TOKEN`); without it `/mail` answers 404. Catch-all setup, and how to undo it:

    npx wrangler email routing rules update pomwik.com catch-all --enabled --action-type worker --action-value pomwik-waitlist
    npx wrangler email routing rules update pomwik.com catch-all --no-enabled --action-type drop
