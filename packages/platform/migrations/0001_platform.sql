CREATE TABLE instances (
  id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, app TEXT NOT NULL,
  name TEXT NOT NULL, created TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX instances_owner ON instances(owner_hash,created);
CREATE TABLE hosted_boards (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  private INTEGER NOT NULL DEFAULT 0, private_comments INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(tenant_id,id)
);
CREATE TABLE hosted_users (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, external_id TEXT, verified INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,external_id)
);
CREATE TABLE hosted_tags (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  id TEXT NOT NULL, board_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'tag', parent_id TEXT,
  PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,board_id) REFERENCES hosted_boards(tenant_id,id)
);
CREATE TABLE hosted_posts (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  id TEXT NOT NULL, board_id TEXT NOT NULL, author_id TEXT, title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', imported_votes INTEGER NOT NULL DEFAULT 0, merged_into TEXT, created TEXT NOT NULL,
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,board_id) REFERENCES hosted_boards(tenant_id,id),
  FOREIGN KEY(tenant_id,author_id) REFERENCES hosted_users(tenant_id,id),
  FOREIGN KEY(tenant_id,merged_into) REFERENCES hosted_posts(tenant_id,id)
);
CREATE INDEX hosted_posts_board ON hosted_posts(tenant_id,board_id,status);
CREATE TABLE hosted_post_tags (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL, tag_id TEXT NOT NULL, PRIMARY KEY(tenant_id,post_id,tag_id),
  FOREIGN KEY(tenant_id,post_id) REFERENCES hosted_posts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,tag_id) REFERENCES hosted_tags(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE hosted_votes (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL, user_id TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY(tenant_id,post_id,user_id),
  FOREIGN KEY(tenant_id,post_id) REFERENCES hosted_posts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,user_id) REFERENCES hosted_users(tenant_id,id)
);
CREATE TABLE hosted_comments (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  id TEXT NOT NULL, post_id TEXT NOT NULL, user_id TEXT, body TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0, private INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL,
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,post_id) REFERENCES hosted_posts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,user_id) REFERENCES hosted_users(tenant_id,id)
);
CREATE INDEX hosted_comments_post ON hosted_comments(tenant_id,post_id,created);
CREATE TABLE hosted_changelog (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'new',
  published INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL, PRIMARY KEY(tenant_id,id)
);
CREATE TABLE hosted_changelog_posts (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL, post_id TEXT NOT NULL, PRIMARY KEY(tenant_id,entry_id,post_id),
  FOREIGN KEY(tenant_id,entry_id) REFERENCES hosted_changelog(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,post_id) REFERENCES hosted_posts(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE hosted_credentials (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  id TEXT NOT NULL, name TEXT NOT NULL, hash TEXT NOT NULL, kind TEXT NOT NULL, user_id TEXT, expires INTEGER,
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,hash),
  FOREIGN KEY(tenant_id,user_id) REFERENCES hosted_users(tenant_id,id)
);
CREATE TABLE hosted_settings (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(tenant_id,key)
);
CREATE TABLE hosted_notifications (
  tenant_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL, user_id TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(tenant_id,entry_id,user_id),
  FOREIGN KEY(tenant_id,entry_id) REFERENCES hosted_changelog(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,user_id) REFERENCES hosted_users(tenant_id,id)
);
