"""Read-only access to the alerts table in Neon PostgreSQL.

The Java API is the sole writer of alerts; this service only reads recent
coordinates for hotspot clustering.
"""

from __future__ import annotations

import psycopg

from .models.hotspots import AlertPoint


def fetch_recent_alerts(database_url: str, window_hours: int) -> list[AlertPoint]:
    query = """
        SELECT lat, lng, category
        FROM alerts
        WHERE created_at >= now() - make_interval(hours => %s)
    """
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(query, (window_hours,))
            rows = cur.fetchall()
    return [AlertPoint(lat=row[0], lng=row[1], category=row[2]) for row in rows]
