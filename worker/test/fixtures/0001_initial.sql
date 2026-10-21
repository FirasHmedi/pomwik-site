-- worker/schema.sql as first deployed (commit 609c17d), before migrations/0002_extend.sql.
-- Only used by test/schema.test.js to check that the migrations bring an old database up to schema.sql.
CREATE TABLE IF NOT EXISTS signups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  app        TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (email, app)
);
