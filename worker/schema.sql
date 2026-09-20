CREATE TABLE IF NOT EXISTS signups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  app        TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (email, app)
);
