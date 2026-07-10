"""CLI: import a SAPS quarterly stats workbook into the platform database.

Writes to the LIVE database named by DATABASE_URL — confirm before running.
Idempotent: rerunning the same file is a no-op; a new quarter's file merges.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg

from saps import join_coords, parse_coords, parse_overrides, parse_workbook

DATA_DIR = Path(__file__).parent / "data"
BATCH_SIZE = 5000

UPSERT_STATION = """
    INSERT INTO police_stations (name, district, province, lat, lng)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (name) DO UPDATE
        SET district = EXCLUDED.district,
            province = EXCLUDED.province,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng
    RETURNING id
"""

UPSERT_STAT = """
    INSERT INTO station_crime_stats (station_id, category, period_month, count)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (station_id, category, period_month) DO UPDATE
        SET count = EXCLUDED.count
"""


def chunked(items: list, size: int) -> list[list]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", required=True, help="SAPS quarterly *_WEB.xlsx")
    parser.add_argument("--coords", default=str(DATA_DIR / "saps_station_coords.csv"))
    parser.add_argument("--overrides", default=str(DATA_DIR / "overrides.csv"))
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1

    data = parse_workbook(args.xlsx)
    if not data.stations:
        print("workbook parsed to zero stations — aborting", file=sys.stderr)
        return 1
    located, unmatched = join_coords(
        data.stations, parse_coords(args.coords), parse_overrides(args.overrides))

    imported = {ls.station.name for ls in located}
    stats = [s for s in data.stats if s.station_name in imported]

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        ids: dict[str, int] = {}
        for ls in located:
            cur.execute(UPSERT_STATION,
                        (ls.station.name, ls.station.district, ls.station.province, ls.lat, ls.lng))
            ids[ls.station.name] = cur.fetchone()[0]
        rows = [(ids[s.station_name], s.category, s.month, s.count) for s in stats]
        for batch in chunked(rows, BATCH_SIZE):
            cur.executemany(UPSERT_STAT, batch)
        conn.commit()

    print(f"stations imported: {len(located)}")
    print(f"stat rows upserted: {len(stats)}")
    print(f"stations skipped (no coordinates): {len(unmatched)}")
    for name in unmatched:
        print(f"  - {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
