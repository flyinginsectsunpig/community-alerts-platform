# Police Stations Layer — Design

**Date:** 2026-07-10
**Status:** Approved pending user review

## Overview

Add an official police-station layer to the Community Alerts map: toggleable
station markers with a popup showing the latest quarter's official SAPS crime
statistics and an expandable panel with the full 5-year breakdown. Data comes
from the SAPS quarterly crime statistics workbook (user-supplied xlsx) joined
with the openAFRICA SAPS station coordinates dataset, imported into PostgreSQL
by a repeatable CLI so each quarterly release is a rerun, not rework.

## Goals

- Police station markers on the dashboard map, joined with official quarterly
  crime statistics per station.
- Marker popup: latest-quarter headline + top categories with trend; "Full
  stats" opens a detail panel with all categories across 5 years.
- Quarterly refresh = run one import command with the new xlsx.

## Non-goals

- Other POI types (hospitals, fire stations) — police stations only; the
  source file contains nothing else.
- Station *boundary* polygons (only point coordinates).
- Any change to alerts, watch zones, messaging topology, or the ML service.
- Marker clustering — zoom gating keeps marker counts manageable without a
  new dependency.

## Data sources

1. **SAPS quarterly crime stats workbook** (e.g.
   `2025-2026_-_4th_Quarter_WEB.xlsx`), sheet `RAW Data`:
   - Header row 3; data from row 4.
   - Relevant columns: `Comp level` (C) — keep only `Station` rows;
     `Station` (E); `District` (F); `Province` (G); `Crime_Category` (H).
   - Monthly count columns: the importer detects them dynamically by reading
     header row 3 and treating datetime-valued cells as month columns (the
     Q4 file has Jan–Mar for 2022–2026). Quarter-total and ranking columns
     are ignored — they are derivable.
   - The Q4 2025/26 file yields 1,174 stations and 44 crime categories
     (case-normalized), including the per-station aggregate category
     `17 community reported serious crime` used for headline numbers.
2. **Station coordinates** — openAFRICA "Police Station Coordinates" CSV
   (<https://open.africa/dataset/police-station-coordinates>), 1,140 stations:
   `compnt_nm` (uppercase name), `location_x` (lng), `location_y` (lat).
   A copy is checked in at `tools/saps-import/data/saps_station_coords.csv`
   so imports are reproducible offline.

Join: normalize names (uppercase, strip non-alphanumerics) → 1,102/1,174
match. `tools/saps-import/data/overrides.csv` (columns:
`workbook_name,lat,lng`) covers renamed/new stations (e.g. Dutywa, KwaBhaca);
remaining unmatched stations are skipped and listed in the import summary —
never silently dropped.

## Data model (Flyway `V3__police_stations.sql` in alerts-api)

```sql
police_stations (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,      -- workbook spelling, canonical
  district  TEXT NOT NULL,
  province  TEXT NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lng       DOUBLE PRECISION NOT NULL
)
-- index on (lat, lng) for bbox queries

station_crime_stats (
  station_id   BIGINT NOT NULL REFERENCES police_stations(id),
  category     TEXT NOT NULL,          -- case-normalized, first-seen casing
  period_month DATE NOT NULL,          -- first of month
  count        INT  NOT NULL,
  PRIMARY KEY (station_id, category, period_month)
)
```

Monthly granularity is deliberate: each SAPS release covers a different
3-month window with 5 years of history, so upserts keyed on
`(station, category, month)` let successive quarterly imports accumulate and
overlapping months converge. Volume ≈ 775k skinny rows for this file (~tens
of MB on Neon — acceptable).

Category identity is case-insensitive; the stored value is the first-seen
variant (fixes the workbook's `…serious Crime` / `…serious crime` split).

## Import CLI (`tools/saps-import/`)

Standalone Python (not part of any service): `import_saps.py`,
`requirements.txt` (openpyxl, psycopg), `data/` (coords + overrides),
`tests/`.

```
python import_saps.py --xlsx <path> [--coords data/saps_station_coords.csv]
# connection via DATABASE_URL env var (same var the ML service uses)
```

Behavior:

1. Parse coords CSV + overrides; parse workbook `Station` rows.
2. Join by normalized name; overrides take precedence over the CSV.
3. Single transaction: upsert `police_stations` (`ON CONFLICT (name) DO
   UPDATE` coords/district/province), upsert `station_crime_stats`
   (`ON CONFLICT DO UPDATE SET count = EXCLUDED.count`).
4. Print summary: stations matched/skipped (with names), stat rows written.
   Non-zero exit if the workbook parses to zero stations (fail fast).

Idempotent; rerunning with the same file is a no-op. Runs against the live
Neon database → requires explicit user confirmation before each run (user's
global rule), same as the V3 migration that ships with the next alerts-api
start.

## API (alerts-api)

Two anonymous read-only endpoints (controller/service/repository, matching
existing conventions; no auth, no rate limiting — read path):

- `GET /api/v1/stations?minLat&maxLat&minLng&maxLng`
  → `[{id, name, district, province, lat, lng}]`
  Bounding-box query (same pattern as alerts geo search). Redis cache
  `stations:bbox:{rounded bbox}`, TTL 1 h. 400 on missing/invalid bbox.
- `GET /api/v1/stations/{id}/stats` → 404 if unknown, else:

```jsonc
{
  "station": { "id": 1, "name": "Acornhoek", "district": "…", "province": "…" },
  "latestQuarter": {
    "label": "Jan–Mar 2026",
    "totalSerious": 123,            // aggregate category, latest 3 months
    "totalSeriousPrevYear": 130,    // same months, previous year
    "topCategories": [              // top 5 by latest-quarter count; the
      { "category": "Murder", "count": 8, "prevYearCount": 9 }
    ]                               // headline aggregate itself is excluded
  },
  "categories": [                   // full panel data: every category, one
    { "category": "Murder",         // entry per 3-month window in the DB
      "periods": [
        { "months": "Jan–Mar",
          "totals": { "2022": 8, "2023": 10, "2024": 12, "2025": 9, "2026": 8 } }
      ] }
  ]
}
```

"Latest quarter" = the most recent 3-month window present in
`station_crime_stats`. `topCategories` and the panel exclude exactly one
category — the headline aggregate `17 community reported serious crime`
(every other category, including `Other serious crime`, is a real
subcategory). After future imports add new windows (e.g. Apr–Jun), each
category simply gains another `periods` entry; the panel renders one column
group per window.

Aggregation in SQL; Redis cache `stations:stats:{id}`, TTL 1 h. Caching is
TTL-only (data changes quarterly; no invalidation hook needed). If Redis is
down both endpoints serve from SQL (same fail-open stance as the rest of the
app).

## Web (apps/web)

- **Toggle** "Police stations" beside the existing hotspot switch.
- **Fetching**: when the layer is on and zoom ≥ 10, fetch stations for the
  current viewport bbox on move/zoom end (debounced ~300 ms, in-flight
  dedupe). Below zoom 10 the layer renders nothing and shows the existing
  map-hint style notice ("zoom in to see police stations").
- **Markers**: Leaflet `divIcon` shield glyph (CSS, no image assets, no new
  dependency), visually distinct from alert pins and hotspot circles.
- **Popup**: name, district · province, latest-quarter serious-crime total
  with year-over-year direction arrow, top 5 categories with counts and
  arrows, "Full stats" button.
- **`StationStatsPanel`**: slide-in panel (same pattern as
  `AlertDetailPanel`) — full category table, quarterly totals across the 5
  years, sortable by latest count. Data comes from the same `/stats`
  response already fetched for the popup (one fetch per station, cached in
  component state).
- `lib/types.ts` gains `PoliceStation` / `StationStats` mirroring the DTOs;
  `lib/api.ts` gains `fetchStations(bbox)` / `fetchStationStats(id)`.
- Failures degrade quietly: fetch error → empty layer + map-hint notice;
  the alerts map is never blocked.

## Error handling summary

| Failure | Behavior |
|---|---|
| Station in workbook, no coordinates | Skipped, named in import summary; fix via `overrides.csv` |
| Workbook parses to 0 stations | Importer exits non-zero, DB untouched |
| Unknown station id on `/stats` | 404 |
| Missing/invalid bbox | 400 |
| Redis down | Endpoints fall back to SQL (fail open) |
| Web fetch fails / zoom too low | Empty layer + hint; app unaffected |

## Testing

- **Importer (pytest, red-green)**: name normalization, month-column
  detection from a fixture workbook, join + override precedence, category
  case-merge. New small CI job (Python 3.12, installs
  `tools/saps-import/requirements.txt`).
- **API (JUnit 5 + Mockito)**: bbox validation, stats aggregation service
  (latest-quarter selection, prev-year comparison, top-5 excluding
  aggregate categories), 404 path. Run via the existing Docker Maven
  command locally; `mvn -B verify` in CI.
- **Web**: `npm run typecheck && npm run build`; manual verification of
  toggle → markers → popup → panel in the preview browser.

## Quarterly refresh runbook

1. Download the new quarter's `*_WEB.xlsx` from the SAPS site.
2. `python tools/saps-import/import_saps.py --xlsx <file>` (confirm — live DB).
3. Review the summary; add `overrides.csv` entries for any newly renamed
   stations and rerun if needed. Caches expire within 1 h (TTL).

## Decisions log

- Station markers + stats popup/panel (user-selected; markers-only and
  stats-only rejected).
- Repeatable import over one-off static bundle (user-selected).
- Popup + expandable panel depth (user-selected).
- DB-backed via alerts-api (Approach A) over static GeoJSON (B) and
  ml-service serving (C) (user-selected).
- Monthly stat rows over quarterly aggregates: same import effort, merges
  cleanly across quarterly releases.
- Zoom gating over a clustering library: avoids a new dependency.
