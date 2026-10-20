CREATE TABLE site_daily_visits (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  source TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY(day,path,source)
);
ALTER TABLE site_waitlist ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX site_waitlist_created_source ON site_waitlist(created,source);
