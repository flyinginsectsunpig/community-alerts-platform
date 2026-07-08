-- Community Alerts Platform — initial schema.
-- Geo queries use a bounding-box prefilter + haversine distance so the
-- platform runs on any vanilla PostgreSQL (no PostGIS extension required).

CREATE TABLE alerts (
    id                   UUID PRIMARY KEY,
    category             VARCHAR(32)      NOT NULL,
    description          TEXT             NOT NULL,
    lat                  DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng                  DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    severity             VARCHAR(16)      NOT NULL DEFAULT 'UNSCORED',
    risk_score           DOUBLE PRECISION,
    status               VARCHAR(16)      NOT NULL DEFAULT 'ACTIVE',
    reporter_fingerprint VARCHAR(64)      NOT NULL,
    confirmation_count   INT              NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_created_at ON alerts (created_at DESC);
CREATE INDEX idx_alerts_lat_lng    ON alerts (lat, lng);
CREATE INDEX idx_alerts_category   ON alerts (category);
CREATE INDEX idx_alerts_severity   ON alerts (severity);

CREATE TABLE alert_confirmations (
    id          BIGSERIAL PRIMARY KEY,
    alert_id    UUID        NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
    fingerprint VARCHAR(64) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_confirmation UNIQUE (alert_id, fingerprint)
);

CREATE TABLE watch_zones (
    id            UUID PRIMARY KEY,
    name          VARCHAR(120)     NOT NULL,
    contact_email VARCHAR(254)     NOT NULL,
    center_lat    DOUBLE PRECISION NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
    center_lng    DOUBLE PRECISION NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
    radius_m      INT              NOT NULL CHECK (radius_m BETWEEN 100 AND 10000),
    -- CSV of AlertCategory names; empty string means "all categories".
    categories    VARCHAR(512)     NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- Written by the .NET alert-processor, read by this API.
CREATE TABLE notifications (
    id            BIGSERIAL PRIMARY KEY,
    watch_zone_id UUID        NOT NULL REFERENCES watch_zones (id) ON DELETE CASCADE,
    alert_id      UUID        NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
    kind          VARCHAR(24) NOT NULL DEFAULT 'ZONE_MATCH',
    message       TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification UNIQUE (watch_zone_id, alert_id, kind)
);

CREATE INDEX idx_notifications_zone ON notifications (watch_zone_id, created_at DESC);
