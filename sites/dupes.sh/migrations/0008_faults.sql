-- Matches standalone packages/platform/migrations/0006_faults.sql.
CREATE TABLE IF NOT EXISTS faults_credentials(tenant_id TEXT NOT NULL,id TEXT NOT NULL,hash TEXT NOT NULL,kind TEXT NOT NULL,expires INTEGER,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,hash));
-- Numeric project IDs are global: the public store address carries only the number and the project's public key.
CREATE TABLE IF NOT EXISTS faults_projects(id INTEGER PRIMARY KEY AUTOINCREMENT,tenant_id TEXT NOT NULL,name TEXT NOT NULL,public_key TEXT NOT NULL,created TEXT NOT NULL,minute INTEGER NOT NULL DEFAULT 0,hits INTEGER NOT NULL DEFAULT 0,UNIQUE(tenant_id,name));
-- One row per distinct fault. Repeats add to count and replace the sample; no per-event rows are kept.
CREATE TABLE IF NOT EXISTS faults_groups(tenant_id TEXT NOT NULL,id TEXT NOT NULL,project_id INTEGER NOT NULL,fingerprint TEXT NOT NULL,type TEXT NOT NULL,message TEXT NOT NULL,location TEXT NOT NULL DEFAULT '',level TEXT NOT NULL DEFAULT 'error',status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),count INTEGER NOT NULL DEFAULT 1,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,first_release TEXT NOT NULL DEFAULT '',last_release TEXT NOT NULL DEFAULT '',sample TEXT NOT NULL,PRIMARY KEY(tenant_id,id),UNIQUE(project_id,fingerprint),FOREIGN KEY(project_id) REFERENCES faults_projects(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS faults_groups_recent ON faults_groups(tenant_id,status,last_seen);
CREATE INDEX IF NOT EXISTS faults_groups_age ON faults_groups(last_seen);
