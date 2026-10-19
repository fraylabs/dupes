-- Matches packages/platform/migrations/0003_workspace_keys.sql.
CREATE TABLE workspace_keys (
  hash TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  created TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0,1))
);
CREATE INDEX workspace_keys_owner ON workspace_keys(owner_hash);
