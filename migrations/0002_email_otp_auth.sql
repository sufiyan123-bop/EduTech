-- Run on the Cloudflare D1 database bound as DB.
-- Uses ir_auth_* names to avoid overwriting existing student or course tables.
CREATE TABLE IF NOT EXISTS ir_auth_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS ir_auth_codes_expires_idx ON ir_auth_codes(expires_at);
CREATE TABLE IF NOT EXISTS ir_auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ir_auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES ir_auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ir_auth_sessions_expires_idx ON ir_auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS ir_auth_sessions_user_idx ON ir_auth_sessions(user_id);
