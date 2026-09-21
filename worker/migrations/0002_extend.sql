ALTER TABLE signups ADD COLUMN answer TEXT;
ALTER TABLE signups ADD COLUMN answer2 TEXT;
ALTER TABLE signups ADD COLUMN token TEXT;
ALTER TABLE signups ADD COLUMN welcome_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signups ADD COLUMN owner_notified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signups ADD COLUMN unsubscribed INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_signups_token ON signups(token);
CREATE INDEX IF NOT EXISTS idx_signups_pending ON signups(unsubscribed, welcome_sent, owner_notified);
