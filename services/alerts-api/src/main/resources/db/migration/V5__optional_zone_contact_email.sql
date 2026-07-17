-- Zone notifications are moving to browser push + account-email digests;
-- the per-zone contact email is now optional (and no longer collected by
-- the web form).
ALTER TABLE watch_zones ALTER COLUMN contact_email DROP NOT NULL;
