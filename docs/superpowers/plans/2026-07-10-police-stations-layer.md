# Police Stations Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toggleable police-station markers on the dashboard map with official SAPS quarterly crime stats in a popup and an expandable panel, fed by a repeatable xlsx import.

**Architecture:** A Python CLI (`tools/saps-import/`) parses the quarterly SAPS workbook + openAFRICA coordinates CSV and upserts into two new PostgreSQL tables (Flyway `V3`, owned by alerts-api). The API adds two anonymous read endpoints (`GET /api/v1/stations` bbox query, `GET /api/v1/stations/{id}/stats`), Redis-cached 1 h, fail-open. The web app adds a zoom-gated `StationLayer` inside the Leaflet map plus a `StationStatsPanel`.

**Tech Stack:** Python 3.12+ (openpyxl, psycopg3, pytest) · Java 21 / Spring Boot 3 (JPA, StringRedisTemplate, JUnit 5 + Mockito + AssertJ) · Next.js 14 / react-leaflet 4.

**Spec:** `docs/superpowers/specs/2026-07-10-police-stations-design.md`

## Global Constraints

- **No new dependencies** in `apps/web` (Leaflet `divIcon` + CSS only) or `services/alerts-api` (spring-data-jpa/redis + Jackson already present).
- Importer dependencies limited to `openpyxl==3.1.5`, `psycopg[binary]==3.2.9`; tests use pytest.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`).
- **This dev machine has no Maven.** Run Java tests via:
  `docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" -v communityalerts-m2:/root/.m2 -w /workspace maven:3.9-eclipse-temurin-21 mvn -B test`
- **Never** start `alerts-api` (runs Flyway V3 against live Neon) or run the importer without explicit user confirmation. All non-live tasks below need no DB.
- Quarter labels use en dashes exactly: `"Jan–Mar"`, `"Apr–Jun"`, `"Jul–Sep"`, `"Oct–Dec"`.
- The headline aggregate category is `17 community reported serious crime`, compared **case-insensitively** everywhere.
- Redis is always fail-open: cache errors are logged and the SQL path serves the request.

---

### Task 1: Importer — name normalization, coordinates CSV, overrides, join

**Files:**
- Create: `tools/saps-import/requirements.txt`
- Create: `tools/saps-import/saps.py`
- Create: `tools/saps-import/tests/test_saps.py`

**Interfaces:**
- Produces: `normalize_name(name: str) -> str`; `Station(name, district, province)` frozen dataclass; `LocatedStation(station, lat, lng)` frozen dataclass; `parse_coords(path) -> dict[str, tuple[float, float]]`; `parse_overrides(path) -> dict[str, tuple[float, float]]`; `join_coords(stations, coords, overrides) -> tuple[list[LocatedStation], list[str]]` (unmatched names sorted).

- [ ] **Step 1: Create `tools/saps-import/requirements.txt`**

```
openpyxl==3.1.5
psycopg[binary]==3.2.9
```

- [ ] **Step 2: Create a venv and install (importer is standalone, not part of any service)**

```bash
cd "C:\Fable makes my app\tools\saps-import"
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt pytest
```

- [ ] **Step 3: Write the failing tests** — `tools/saps-import/tests/test_saps.py`:

```python
import csv

from saps import LocatedStation, Station, join_coords, normalize_name, parse_coords, parse_overrides


def test_normalize_name_strips_case_and_punctuation():
    assert normalize_name("KwaBhaca") == "KWABHACA"
    assert normalize_name("  Cape Town Central ") == "CAPETOWNCENTRAL"
    assert normalize_name("Ga-Rankuwa") == "GARANKUWA"


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def test_parse_coords_maps_normalized_name_to_lat_lng(tmp_path):
    path = tmp_path / "coords.csv"
    write_csv(path, ["the_geom", "compnt_nm", "create_dt", "location_x", "location_y", "version"],
              [["x", "KOLOMANE", "20140207", "26.78883", "-32.42247", "1.1.0"]])
    assert parse_coords(path) == {"KOLOMANE": (-32.42247, 26.78883)}  # (lat, lng)


def test_parse_overrides_keyed_by_workbook_name(tmp_path):
    path = tmp_path / "overrides.csv"
    write_csv(path, ["workbook_name", "lat", "lng"], [["Dutywa", "-32.098", "28.311"]])
    assert parse_overrides(path) == {"DUTYWA": (-32.098, 28.311)}


def test_join_coords_prefers_overrides_and_reports_unmatched():
    stations = [Station("Kolomane", "D1", "P1"), Station("Dutywa", "D2", "P2"),
                Station("Ghost Town", "D3", "P3")]
    coords = {"KOLOMANE": (-32.4, 26.7), "DUTYWA": (-99.0, 99.0)}
    overrides = {"DUTYWA": (-32.098, 28.311)}
    located, unmatched = join_coords(stations, coords, overrides)
    assert located == [LocatedStation(stations[0], -32.4, 26.7),
                       LocatedStation(stations[1], -32.098, 28.311)]
    assert unmatched == ["Ghost Town"]
```

- [ ] **Step 4: Run tests, verify they fail**

Run: `cd "C:\Fable makes my app\tools\saps-import" && .venv/Scripts/python -m pytest tests -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'saps'`

- [ ] **Step 5: Implement `tools/saps-import/saps.py`**

```python
"""Parsing and joining logic for the SAPS quarterly crime stats import.

Pure functions only — no database access — so everything is unit-testable.
"""
from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path


def normalize_name(name: str) -> str:
    """Join key for station names: uppercase, alphanumerics only."""
    return re.sub(r"[^A-Z0-9]", "", name.upper())


@dataclass(frozen=True)
class Station:
    name: str
    district: str
    province: str


@dataclass(frozen=True)
class LocatedStation:
    station: Station
    lat: float
    lng: float


def parse_coords(path: str | Path) -> dict[str, tuple[float, float]]:
    """openAFRICA CSV: compnt_nm, location_x (lng), location_y (lat)."""
    with open(path, encoding="utf-8-sig", newline="") as f:
        return {
            normalize_name(row["compnt_nm"]): (float(row["location_y"]), float(row["location_x"]))
            for row in csv.DictReader(f)
        }


def parse_overrides(path: str | Path) -> dict[str, tuple[float, float]]:
    """overrides.csv columns: workbook_name, lat, lng. Wins over the openAFRICA CSV."""
    with open(path, encoding="utf-8-sig", newline="") as f:
        return {
            normalize_name(row["workbook_name"]): (float(row["lat"]), float(row["lng"]))
            for row in csv.DictReader(f)
            if row.get("workbook_name")
        }


def join_coords(
    stations: list[Station],
    coords: dict[str, tuple[float, float]],
    overrides: dict[str, tuple[float, float]],
) -> tuple[list[LocatedStation], list[str]]:
    """Attach coordinates to stations; overrides beat the CSV. Unmatched are skipped, never dropped silently."""
    located: list[LocatedStation] = []
    unmatched: list[str] = []
    for station in stations:
        key = normalize_name(station.name)
        point = overrides.get(key) or coords.get(key)
        if point is None:
            unmatched.append(station.name)
        else:
            located.append(LocatedStation(station, point[0], point[1]))
    return located, sorted(unmatched)
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `cd "C:\Fable makes my app\tools\saps-import" && .venv/Scripts/python -m pytest tests -q`
Expected: `4 passed`

- [ ] **Step 7: Ensure `.venv` is ignored** — check repo root `.gitignore` contains a `.venv/` (or equivalent) rule; if not, append `.venv/`.

- [ ] **Step 8: Commit**

```bash
git add tools/saps-import/requirements.txt tools/saps-import/saps.py tools/saps-import/tests/test_saps.py .gitignore
git commit -m "feat(import): SAPS station name join with coordinate overrides"
```

---

### Task 2: Importer — workbook parsing

**Files:**
- Modify: `tools/saps-import/saps.py`
- Modify: `tools/saps-import/tests/test_saps.py`

**Interfaces:**
- Consumes: `Station` from Task 1.
- Produces: `StatRow(station_name: str, category: str, month: datetime.date, count: int)` frozen dataclass; `WorkbookData(stations: list[Station], stats: list[StatRow])`; `parse_workbook(path) -> WorkbookData` (raises `ValueError` if no month columns); `month_columns(header_row: tuple) -> dict[int, datetime.date]`; `CategoryNormalizer` with `canonical(raw: str) -> str`.

The `RAW Data` sheet layout (verified against the real Q4 2025/26 file): header on **row 3**, data from row 4. 0-based columns: `Comp level`=2, `Station`=4, `District`=5, `Province`=6, `Crime_Category`=7. Month columns hold `datetime` header cells (Jan/Feb/Mar × 2022–2026); quarter-total and ranking columns have string headers and must be ignored. Only rows with `Comp level == "Station"` count.

- [ ] **Step 1: Add failing tests** to `tools/saps-import/tests/test_saps.py`:

```python
import datetime as dt

import openpyxl

from saps import CategoryNormalizer, StatRow, month_columns, parse_workbook


def test_month_columns_picks_only_datetime_headers():
    header = ("x", None, "Comp level", 42, dt.datetime(2026, 1, 15), "Jan 2026 total", dt.datetime(2026, 2, 1))
    assert month_columns(header) == {4: dt.date(2026, 1, 1), 6: dt.date(2026, 2, 1)}


def test_category_normalizer_first_seen_spelling_wins():
    n = CategoryNormalizer()
    assert n.canonical("17 Community reported serious Crime") == "17 Community reported serious Crime"
    assert n.canonical("17 Community reported serious crime") == "17 Community reported serious Crime"
    assert n.canonical("Murder") == "Murder"


def build_fixture(path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "RAW Data"
    ws.append([""] * 12)
    ws.append([""] * 12)
    header = [""] * 12
    header[2], header[4], header[5], header[6], header[7] = (
        "Comp level", "Station", "District", "Province", "Crime_Category")
    header[9], header[10], header[11] = (
        dt.datetime(2026, 1, 1), dt.datetime(2026, 2, 1), dt.datetime(2026, 3, 1))
    ws.append(header)

    def row(level, station, cat, jan, feb, mar):
        r = [""] * 12
        r[2], r[4], r[5], r[6], r[7] = level, station, "Test District", "Test Province", cat
        r[9], r[10], r[11] = jan, feb, mar
        return r

    ws.append(row("Station", "Testville", "Murder", 1, 2, 3))
    ws.append(row("Station", "Testville", "murder", 4, None, 6))     # case variant merges; None skipped
    ws.append(row("Province", "Test Province", "Murder", 9, 9, 9))   # non-station rows filtered
    wb.save(path)


def test_parse_workbook_filters_merges_and_expands_months(tmp_path):
    path = tmp_path / "fixture.xlsx"
    build_fixture(path)
    data = parse_workbook(path)

    assert [s.name for s in data.stations] == ["Testville"]
    assert data.stations[0].district == "Test District"
    assert all(row.category == "Murder" for row in data.stats)  # "murder" merged into first-seen casing
    assert len(data.stats) == 5  # 3 months + 2 non-empty months on the variant row
    assert StatRow("Testville", "Murder", dt.date(2026, 2, 1), 2) in data.stats
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `cd "C:\Fable makes my app\tools\saps-import" && .venv/Scripts/python -m pytest tests -q`
Expected: FAIL — `ImportError: cannot import name 'CategoryNormalizer'`

- [ ] **Step 3: Implement in `saps.py`** (append; also add `import datetime as dt`, `from dataclasses import field`, `import openpyxl` to the imports):

```python
RAW_SHEET = "RAW Data"
HEADER_ROW = 3
COL_COMP_LEVEL = 2
COL_STATION = 4
COL_DISTRICT = 5
COL_PROVINCE = 6
COL_CATEGORY = 7


class CategoryNormalizer:
    """Merges category-name case variants; the first-seen spelling wins."""

    def __init__(self) -> None:
        self._canonical: dict[str, str] = {}

    def canonical(self, raw: str) -> str:
        key = raw.strip().casefold()
        return self._canonical.setdefault(key, raw.strip())


@dataclass(frozen=True)
class StatRow:
    station_name: str
    category: str
    month: dt.date
    count: int


@dataclass
class WorkbookData:
    stations: list[Station] = field(default_factory=list)
    stats: list[StatRow] = field(default_factory=list)


def month_columns(header_row: tuple) -> dict[int, dt.date]:
    """Column index -> first-of-month date for every datetime header cell."""
    return {
        idx: dt.date(cell.year, cell.month, 1)
        for idx, cell in enumerate(header_row)
        if isinstance(cell, (dt.datetime, dt.date))
    }


def parse_workbook(path: str | Path) -> WorkbookData:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = wb[RAW_SHEET].iter_rows(values_only=True)
    header = None
    for _ in range(HEADER_ROW):
        header = next(rows)
    months = month_columns(header)
    if not months:
        raise ValueError("no month columns found in RAW Data header row")

    categories = CategoryNormalizer()
    seen: dict[str, Station] = {}
    data = WorkbookData()
    for row in rows:
        if row[COL_COMP_LEVEL] != "Station" or not row[COL_STATION]:
            continue
        name = str(row[COL_STATION]).strip()
        if name not in seen:
            station = Station(name, str(row[COL_DISTRICT]).strip(), str(row[COL_PROVINCE]).strip())
            seen[name] = station
            data.stations.append(station)
        category = categories.canonical(str(row[COL_CATEGORY]))
        for idx, month in months.items():
            value = row[idx]
            if value is None or value == "":
                continue
            data.stats.append(StatRow(name, category, month, int(value)))
    return data
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `cd "C:\Fable makes my app\tools\saps-import" && .venv/Scripts/python -m pytest tests -q`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/saps-import/saps.py tools/saps-import/tests/test_saps.py
git commit -m "feat(import): parse SAPS workbook station rows with dynamic month columns"
```

---

### Task 3: Importer — CLI entrypoint, upserts, data files

**Files:**
- Create: `tools/saps-import/import_saps.py`
- Create: `tools/saps-import/data/saps_station_coords.csv`
- Create: `tools/saps-import/data/overrides.csv`
- Modify: `tools/saps-import/tests/test_saps.py` (test for `chunked` only — DB code stays thin and is verified live in Task 12)

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces: `python import_saps.py --xlsx <path> [--coords <path>] [--overrides <path>]`, reading `DATABASE_URL` from the environment; exit 0 on success, 1 on missing env/zero stations. Table/column names must match Task 4's migration exactly: `police_stations(name, district, province, lat, lng)`, `station_crime_stats(station_id, category, period_month, count)`.

- [ ] **Step 1: Download the coordinates CSV into the repo** (already fetched once this session; re-download is fine):

```bash
curl -sL -o "C:\Fable makes my app\tools\saps-import\data\saps_station_coords.csv" "https://open.africa/dataset/c59bd43a-ed47-45b3-b784-0842e6052b7b/resource/a1c2c4d9-04a5-46ae-be2e-50984293db7d/download/geo_export_b681af05_ce59_42e8_87e6_41af282b0a6e.csv"
```

Verify: file starts with header `the_geom,compnt_nm,create_dt,location_x,location_y,version` and has 1,141 lines.

- [ ] **Step 2: Create `tools/saps-import/data/overrides.csv`** (header only; entries added as unmatched stations get looked up):

```
workbook_name,lat,lng
```

- [ ] **Step 3: Write the failing test** (append to `tests/test_saps.py`):

```python
def test_chunked_splits_preserving_order():
    from import_saps import chunked
    assert chunked([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]
    assert chunked([], 2) == []
```

Run: `cd "C:\Fable makes my app\tools\saps-import" && .venv/Scripts/python -m pytest tests -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'import_saps'`

- [ ] **Step 4: Implement `tools/saps-import/import_saps.py`**

```python
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
```

- [ ] **Step 5: Run tests, verify all pass**

Run: `cd "C:\Fable makes my app\tools\saps-import" && .venv/Scripts/python -m pytest tests -q`
Expected: `9 passed`

- [ ] **Step 6: Smoke-check the CLI fails fast without DATABASE_URL**

Run (Git Bash): `cd "C:\Fable makes my app\tools\saps-import" && DATABASE_URL= .venv/Scripts/python import_saps.py --xlsx nope.xlsx; echo "exit=$?"`
Expected: `DATABASE_URL is not set`, `exit=1`

- [ ] **Step 7: Commit**

```bash
git add tools/saps-import/import_saps.py tools/saps-import/data tools/saps-import/tests/test_saps.py
git commit -m "feat(import): idempotent SAPS import CLI with station coordinate data"
```

---

### Task 4: API — Flyway V3 migration, entity, repository

**Files:**
- Create: `services/alerts-api/src/main/resources/db/migration/V3__police_stations.sql`
- Create: `services/alerts-api/src/main/java/com/communityalerts/api/domain/PoliceStation.java`
- Create: `services/alerts-api/src/main/java/com/communityalerts/api/repository/PoliceStationRepository.java`

**Interfaces:**
- Produces: `PoliceStation` JPA entity (`Long getId()`, `String getName()/getDistrict()/getProvince()`, `double getLat()/getLng()`, setters for all); `PoliceStationRepository extends JpaRepository<PoliceStation, Long>` with `List<PoliceStation> findInBounds(double minLat, double maxLat, double minLng, double maxLng)` and `List<QuarterTotalRow> quarterTotals(long stationId)` where `QuarterTotalRow` exposes `String getCategory(); int getYr(); int getQtr(); long getTotal();`.

No unit test of its own: repository SQL is exercised against the live DB in Task 12 (matching how `AlertRepository` is covered); this task's gate is a green compile + existing suite.

- [ ] **Step 1: Create `V3__police_stations.sql`**

```sql
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
```

- [ ] **Step 2: Create `PoliceStation.java`**

```java
package com.communityalerts.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Official SAPS station reference data; rows are written by tools/saps-import. */
@Entity
@Table(name = "police_stations")
public class PoliceStation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private String district;

    @Column(nullable = false)
    private String province;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getProvince() { return province; }
    public void setProvince(String province) { this.province = province; }

    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }

    public double getLng() { return lng; }
    public void setLng(double lng) { this.lng = lng; }
}
```

- [ ] **Step 3: Create `PoliceStationRepository.java`**

```java
package com.communityalerts.api.repository;

import com.communityalerts.api.domain.PoliceStation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PoliceStationRepository extends JpaRepository<PoliceStation, Long> {

    @Query(value = """
            SELECT * FROM police_stations
            WHERE lat BETWEEN :minLat AND :maxLat
              AND lng BETWEEN :minLng AND :maxLng
            ORDER BY name
            LIMIT 500
            """, nativeQuery = true)
    List<PoliceStation> findInBounds(@Param("minLat") double minLat,
                                     @Param("maxLat") double maxLat,
                                     @Param("minLng") double minLng,
                                     @Param("maxLng") double maxLng);

    interface QuarterTotalRow {
        String getCategory();
        int getYr();
        int getQtr();
        long getTotal();
    }

    /**
     * Quarterly totals per category for one station. station_crime_stats has
     * no JPA entity — it is importer-owned and only ever read via this query.
     */
    @Query(value = """
            SELECT s.category AS category,
                   CAST(EXTRACT(YEAR FROM s.period_month) AS int)    AS yr,
                   CAST(EXTRACT(QUARTER FROM s.period_month) AS int) AS qtr,
                   SUM(s.count) AS total
            FROM station_crime_stats s
            WHERE s.station_id = :stationId
            GROUP BY 1, 2, 3
            """, nativeQuery = true)
    List<QuarterTotalRow> quarterTotals(@Param("stationId") long stationId);
}
```

- [ ] **Step 4: Compile + run the existing suite (must stay green)**

Run: `docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" -v communityalerts-m2:/root/.m2 -w /workspace maven:3.9-eclipse-temurin-21 mvn -B test`
Expected: `BUILD SUCCESS`, all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/alerts-api/src/main/resources/db/migration/V3__police_stations.sql services/alerts-api/src/main/java/com/communityalerts/api/domain/PoliceStation.java services/alerts-api/src/main/java/com/communityalerts/api/repository/PoliceStationRepository.java
git commit -m "feat(api): police station schema, entity, and repository queries"
```

---

### Task 5: API — StationService bbox lookup (TDD)

**Files:**
- Create: `services/alerts-api/src/main/java/com/communityalerts/api/dto/StationResponse.java`
- Create: `services/alerts-api/src/main/java/com/communityalerts/api/service/StationService.java`
- Create: `services/alerts-api/src/test/java/com/communityalerts/api/service/StationServiceTest.java`

**Interfaces:**
- Consumes: `PoliceStationRepository.findInBounds(...)` (Task 4); existing `BadRequestException` in `com.communityalerts.api.error`.
- Produces: `record StationResponse(long id, String name, String district, String province, double lat, double lng)` with `static StationResponse from(PoliceStation)`; `StationService.findInBounds(double minLat, double maxLat, double minLng, double maxLng) -> List<StationResponse>`; constants `StationService.CACHE_TTL` (1 h) and `StationService.AGGREGATE_CATEGORY`.

- [ ] **Step 1: Create `StationResponse.java`**

```java
package com.communityalerts.api.dto;

import com.communityalerts.api.domain.PoliceStation;

public record StationResponse(long id, String name, String district, String province,
                              double lat, double lng) {

    public static StationResponse from(PoliceStation station) {
        return new StationResponse(station.getId(), station.getName(), station.getDistrict(),
                station.getProvince(), station.getLat(), station.getLng());
    }
}
```

- [ ] **Step 2: Write the failing tests** — `StationServiceTest.java` (same Mockito style as `StatsServiceTest`):

```java
package com.communityalerts.api.service;

import com.communityalerts.api.domain.PoliceStation;
import com.communityalerts.api.dto.StationResponse;
import com.communityalerts.api.error.BadRequestException;
import com.communityalerts.api.repository.PoliceStationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationServiceTest {

    @Mock
    private PoliceStationRepository repository;
    @Mock
    private StringRedisTemplate redis;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private StationService stationService;

    @BeforeEach
    void setUp() {
        stationService = new StationService(repository, redis, objectMapper);
    }

    private static PoliceStation station(long id, String name) {
        PoliceStation s = new PoliceStation();
        s.setId(id);
        s.setName(name);
        s.setDistrict("Ehlanzeni District");
        s.setProvince("Mpumalanga");
        s.setLat(-24.6);
        s.setLng(31.1);
        return s;
    }

    @Test
    @DisplayName("inverted or out-of-range bounds are rejected before touching the database")
    void invalidBoundsRejected() {
        assertThatThrownBy(() -> stationService.findInBounds(10, 5, 0, 1))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> stationService.findInBounds(-91, 5, 0, 1))
                .isInstanceOf(BadRequestException.class);
        verify(repository, never()).findInBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("cache miss queries the database and writes the cache with a 1h TTL")
    void cacheMissFallsThrough() {
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(repository.findInBounds(-25.0, -24.0, 31.0, 32.0))
                .thenReturn(List.of(station(1, "Acornhoek")));

        List<StationResponse> result = stationService.findInBounds(-25.0, -24.0, 31.0, 32.0);

        assertThat(result).containsExactly(
                new StationResponse(1, "Acornhoek", "Ehlanzeni District", "Mpumalanga", -24.6, 31.1));
        verify(valueOperations).set(startsWith("stations:bbox:"), anyString(),
                eq(StationService.CACHE_TTL));
    }

    @Test
    @DisplayName("cache hit never touches the database")
    void cacheHitSkipsDatabase() throws Exception {
        List<StationResponse> cached = List.of(
                new StationResponse(1, "Acornhoek", "Ehlanzeni District", "Mpumalanga", -24.6, 31.1));
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(objectMapper.writeValueAsString(cached));

        assertThat(stationService.findInBounds(-25.0, -24.0, 31.0, 32.0)).isEqualTo(cached);
        verify(repository, never()).findInBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("a Redis outage falls back to the database (fail open)")
    void redisOutageFailsOpen() {
        when(redis.opsForValue()).thenThrow(new RuntimeException("redis down"));
        when(repository.findInBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(station(1, "Acornhoek")));

        assertThat(stationService.findInBounds(-25.0, -24.0, 31.0, 32.0)).hasSize(1);
    }
}
```

- [ ] **Step 3: Run the new test class, verify it fails to compile (StationService missing)**

Run: `docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" -v communityalerts-m2:/root/.m2 -w /workspace maven:3.9-eclipse-temurin-21 mvn -B test -Dtest=StationServiceTest`
Expected: compilation error — `cannot find symbol: class StationService`

- [ ] **Step 4: Implement `StationService.java`** (bbox half only; `stats` arrives in Task 6):

```java
package com.communityalerts.api.service;

import com.communityalerts.api.dto.StationResponse;
import com.communityalerts.api.error.BadRequestException;
import com.communityalerts.api.repository.PoliceStationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Locale;

/**
 * Official SAPS reference data: station markers for the map viewport and
 * per-station quarterly crime stats. The data changes only when the quarterly
 * import runs, so lookups are cached generously; Redis failures fall back to
 * SQL (same fail-open stance as the rest of the API).
 */
@Service
public class StationService {

    /** Headline aggregate; excluded from category lists. Comparison is case-insensitive. */
    public static final String AGGREGATE_CATEGORY = "17 community reported serious crime";

    public static final Duration CACHE_TTL = Duration.ofHours(1);

    private static final Logger log = LoggerFactory.getLogger(StationService.class);

    private final PoliceStationRepository repository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public StationService(PoliceStationRepository repository,
                          StringRedisTemplate redis,
                          ObjectMapper objectMapper) {
        this.repository = repository;
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<StationResponse> findInBounds(double minLat, double maxLat,
                                              double minLng, double maxLng) {
        if (minLat >= maxLat || minLng >= maxLng
                || minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
            throw new BadRequestException("Invalid bounding box");
        }
        String key = String.format(Locale.ROOT, "stations:bbox:%.2f:%.2f:%.2f:%.2f",
                minLat, maxLat, minLng, maxLng);
        List<StationResponse> cached = readCache(key, new TypeReference<List<StationResponse>>() {});
        if (cached != null) {
            return cached;
        }
        List<StationResponse> stations = repository.findInBounds(minLat, maxLat, minLng, maxLng)
                .stream().map(StationResponse::from).toList();
        writeCache(key, stations);
        return stations;
    }

    private <T> T readCache(String key, TypeReference<T> type) {
        try {
            String cached = redis.opsForValue().get(key);
            if (cached != null) {
                return objectMapper.readValue(cached, type);
            }
        } catch (Exception e) {
            log.warn("Station cache read failed for {}", key, e);
        }
        return null;
    }

    private void writeCache(String key, Object value) {
        try {
            redis.opsForValue().set(key, objectMapper.writeValueAsString(value), CACHE_TTL);
        } catch (Exception e) {
            log.warn("Station cache write failed for {}", key, e);
        }
    }
}
```

- [ ] **Step 5: Run the test class, verify it passes**

Run: `docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" -v communityalerts-m2:/root/.m2 -w /workspace maven:3.9-eclipse-temurin-21 mvn -B test -Dtest=StationServiceTest`
Expected: `Tests run: 4, Failures: 0`

- [ ] **Step 6: Commit**

```bash
git add services/alerts-api/src/main/java/com/communityalerts/api/dto/StationResponse.java services/alerts-api/src/main/java/com/communityalerts/api/service/StationService.java services/alerts-api/src/test/java/com/communityalerts/api/service/StationServiceTest.java
git commit -m "feat(api): cached bounding-box station lookup"
```

---

### Task 6: API — station stats aggregation (TDD)

**Files:**
- Create: `services/alerts-api/src/main/java/com/communityalerts/api/dto/StationStatsResponse.java`
- Modify: `services/alerts-api/src/main/java/com/communityalerts/api/service/StationService.java`
- Modify: `services/alerts-api/src/test/java/com/communityalerts/api/service/StationServiceTest.java`

**Interfaces:**
- Consumes: `PoliceStationRepository.quarterTotals(long)` + `QuarterTotalRow` (Task 4); existing `NotFoundException`.
- Produces: `StationService.stats(long id) -> StationStatsResponse`; the response record below (exact JSON contract for Task 8's web types).

- [ ] **Step 1: Create `StationStatsResponse.java`**

```java
package com.communityalerts.api.dto;

import java.util.List;
import java.util.Map;

public record StationStatsResponse(
        StationResponse station,
        LatestQuarter latestQuarter,   // null when a station has no stat rows
        List<CategoryStats> categories) {

    public record LatestQuarter(String label,
                                long totalSerious,
                                Long totalSeriousPrevYear,   // null when no prior-year data
                                List<TopCategory> topCategories) {}

    public record TopCategory(String category, long count, Long prevYearCount) {}

    public record CategoryStats(String category, List<Period> periods) {}

    /** One 3-month window ("Jan–Mar") with totals keyed by year ("2022" .. "2026"). */
    public record Period(String months, Map<String, Long> totals) {}
}
```

- [ ] **Step 2: Add failing tests** to `StationServiceTest.java` (add imports `com.communityalerts.api.dto.StationStatsResponse`, `com.communityalerts.api.error.NotFoundException`, `com.communityalerts.api.repository.PoliceStationRepository.QuarterTotalRow`, `java.util.Optional`):

```java
    private static QuarterTotalRow row(String category, int yr, int qtr, long total) {
        return new QuarterTotalRow() {
            @Override public String getCategory() { return category; }
            @Override public int getYr() { return yr; }
            @Override public int getQtr() { return qtr; }
            @Override public long getTotal() { return total; }
        };
    }

    @Test
    @DisplayName("stats for an unknown station is a 404")
    void statsUnknownStation() {
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stationService.stats(99L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("stats aggregates the latest quarter, excludes the headline aggregate, and orders top categories")
    void statsBuildsResponse() {
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(repository.findById(1L)).thenReturn(Optional.of(station(1, "Acornhoek")));
        when(repository.quarterTotals(1L)).thenReturn(List.of(
                // aggregate arrives with the workbook's mixed casing
                row("17 Community reported serious Crime", 2026, 1, 120),
                row("17 Community reported serious Crime", 2025, 1, 150),
                row("Murder", 2026, 1, 8),
                row("Murder", 2025, 1, 9),
                row("Robbery with aggravating circumstances", 2026, 1, 28),
                row("Robbery with aggravating circumstances", 2025, 1, 24),
                row("Arson", 2026, 1, 1)));

        StationStatsResponse response = stationService.stats(1L);

        assertThat(response.station().name()).isEqualTo("Acornhoek");
        assertThat(response.latestQuarter().label()).isEqualTo("Jan–Mar 2026");
        assertThat(response.latestQuarter().totalSerious()).isEqualTo(120);
        assertThat(response.latestQuarter().totalSeriousPrevYear()).isEqualTo(150);
        assertThat(response.latestQuarter().topCategories())
                .extracting(StationStatsResponse.TopCategory::category)
                .containsExactly("Robbery with aggravating circumstances", "Murder", "Arson");
        assertThat(response.latestQuarter().topCategories().get(1).prevYearCount()).isEqualTo(9);
        assertThat(response.latestQuarter().topCategories().get(2).prevYearCount()).isNull();

        // categories exclude the aggregate and are ordered by latest-quarter count
        assertThat(response.categories())
                .extracting(StationStatsResponse.CategoryStats::category)
                .containsExactly("Robbery with aggravating circumstances", "Murder", "Arson");
        StationStatsResponse.Period murder = response.categories().get(1).periods().get(0);
        assertThat(murder.months()).isEqualTo("Jan–Mar");
        assertThat(murder.totals()).containsEntry("2026", 8L).containsEntry("2025", 9L);
    }

    @Test
    @DisplayName("a station with no stat rows yields a null latest quarter and empty categories")
    void statsEmptyStation() {
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(repository.findById(1L)).thenReturn(Optional.of(station(1, "Acornhoek")));
        when(repository.quarterTotals(1L)).thenReturn(List.of());

        StationStatsResponse response = stationService.stats(1L);

        assertThat(response.latestQuarter()).isNull();
        assertThat(response.categories()).isEmpty();
    }
```

- [ ] **Step 3: Run, verify compilation failure (`stats` missing)**

Run: `docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" -v communityalerts-m2:/root/.m2 -w /workspace maven:3.9-eclipse-temurin-21 mvn -B test -Dtest=StationServiceTest`
Expected: compilation error — `cannot find symbol: method stats(long)`

- [ ] **Step 4: Implement `stats` in `StationService.java`** (add imports: `StationStatsResponse`, `NotFoundException`, `PoliceStationRepository.QuarterTotalRow`, `java.util.Comparator`, `java.util.LinkedHashMap`, `java.util.Map`, `java.util.TreeMap`):

```java
    private static final String[] QUARTER_LABELS = {"Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"};
    private static final int TOP_CATEGORY_LIMIT = 5;

    @Transactional(readOnly = true)
    public StationStatsResponse stats(long id) {
        String key = "stations:stats:" + id;
        StationStatsResponse cached = readCache(key, new TypeReference<StationStatsResponse>() {});
        if (cached != null) {
            return cached;
        }
        StationResponse station = repository.findById(id)
                .map(StationResponse::from)
                .orElseThrow(() -> new NotFoundException("Unknown station: " + id));
        StationStatsResponse response = buildStats(station, repository.quarterTotals(id));
        writeCache(key, response);
        return response;
    }

    private StationStatsResponse buildStats(StationResponse station, List<QuarterTotalRow> rows) {
        if (rows.isEmpty()) {
            return new StationStatsResponse(station, null, List.of());
        }
        int latestYear = 0;
        int latestQtr = 0;
        for (QuarterTotalRow row : rows) {
            if (row.getYr() > latestYear || (row.getYr() == latestYear && row.getQtr() > latestQtr)) {
                latestYear = row.getYr();
                latestQtr = row.getQtr();
            }
        }
        final int year = latestYear;
        final int qtr = latestQtr;

        // category -> quarter -> year -> total; TreeMaps keep quarters and years ordered.
        Map<String, Map<Integer, Map<Integer, Long>>> byCategory = new TreeMap<>();
        for (QuarterTotalRow row : rows) {
            byCategory.computeIfAbsent(row.getCategory(), c -> new TreeMap<>())
                    .computeIfAbsent(row.getQtr(), q -> new TreeMap<>())
                    .merge(row.getYr(), row.getTotal(), Long::sum);
        }

        String aggregateKey = byCategory.keySet().stream()
                .filter(c -> c.toLowerCase(Locale.ROOT).equals(AGGREGATE_CATEGORY))
                .findFirst().orElse(null);
        long totalSerious = 0;
        Long totalSeriousPrevYear = null;
        if (aggregateKey != null) {
            Map<Integer, Long> years = byCategory.get(aggregateKey).getOrDefault(qtr, Map.of());
            totalSerious = years.getOrDefault(year, 0L);
            totalSeriousPrevYear = years.get(year - 1);
        }

        List<StationStatsResponse.TopCategory> top = byCategory.entrySet().stream()
                .filter(e -> !e.getKey().equals(aggregateKey))
                .map(e -> {
                    Map<Integer, Long> years = e.getValue().getOrDefault(qtr, Map.of());
                    return new StationStatsResponse.TopCategory(
                            e.getKey(), years.getOrDefault(year, 0L), years.get(year - 1));
                })
                .sorted(Comparator.comparingLong(StationStatsResponse.TopCategory::count).reversed())
                .limit(TOP_CATEGORY_LIMIT)
                .toList();

        List<StationStatsResponse.CategoryStats> categories = byCategory.entrySet().stream()
                .filter(e -> !e.getKey().equals(aggregateKey))
                .map(e -> new StationStatsResponse.CategoryStats(
                        e.getKey(),
                        e.getValue().entrySet().stream()
                                .map(q -> new StationStatsResponse.Period(
                                        QUARTER_LABELS[q.getKey() - 1], toYearTotals(q.getValue())))
                                .toList()))
                .sorted(Comparator
                        .comparingLong((StationStatsResponse.CategoryStats c) ->
                                latestCount(byCategory, c.category(), qtr, year))
                        .reversed()
                        .thenComparing(StationStatsResponse.CategoryStats::category))
                .toList();

        StationStatsResponse.LatestQuarter latest = new StationStatsResponse.LatestQuarter(
                QUARTER_LABELS[qtr - 1] + " " + year, totalSerious, totalSeriousPrevYear, top);
        return new StationStatsResponse(station, latest, categories);
    }

    private static Map<String, Long> toYearTotals(Map<Integer, Long> byYear) {
        Map<String, Long> totals = new LinkedHashMap<>();
        byYear.forEach((y, total) -> totals.put(String.valueOf(y), total));
        return totals;
    }

    private static long latestCount(Map<String, Map<Integer, Map<Integer, Long>>> byCategory,
                                    String category, int qtr, int year) {
        return byCategory.getOrDefault(category, Map.of())
                .getOrDefault(qtr, Map.of())
                .getOrDefault(year, 0L);
    }
```

- [ ] **Step 5: Run the test class, verify all pass**

Run: `docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" -v communityalerts-m2:/root/.m2 -w /workspace maven:3.9-eclipse-temurin-21 mvn -B test -Dtest=StationServiceTest`
Expected: `Tests run: 7, Failures: 0`

- [ ] **Step 6: Commit**

```bash
git add services/alerts-api/src/main/java/com/communityalerts/api/dto/StationStatsResponse.java services/alerts-api/src/main/java/com/communityalerts/api/service/StationService.java services/alerts-api/src/test/java/com/communityalerts/api/service/StationServiceTest.java
git commit -m "feat(api): per-station quarterly crime stats aggregation"
```

---

### Task 7: API — StationController

**Files:**
- Create: `services/alerts-api/src/main/java/com/communityalerts/api/web/StationController.java`

**Interfaces:**
- Consumes: `StationService.findInBounds(...)`, `StationService.stats(long)`.
- Produces: `GET /api/v1/stations?minLat&maxLat&minLng&maxLng` → `List<StationResponse>`; `GET /api/v1/stations/{id}/stats` → `StationStatsResponse`. Missing params → Spring's default 400; `BadRequestException`/`NotFoundException` → 400/404 via the existing `GlobalExceptionHandler`.

The controller is deliberately thin (delegation only); the repo has no controller-layer tests, so coverage lives in `StationServiceTest` — matching `StatsController` precedent.

- [ ] **Step 1: Create `StationController.java`**

```java
package com.communityalerts.api.web;

import com.communityalerts.api.dto.StationResponse;
import com.communityalerts.api.dto.StationStatsResponse;
import com.communityalerts.api.service.StationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Anonymous read-only endpoints for official SAPS station reference data. */
@RestController
@RequestMapping("/api/v1")
public class StationController {

    private final StationService stationService;

    public StationController(StationService stationService) {
        this.stationService = stationService;
    }

    @GetMapping("/stations")
    public List<StationResponse> inBounds(@RequestParam double minLat,
                                          @RequestParam double maxLat,
                                          @RequestParam double minLng,
                                          @RequestParam double maxLng) {
        return stationService.findInBounds(minLat, maxLat, minLng, maxLng);
    }

    @GetMapping("/stations/{id}/stats")
    public StationStatsResponse stats(@PathVariable long id) {
        return stationService.stats(id);
    }
}
```

- [ ] **Step 2: Run the full API suite**

Run: `docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" -v communityalerts-m2:/root/.m2 -w /workspace maven:3.9-eclipse-temurin-21 mvn -B test`
Expected: `BUILD SUCCESS`, all tests green.

- [ ] **Step 3: Commit**

```bash
git add services/alerts-api/src/main/java/com/communityalerts/api/web/StationController.java
git commit -m "feat(api): station endpoints for map viewport and stats"
```

---

### Task 8: Web — types and API fetchers

**Files:**
- Modify: `apps/web/src/lib/types.ts` (append at end)
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Consumes: JSON contracts from Tasks 5–7.
- Produces: types `PoliceStation`, `StationTopCategory`, `StationLatestQuarter`, `StationCategoryPeriod`, `StationCategoryStats`, `StationStats`, `MapBounds`; `api.fetchStations(bounds: MapBounds): Promise<PoliceStation[]>`; `api.fetchStationStats(id: number): Promise<StationStats>`.

- [ ] **Step 1: Append to `types.ts`**

```ts
export interface PoliceStation {
  id: number;
  name: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
}

export interface StationTopCategory {
  category: string;
  count: number;
  prevYearCount: number | null;
}

export interface StationLatestQuarter {
  label: string;
  totalSerious: number;
  totalSeriousPrevYear: number | null;
  topCategories: StationTopCategory[];
}

/** One 3-month window ("Jan–Mar") with totals keyed by year ("2022".."2026"). */
export interface StationCategoryPeriod {
  months: string;
  totals: Record<string, number>;
}

export interface StationCategoryStats {
  category: string;
  periods: StationCategoryPeriod[];
}

export interface StationStats {
  station: PoliceStation;
  latestQuarter: StationLatestQuarter | null;
  categories: StationCategoryStats[];
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
```

- [ ] **Step 2: Add fetchers to `api.ts`** — add `MapBounds`, `PoliceStation`, `StationStats` to the type import block, then append inside the `api` object:

```ts
  fetchStations(bounds: MapBounds): Promise<PoliceStation[]> {
    const params = new URLSearchParams({
      minLat: String(bounds.minLat),
      maxLat: String(bounds.maxLat),
      minLng: String(bounds.minLng),
      maxLng: String(bounds.maxLng),
    });
    return request<PoliceStation[]>(`/api/v1/stations?${params}`);
  },

  fetchStationStats(id: number): Promise<StationStats> {
    return request<StationStats>(`/api/v1/stations/${id}/stats`);
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd "C:\Fable makes my app\apps\web" && npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(web): station types and API fetchers"
```

---

### Task 9: Web — StationLayer with zoom-gated viewport fetching

**Files:**
- Create: `apps/web/src/components/StationLayer.tsx`
- Modify: `apps/web/src/components/AlertMap.tsx`
- Modify: `apps/web/src/app/globals.css` (append)

**Interfaces:**
- Consumes: `api.fetchStations`, `api.fetchStationStats` (Task 8).
- Produces: `<StationLayer onZoomGateChange={(gated: boolean) => void} onFetchError={() => void} onOpenStats={(stats: StationStats) => void} />` rendered inside `MapContainer`; new `AlertMap` props `showStations: boolean`, `onStationZoomGate: (gated: boolean) => void`, `onStationsError: () => void`, `onOpenStationStats: (stats: StationStats) => void`; exported `STATION_MIN_ZOOM = 10`.

- [ ] **Step 1: Create `StationLayer.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";

import { api } from "@/lib/api";
import type { PoliceStation, StationLatestQuarter, StationStats } from "@/lib/types";

export const STATION_MIN_ZOOM = 10;
const FETCH_DEBOUNCE_MS = 300;

// Shield glyph as a DivIcon: no image assets (they don't survive bundling —
// see ZONE_HANDLE_ICON in AlertMap) and no clustering dependency.
const STATION_ICON = L.divIcon({
  className: "station-marker",
  html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"/></svg>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

type StatsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; stats: StationStats };

interface StationLayerProps {
  onZoomGateChange: (gated: boolean) => void;
  onFetchError: () => void;
  onOpenStats: (stats: StationStats) => void;
}

export default function StationLayer({
  onZoomGateChange,
  onFetchError,
  onOpenStats,
}: StationLayerProps) {
  const map = useMap();
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [statsById, setStatsById] = useState<Record<number, StatsState>>({});
  const debounceRef = useRef<number | undefined>(undefined);
  const lastBoundsKeyRef = useRef("");

  const refresh = useCallback(() => {
    const gated = map.getZoom() < STATION_MIN_ZOOM;
    onZoomGateChange(gated);
    if (gated) {
      setStations([]);
      lastBoundsKeyRef.current = "";
      return;
    }
    const b = map.getBounds();
    const bounds = {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    };
    // Two decimals ≈ 1 km: dedupes tiny pans and aligns with the API cache key.
    const key = [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng]
      .map((v) => v.toFixed(2))
      .join(":");
    if (key === lastBoundsKeyRef.current) return;

    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const result = await api.fetchStations(bounds);
        lastBoundsKeyRef.current = key;
        setStations(result);
      } catch {
        onFetchError();
      }
    }, FETCH_DEBOUNCE_MS);
  }, [map, onZoomGateChange, onFetchError]);

  useMapEvents({ moveend: refresh, zoomend: refresh });

  useEffect(() => {
    refresh();
    return () => window.clearTimeout(debounceRef.current);
  }, [refresh]);

  const loadStats = useCallback((stationId: number) => {
    setStatsById((current) => {
      const existing = current[stationId];
      if (existing && existing.status !== "error") return current;
      return { ...current, [stationId]: { status: "loading" } };
    });
    api
      .fetchStationStats(stationId)
      .then((stats) =>
        setStatsById((current) => ({ ...current, [stationId]: { status: "ready", stats } })),
      )
      .catch(() =>
        setStatsById((current) => ({ ...current, [stationId]: { status: "error" } })),
      );
  }, []);

  return (
    <>
      {stations.map((station) => {
        const state = statsById[station.id];
        return (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={STATION_ICON}
            eventHandlers={{ click: () => loadStats(station.id) }}
          >
            <Popup>
              <div className="map-popup">
                <div className="map-popup__header">
                  <strong>{station.name} SAPS</strong>
                </div>
                <p className="map-popup__description">
                  {station.district} · {station.province}
                </p>
                {state?.status === "ready" && state.stats.latestQuarter ? (
                  <StationHeadline
                    latest={state.stats.latestQuarter}
                    onView={() => onOpenStats(state.stats)}
                  />
                ) : state?.status === "ready" ? (
                  <p className="map-popup__description">No official stats for this station yet.</p>
                ) : state?.status === "error" ? (
                  <p className="map-popup__description">Could not load official stats.</p>
                ) : (
                  <p className="map-popup__description">Loading official stats…</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function trendArrow(current: number, previous: number | null): string {
  if (previous === null || current === previous) return "→";
  return current > previous ? "↑" : "↓";
}

function StationHeadline({
  latest,
  onView,
}: {
  latest: StationLatestQuarter;
  onView: () => void;
}) {
  return (
    <>
      <div className="map-popup__meta">
        <span>
          {latest.label}: {latest.totalSerious} serious crimes{" "}
          {trendArrow(latest.totalSerious, latest.totalSeriousPrevYear)}
        </span>
      </div>
      <ul className="station-popup__categories">
        {latest.topCategories.map((entry) => (
          <li key={entry.category}>
            {entry.category}: {entry.count} {trendArrow(entry.count, entry.prevYearCount)}
          </li>
        ))}
      </ul>
      <div className="map-popup__actions">
        <button type="button" className="btn btn--small" onClick={onView}>
          Full stats
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire into `AlertMap.tsx`** — four edits:

1. Add import after the `SeverityBadge` import: `import StationLayer from "./StationLayer";`
2. Extend the type import: `import type { Alert, Hotspot, LatLng, StationStats, ZoneDraft } from "@/lib/types";`
3. Add to `AlertMapProps` (after `showHotspots: boolean;`):

```ts
  showStations: boolean;
  onStationZoomGate: (gated: boolean) => void;
  onStationsError: () => void;
  onOpenStationStats: (stats: StationStats) => void;
```

4. Destructure the new props in the component signature, and render the layer inside `MapContainer` directly after `<FlyTo focus={focus} />`:

```tsx
      {showStations && (
        <StationLayer
          onZoomGateChange={onStationZoomGate}
          onFetchError={onStationsError}
          onOpenStats={onOpenStationStats}
        />
      )}
```

- [ ] **Step 3: Append marker styles to `globals.css`**

```css
/* Police station markers: official reference data in a neutral steel tone —
   deliberately distinct from severity colors and the hotspot violet. */
.station-marker {
  color: #8fa3b8;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}

.station-popup__categories {
  margin: 6px 0;
  padding-left: 16px;
  font-size: 12px;
}
```

- [ ] **Step 4: Typecheck** — this WILL fail in `Dashboard.tsx` (missing new props). That is expected; Task 10 completes the wiring. To keep the commit green, verify only the new/changed files compile by running the full typecheck and confirming the ONLY errors are `Dashboard.tsx` missing props for `AlertMap`.

Run: `cd "C:\Fable makes my app\apps\web" && npm run typecheck`
Expected: errors ONLY in `src/components/Dashboard.tsx` (`Property 'showStations' is missing…`). Any error in `StationLayer.tsx` or `AlertMap.tsx` must be fixed before proceeding.

- [ ] **Step 5: Commit together with Task 10** — do NOT commit yet (the tree must typecheck clean at every commit). Proceed directly to Task 10 and commit both tasks there.

---

### Task 10: Web — StationStatsPanel + Dashboard wiring

**Files:**
- Create: `apps/web/src/components/StationStatsPanel.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/app/globals.css` (append)

**Interfaces:**
- Consumes: `AlertMap` props from Task 9; `StationStats` type from Task 8.
- Produces: `<StationStatsPanel stats={StationStats} onClose={() => void} />`; Dashboard state `showStations` (default **false** — opt-in reference layer), `stationsGated`, `stationStats`.

- [ ] **Step 1: Create `StationStatsPanel.tsx`** (mirrors `AlertDetailPanel`'s structure and Escape handling):

```tsx
"use client";

import { useEffect } from "react";

import type { StationStats } from "@/lib/types";

interface StationStatsPanelProps {
  stats: StationStats;
  onClose: () => void;
}

export default function StationStatsPanel({ stats, onClose }: StationStatsPanelProps) {
  // Escape closes the panel, matching AlertDetailPanel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".panel-overlay, .zone-panel")) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const years = collectYears(stats);

  return (
    <aside className="detail-panel station-stats-panel" aria-label="Official station crime statistics">
      <div className="detail-panel__header">
        <div>
          <strong>{stats.station.name} SAPS</strong>
          <div className="detail-panel__badges">
            <span>
              {stats.station.district} · {stats.station.province}
            </span>
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close station stats">
          ×
        </button>
      </div>

      {stats.latestQuarter && (
        <p className="detail-panel__description">
          {stats.latestQuarter.label}: {stats.latestQuarter.totalSerious} community-reported serious
          crimes
          {stats.latestQuarter.totalSeriousPrevYear !== null &&
            ` (${stats.latestQuarter.totalSeriousPrevYear} same quarter last year)`}
        </p>
      )}

      <div className="station-stats-table-wrap">
        <table className="station-stats-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Months</th>
              {years.map((year) => (
                <th key={year}>{year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.categories.flatMap((category) =>
              category.periods.map((period) => (
                <tr key={`${category.category}-${period.months}`}>
                  <td>{category.category}</td>
                  <td>{period.months}</td>
                  {years.map((year) => (
                    <td key={year}>{period.totals[year] ?? "–"}</td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <p className="station-stats-source">
        Source: SAPS quarterly crime statistics — official counts, independent of alerts reported
        here.
      </p>
    </aside>
  );
}

function collectYears(stats: StationStats): string[] {
  const years = new Set<string>();
  for (const category of stats.categories) {
    for (const period of category.periods) {
      for (const year of Object.keys(period.totals)) years.add(year);
    }
  }
  return [...years].sort();
}
```

- [ ] **Step 2: Wire `Dashboard.tsx`** — six edits:

1. Import: `import StationStatsPanel from "./StationStatsPanel";` (after the `StatsPanel` import) and add `StationStats` to the types import.
2. State (after the `showHotspots` line):

```ts
  const [showStations, setShowStations] = useState(false);
  const [stationsGated, setStationsGated] = useState(false);
  const [stationStats, setStationStats] = useState<StationStats | null>(null);
```

3. Handlers (after `openDetail`) — the two side panels are mutually exclusive, and the error toast reuses the existing toast machinery:

```ts
  const handleStationsError = useCallback(
    () => showToast("error", "Could not load police stations"),
    [showToast],
  );

  const openStationStats = useCallback((stats: StationStats) => {
    setDetailAlertId(null);
    setStationStats(stats);
  }, []);
```

4. In `openDetail`, close the station panel: add `setStationStats(null);` as the first line of the callback body.
5. Toggle in `topbar__controls`, directly after the Hotspots `<label>` (same classes):

```tsx
          <label className="hotspot-toggle">
            <input
              type="checkbox"
              className="switch__input"
              checked={showStations}
              onChange={(event) => setShowStations(event.target.checked)}
            />
            <span className="switch" aria-hidden />
            Stations
          </label>
```

6. Map props + overlays inside `map-wrap`: pass to `<AlertMap …>`:

```tsx
            showStations={showStations}
            onStationZoomGate={setStationsGated}
            onStationsError={handleStationsError}
            onOpenStationStats={openStationStats}
```

and after the `showHint` block add:

```tsx
          {showStations && stationsGated && (
            <div className="map-hint" role="note">
              Zoom in to see police stations.
            </div>
          )}
          {stationStats && (
            <StationStatsPanel stats={stationStats} onClose={() => setStationStats(null)} />
          )}
```

- [ ] **Step 3: Append panel styles to `globals.css`**

```css
.station-stats-panel {
  overflow-y: auto;
}

.station-stats-table-wrap {
  overflow-x: auto;
}

.station-stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.station-stats-table th,
.station-stats-table td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.station-stats-table th:nth-child(n + 3),
.station-stats-table td:nth-child(n + 3) {
  text-align: right;
}

.station-stats-source {
  font-size: 11px;
  opacity: 0.7;
}
```

- [ ] **Step 4: Typecheck and build**

Run: `cd "C:\Fable makes my app\apps\web" && npm run typecheck && npm run build`
Expected: both exit 0.

- [ ] **Step 5: Commit (Tasks 9 + 10 together — the tree is now consistent)**

```bash
git add apps/web/src/components/StationLayer.tsx apps/web/src/components/StationStatsPanel.tsx apps/web/src/components/AlertMap.tsx apps/web/src/components/Dashboard.tsx apps/web/src/app/globals.css
git commit -m "feat(web): police station layer with stats popup and detail panel"
```

---

### Task 11: CI + docs

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the importer job to `ci.yml`** (after the `ml-service` job, same indentation):

```yaml
  saps-import:
    name: SAPS importer (Python)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: tools/saps-import
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt pytest
      - run: pytest -q
```

and extend the image-build gate: `needs: [web, alerts-api, alert-processor, ml-service, saps-import]`.

- [ ] **Step 2: Update `README.md`**

1. Add to the **Features beyond the core map** list:

```markdown
- **Police stations layer** — official SAPS stations (toggleable, zoom-gated)
  with each station's quarterly crime statistics in a popup and full 5-year
  breakdown panel; refreshed per quarter via `tools/saps-import`.
```

2. Add a row to the **Testing** table:

```markdown
| SAPS importer (pytest) | `cd tools/saps-import && pip install -r requirements.txt pytest && pytest` |
```

3. Add a short section after **Testing**:

```markdown
## Refreshing SAPS station stats

Each quarter SAPS publishes a new `*_WEB.xlsx`. To refresh:

    cd tools/saps-import
    DATABASE_URL=<neon-url> python import_saps.py --xlsx <path-to-xlsx>

The import is idempotent. Stations without coordinates are listed in the
summary; add them to `data/overrides.csv` (workbook_name,lat,lng) and rerun.
```

- [ ] **Step 3: Update `CLAUDE.md`** — add to the repository-layout table:

```markdown
| `tools/saps-import` | Python CLI | Quarterly SAPS crime-stats import (stations + stats into Postgres) |
```

and to the Commands block:

```bash
# SAPS importer (writes to the LIVE Neon DB — confirm with the user first)
cd tools/saps-import && .venv/Scripts/python -m pytest tests -q     # tests
DATABASE_URL=... .venv/Scripts/python import_saps.py --xlsx <file>  # import
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md CLAUDE.md
git commit -m "chore(ci): SAPS importer test job; document the stations layer"
```

---

### Task 12: Live import + end-to-end verification

**⚠️ Every step in this task touches the live Neon database or live services. Get explicit user confirmation before Step 1 and again before Step 2.**

- [ ] **Step 1 (CONFIRM WITH USER): Apply the V3 migration** — start the API so Flyway migrates:

Run: `cd "C:\Fable makes my app" && docker compose up -d --build alerts-api`
Verify: `docker compose logs alerts-api` shows `Migrating schema "public" to version "3 - police stations"` and the app starts.

- [ ] **Step 2 (CONFIRM WITH USER): Run the import** with the real workbook:

Run (Git Bash, sourcing DATABASE_URL from the root `.env`):
```bash
cd "C:\Fable makes my app\tools\saps-import"
export $(grep -E '^DATABASE_URL=' ../../.env) && .venv/Scripts/python import_saps.py --xlsx "C:\Users\zakhi\Downloads\2025-2026_-_4th_Quarter_WEB.xlsx"
```
Expected: `stations imported: 1102`, ~700k stat rows upserted, 72 skipped stations listed. (Numbers verified against this exact file on 2026-07-10.)

- [ ] **Step 3: Probe the API**

Run: `curl -s "http://localhost:8080/api/v1/stations?minLat=-27&maxLat=-25&minLng=30&maxLng=32" | head -c 400`
Expected: JSON array of station objects.
Run: `curl -s "http://localhost:8080/api/v1/stations/1/stats" | head -c 400`
Expected: JSON with `station`, `latestQuarter.label` = `"Jan–Mar 2026"`, `categories`.

- [ ] **Step 4: Verify in the preview browser** (preview_start `web`, then):
  1. Toggle **Stations** on at country zoom → "Zoom in to see police stations." hint.
  2. Zoom into a city (≥ zoom 10) → shield markers appear.
  3. Click a marker → popup shows headline + top 5 categories with arrows.
  4. Click **Full stats** → panel opens with the category × year table; Escape closes it.
  5. preview_console_logs → no new errors (the known react-leaflet double-mount noise is expected).
  6. Screenshot as proof.

- [ ] **Step 5: Record any post-import follow-ups** — if the unmatched-station list matters to the user, note that `overrides.csv` entries + rerun will backfill them.

---

## Plan Self-Review (completed)

- **Spec coverage:** monthly-grain schema (T4), repeatable idempotent import + overrides + fail-fast (T1–T3), bbox + stats endpoints with 1 h Redis fail-open cache and 400/404 (T5–T7), toggle/zoom-gate/divIcon/popup/panel with mutual exclusion and quiet degradation (T8–T10), pytest CI job + runbook docs (T11), live verification (T12). No gaps found.
- **Placeholder scan:** none; every code step contains full code.
- **Type consistency:** `QuarterTotalRow` getters (T4) match test fakes (T6); `StationStatsResponse` JSON shape (T6) matches `StationStats` TS types (T8); `StationLayer` props (T9) match `Dashboard` wiring (T10); importer column names (T3) match `V3__police_stations.sql` (T4).
