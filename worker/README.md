# pomwik-waitlist

Cloudflare Worker + D1 that stores waitlist signups from pomwik.com at `POST https://api.pomwik.com/waitlist`.

Export signups:

    npx wrangler d1 execute pomwik-waitlist --remote --command "SELECT app, email, created_at FROM signups ORDER BY created_at"

Delete one person's data:

    npx wrangler d1 execute pomwik-waitlist --remote --command "DELETE FROM signups WHERE email = 'someone@example.com'"
