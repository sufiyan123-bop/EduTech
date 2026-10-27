CREATE TABLE IF NOT EXISTS credentials (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 password_iterations INTEGER NOT NULL CHECK(password_iterations >= 100000),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
