-- Official SAPS reference data: station locations + quarterly crime stats.
-- Written by tools/saps-import (raw SQL upserts), read by this API.
-- Stats are monthly rows so successive quarterly releases (each a different
-- 3-month window with 5 years of history) accumulate under one key.

CREATE TABLE police_stations (
    id       BIGSERIAL PRIMARY KEY,
    name     TEXT             NOT NULL UNIQUE,
    district TEXT             NOT NULL,
    province TEXT             NOT NULL,
    lat      DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng      DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180)
);

CREATE INDEX idx_police_stations_lat_lng ON police_stations (lat, lng);

CREATE TABLE station_crime_stats (
    station_id   BIGINT NOT NULL REFERENCES police_stations (id) ON DELETE CASCADE,
    category     TEXT   NOT NULL,
    period_month DATE   NOT NULL,
    count        INT    NOT NULL CHECK (count >= 0),
    PRIMARY KEY (station_id, category, period_month)
);
