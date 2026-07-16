-- Alerts now have a lifecycle: they auto-expire after a per-category window
-- (worker sweep flips them to EXPIRED) and reporters can RESOLVE their own.
ALTER TABLE alerts ADD COLUMN expires_at TIMESTAMPTZ;

-- Backfill mirrors the TTLs in application.properties (app.alerts.ttl-hours.*).
UPDATE alerts SET expires_at = created_at + CASE category
    WHEN 'SUSPICIOUS_ACTIVITY' THEN INTERVAL '24 hours'
    WHEN 'HARASSMENT'          THEN INTERVAL '48 hours'
    WHEN 'HAZARD'              THEN INTERVAL '48 hours'
    WHEN 'VANDALISM'           THEN INTERVAL '7 days'
    WHEN 'BURGLARY'            THEN INTERVAL '7 days'
    WHEN 'DRUGS'               THEN INTERVAL '7 days'
    ELSE                            INTERVAL '72 hours'
END;

ALTER TABLE alerts ALTER COLUMN expires_at SET NOT NULL;

-- The worker's expiry sweep scans only alerts that can still expire.
CREATE INDEX idx_alerts_expiry ON alerts (expires_at)
    WHERE status IN ('ACTIVE', 'VERIFIED');
