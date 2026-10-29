-- Cloudflare D1: link verified Google account subjects to student accounts.
-- This migration preserves existing users, enrollment and session tables.
CREATE TABLE IF NOT EXISTS google_identities (
  google_sub TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS google_identities_user_idx ON google_identities(user_id);
