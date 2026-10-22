# pomwik-waitlist

Cloudflare Worker + D1 that stores waitlist signups from pomwik.com at `POST https://api.pomwik.com/waitlist`.

Export signups:

    npx wrangler d1 execute pomwik-waitlist --remote --command "SELECT app, email, created_at FROM signups ORDER BY created_at"

Delete one person's data:

    npx wrangler d1 execute pomwik-waitlist --remote --command "DELETE FROM signups WHERE email = 'someone@example.com'"

Run the tests (Vitest inside the Workers runtime, with a local D1 built from `schema.sql`; no email or DNS request leaves the machine):

    npm install
    npm test

The CI (`.github/workflows/worker.yml`) runs `npm run check:pages` and `npm test` on every PR and push, then deploys to Cloudflare after each push to `main` (secret `CLOUDFLARE_API_TOKEN`).

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

`MAIL_READ_TOKEN` is a Worker secret (`wrangler secret put MAIL_READ_TOKEN`); without it `/mail` answers 404.

The catch-all points to this Worker (Cloudflare dashboard: Email Routing → Routing rules → Catch-all → Send to a Worker → pomwik-waitlist). Wrangler can only set a catch-all to forward or drop, so either use the dashboard or the API (`PUT /zones/<zone>/email/routing/rules/catch_all` with `{"enabled": true, "matchers": [{"type": "all"}], "actions": [{"type": "worker", "value": ["pomwik-waitlist"]}]}`). To undo:

    npx wrangler email routing rules update pomwik.com catch-all --no-enabled --action-type drop

## Alert e-mails from the monitoring (`POST /notify`)

The audit tool's monitoring (GitHub Actions in the private audit repository) sends agencies their alert e-mails and the weekly summary through this route, with Resend (`Pomwik <FROM_EMAIL>`, header `X-Pomwik-Kind`):

    POST https://api.pomwik.com/notify
    Authorization: Bearer <MAIL_READ_TOKEN>
    { "to": ["…"], "subject": "…", "text": "…", "html": "…", "kind": "alerte" | "recap" }

- Same token as `/mail` (`MAIL_READ_TOKEN`, compared in constant time). Missing or wrong token: 401; other method: 405.
- Recipients must match the Worker secret `NOTIFY_ALLOW`: addresses or whole domains, comma-separated (`someone@example.com,@agency.example`). Set it with `npx wrangler secret put NOTIFY_ALLOW`. Without it the route answers 503 (sending disabled); one recipient outside the list: 403, nothing is sent.
- 1 to 5 recipients, subject ≤ 200 characters, text ≤ 50 000, html ≤ 200 000 (else 400). At most 50 e-mails per hour (table `notify_log`, kept 30 days; else 429). Resend error: 502.
