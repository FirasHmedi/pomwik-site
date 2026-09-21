CREATE TABLE IF NOT EXISTS signups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL,
  app            TEXT NOT NULL,
  answer         TEXT,
  answer2        TEXT,
  created_at     TEXT NOT NULL,
  token          TEXT,
  welcome_sent   INTEGER NOT NULL DEFAULT 0,
  owner_notified INTEGER NOT NULL DEFAULT 0,
  unsubscribed   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (email, app)
);
CREATE INDEX IF NOT EXISTS idx_signups_token ON signups(token);
CREATE INDEX IF NOT EXISTS idx_signups_pending ON signups(unsubscribed, welcome_sent, owner_notified);
