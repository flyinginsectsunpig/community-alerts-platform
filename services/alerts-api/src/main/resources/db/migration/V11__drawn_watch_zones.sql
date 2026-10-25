ALTER TABLE watch_zones ADD COLUMN polygon JSONB, ADD COLUMN shape JSONB;
ALTER TABLE watch_zones DROP CONSTRAINT watch_zones_radius_m_check;
ALTER TABLE watch_zones ADD CONSTRAINT watch_zones_radius_m_check CHECK (radius_m BETWEEN 50 AND 10000);
ALTER TABLE watch_zones ADD CONSTRAINT watch_zones_polygon_with_shape CHECK ((polygon IS NULL) = (shape IS NULL));
