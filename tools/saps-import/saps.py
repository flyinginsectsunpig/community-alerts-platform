"""Parsing and joining logic for the SAPS quarterly crime stats import.

Pure functions only — no database access — so everything is unit-testable.
"""
from __future__ import annotations

import csv
import datetime as dt
import re
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl


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
