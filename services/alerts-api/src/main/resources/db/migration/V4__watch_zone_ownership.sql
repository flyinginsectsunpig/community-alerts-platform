-- Anonymous watch zones are owned by the creating browser's client
-- fingerprint (same identity used for reporting/confirming). Signed-in
-- zones keep using user_id (V2). Claiming a zone sets user_id and clears
-- owner_fingerprint. Rows predating this migration have neither and are
-- unmanageable legacy zones that keep receiving email notifications.

ALTER TABLE watch_zones ADD COLUMN owner_fingerprint VARCHAR(64);

CREATE INDEX idx_watch_zones_owner_fp ON watch_zones (owner_fingerprint)
    WHERE owner_fingerprint IS NOT NULL;
CREATE INDEX idx_watch_zones_user ON watch_zones (user_id)
    WHERE user_id IS NOT NULL;
