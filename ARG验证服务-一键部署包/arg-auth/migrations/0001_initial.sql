CREATE TABLE sites (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, origin TEXT NOT NULL,
  prefix TEXT NOT NULL, destination TEXT NOT NULL, signing_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE accounts (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  username_key TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
  PRIMARY KEY(site_id, username_key)
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL,
  username_enc TEXT NOT NULL, success INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX events_time ON events(created_at DESC);
