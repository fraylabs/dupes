-- Matches standalone packages/platform/migrations/0005_powered_by.sql.
-- Default on for existing and new tenants; no public removal control.
ALTER TABLE instances ADD COLUMN powered_by INTEGER NOT NULL DEFAULT 1 CHECK(powered_by IN (0,1));
