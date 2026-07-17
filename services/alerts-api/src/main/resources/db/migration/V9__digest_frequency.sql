-- Opt-in email digest summarizing watch-zone activity, sent to the account
-- address. OFF by default; the worker's digest job reads this.
ALTER TABLE users ADD COLUMN digest_frequency VARCHAR(16) NOT NULL DEFAULT 'OFF';
