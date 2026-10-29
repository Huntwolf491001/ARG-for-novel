CREATE TABLE puzzle_credentials (
  site_id TEXT NOT NULL,
  username_key TEXT NOT NULL,
  secondary_salt TEXT NOT NULL,
  secondary_hash TEXT NOT NULL,
  answer_salt TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  PRIMARY KEY (site_id, username_key),
  FOREIGN KEY (site_id, username_key) REFERENCES accounts(site_id, username_key) ON DELETE CASCADE
);
