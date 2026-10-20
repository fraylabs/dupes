-- Same platform tables as packages/platform/migrations/0004_public_entry.sql.
-- Apply only the site migration set when deploying the combined site Worker.
CREATE TABLE public_rate_limits (
  bucket TEXT PRIMARY KEY, scope TEXT NOT NULL, hits INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX public_rate_expiry ON public_rate_limits(expires);
CREATE TABLE workspace_signups (
  owner_hash TEXT PRIMARY KEY, email TEXT NOT NULL, created TEXT NOT NULL,
  source TEXT NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1))
);
CREATE INDEX workspace_signup_source ON workspace_signups(created,source);
CREATE TABLE demo_state (id TEXT PRIMARY KEY, reset_day TEXT NOT NULL, reset_token TEXT NOT NULL);
INSERT INTO demo_state(id,reset_day,reset_token) VALUES('demo','','');
