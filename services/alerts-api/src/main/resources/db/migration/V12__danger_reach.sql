-- Opt-in ongoing-danger warnings: how far beyond a zone's edge, in metres.
-- NULL = off.
ALTER TABLE users ADD COLUMN danger_reach_m INTEGER CHECK (danger_reach_m IN (2000, 5000, 10000));
