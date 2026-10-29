CREATE TABLE IF NOT EXISTS token_revocations (
  token_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS token_revocations_expiry ON token_revocations(expires_at);
