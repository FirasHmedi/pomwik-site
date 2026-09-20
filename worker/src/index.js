const ALLOWED_ORIGINS = new Set(['https://pomwik.com', 'https://www.pomwik.com']);
const APPS = new Set(['voice-companion', 'hands-free-companion', 'pet-growth']);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_BODY = 2048;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(origin ? corsHeaders(origin) : {}) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.has(origin) ? origin : '';

    if (url.pathname !== '/waitlist') return json({ error: 'not_found' }, 404, allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(allowed) : {} });
    }
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, allowed);
    if (!allowed) return json({ error: 'forbidden' }, 403, '');

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413, allowed);

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: 'bad_json' }, 400, allowed);
    }

    // Honeypot: bots fill the hidden field. Pretend success, store nothing.
    if (typeof data.website === 'string' && data.website !== '') return json({ ok: true }, 200, allowed);

    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const app = typeof data.app === 'string' ? data.app : '';
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400, allowed);
    if (!APPS.has(app)) return json({ error: 'invalid_app' }, 400, allowed);

    // Same email + app twice is a no-op, and the response is identical so it can't be used to probe the list.
    await env.DB.prepare(
      'INSERT INTO signups (email, app, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(email, app) DO NOTHING'
    )
      .bind(email, app, new Date().toISOString())
      .run();

    return json({ ok: true }, 200, allowed);
  },
};
