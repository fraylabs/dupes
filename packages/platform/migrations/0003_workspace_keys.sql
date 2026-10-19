-- No plaintext keys. Signup can issue a random high-entropy key, store its
-- SHA-256 hash with a fresh workspace ID, and return the key once privately.
-- Additional keys can point at that same ID without moving any app content.
CREATE TABLE workspace_keys (
  hash TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  created TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0,1))
);
CREATE INDEX workspace_keys_owner ON workspace_keys(owner_hash);
