# pomwik-waitlist

Cloudflare Worker + D1 that stores waitlist signups from pomwik.com at `POST https://api.pomwik.com/waitlist`.

Export signups:

    npx wrangler d1 execute pomwik-waitlist --remote --command "SELECT app, email, created_at FROM signups ORDER BY created_at"

Delete one person's data:

    npx wrangler d1 execute pomwik-waitlist --remote --command "DELETE FROM signups WHERE email = 'someone@example.com'"

## Contact pages

`src/pages.js` serves copies of `contact/index.html` and `tests/contact-panne/index.html` on api.pomwik.com, with `contact.js` inlined and links pointing to https://pomwik.com. It is generated, so don't edit it by hand. After changing any of those three files, run from `worker/`:

    npm run build:pages

To check that `src/pages.js` is up to date (exits with an error if it isn't):

    npm run check:pages
