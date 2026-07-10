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
