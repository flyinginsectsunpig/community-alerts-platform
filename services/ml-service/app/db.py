"""Read-only access to Neon PostgreSQL.

The Java API is the sole writer of alerts; tools/saps-import owns the SAPS
tables. This service only reads: recent alert coordinates for hotspot
clustering, and per-station latest-quarter crime totals for the baseline heat.
"""

from __future__ import annotations

import psycopg

from .models.hotspots import AlertPoint, StationCrime


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


def fetch_station_crime(database_url: str) -> list[StationCrime]:
    """Each station's total and top category over the latest released quarter.

    Stats rows are monthly; the latest quarter is the 3 months up to the most
    recent period in the table (each SAPS release covers a 3-month window).
    """
    query = """
        WITH latest AS (
            SELECT max(period_month) AS max_month FROM station_crime_stats
        ),
        window_stats AS (
            SELECT scs.station_id, scs.category, sum(scs.count) AS category_total
            FROM station_crime_stats scs, latest
            WHERE scs.period_month > latest.max_month - INTERVAL '3 months'
            GROUP BY scs.station_id, scs.category
        ),
        ranked AS (
            SELECT station_id, category, category_total,
                   row_number() OVER (
                       PARTITION BY station_id ORDER BY category_total DESC
                   ) AS rank
            FROM window_stats
        )
        SELECT ps.lat, ps.lng,
               sum(ws.category_total) AS total,
               max(r.category) AS top_category
        FROM police_stations ps
        JOIN window_stats ws ON ws.station_id = ps.id
        JOIN ranked r ON r.station_id = ps.id AND r.rank = 1
        GROUP BY ps.id, ps.lat, ps.lng
    """
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
    return [
        StationCrime(lat=row[0], lng=row[1], total=int(row[2]), top_category=row[3])
        for row in rows
    ]
