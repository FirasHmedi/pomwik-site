-- Journal des e-mails envoyés par POST /notify (limite de 50 par heure, gardé 30 jours)
CREATE TABLE IF NOT EXISTS notify_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       INTEGER NOT NULL,
  kind     TEXT NOT NULL,
  to_count INTEGER NOT NULL
);
