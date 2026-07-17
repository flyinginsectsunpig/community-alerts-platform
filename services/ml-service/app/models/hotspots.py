"""Crime hotspot detection.

Two pure sources blended into one heat layer:
- DBSCAN over recent alert coordinates (haversine metric) — live reports.
- A per-station baseline from official SAPS latest-quarter crime stats, so
  statistically dangerous areas glow even without recent user reports.
Pure functions of their inputs — trivially testable and cacheable.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass

import numpy as np
from sklearn.cluster import DBSCAN

EARTH_RADIUS_M = 6_371_000.0
_MIN_RADIUS_M = 75.0

# Station-baseline tuning: official stats should inform, not shout over,
# live reports — so their intensity is capped below a maxed-out report
# cluster, drawn over a fixed precinct-scale radius, and stations too far
# below the busiest one are dropped entirely.
_STATION_RADIUS_M = 1500.0
_STATION_MAX_INTENSITY = 0.6
_STATION_MIN_INTENSITY = 0.15


@dataclass(frozen=True)
class AlertPoint:
    lat: float
    lng: float
    category: str


@dataclass(frozen=True)
class StationCrime:
    """One SAPS station's latest-quarter totals (see db.fetch_station_crime)."""

    lat: float
    lng: float
    total: int
    top_category: str


@dataclass(frozen=True)
class Hotspot:
    center_lat: float
    center_lng: float
    radius_m: float
    count: int
    dominant_category: str
    intensity: float
    # "REPORTS" (live DBSCAN cluster; count = alerts, category = AlertCategory
    # name) or "STATIONS" (SAPS baseline; count = quarterly incidents,
    # category = raw SAPS category text). Mirrored in apps/web types.ts.
    source: str = "REPORTS"

    def to_dict(self) -> dict:
        return {
            "centerLat": self.center_lat,
            "centerLng": self.center_lng,
            "radiusM": self.radius_m,
            "count": self.count,
            "dominantCategory": self.dominant_category,
            "intensity": self.intensity,
            "source": self.source,
        }


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_hotspots(
    points: list[AlertPoint],
    eps_m: float = 250.0,
    min_samples: int = 3,
) -> list[Hotspot]:
    """Cluster alert locations into hotspots.

    eps_m: neighbourhood radius in metres; min_samples: minimum alerts to
    form a hotspot. Points DBSCAN labels as noise are discarded.
    """
    if eps_m <= 0:
        raise ValueError("eps_m must be positive")
    if min_samples < 2:
        raise ValueError("min_samples must be at least 2")
    if len(points) < min_samples:
        return []

    coordinates = np.radians([[p.lat, p.lng] for p in points])
    labels = DBSCAN(
        eps=eps_m / EARTH_RADIUS_M,
        min_samples=min_samples,
        metric="haversine",
    ).fit_predict(coordinates)

    clusters: dict[int, list[AlertPoint]] = {}
    for point, label in zip(points, labels):
        if label != -1:
            clusters.setdefault(int(label), []).append(point)

    if not clusters:
        return []

    max_count = max(len(members) for members in clusters.values())
    hotspots: list[Hotspot] = []
    for members in clusters.values():
        center_lat = sum(p.lat for p in members) / len(members)
        center_lng = sum(p.lng for p in members) / len(members)
        radius = max(
            (haversine_m(center_lat, center_lng, p.lat, p.lng) for p in members),
            default=0.0,
        )
        dominant_category = Counter(p.category for p in members).most_common(1)[0][0]
        hotspots.append(
            Hotspot(
                center_lat=round(center_lat, 6),
                center_lng=round(center_lng, 6),
                radius_m=round(max(radius, _MIN_RADIUS_M), 1),
                count=len(members),
                dominant_category=dominant_category,
                intensity=round(len(members) / max_count, 3),
            )
        )

    hotspots.sort(key=lambda h: h.count, reverse=True)
    return hotspots


def station_hotspots(stations: list[StationCrime]) -> list[Hotspot]:
    """Baseline heat from official SAPS stats, normalized to the busiest station."""
    eligible = [s for s in stations if s.total > 0]
    if not eligible:
        return []

    max_total = max(s.total for s in eligible)
    hotspots: list[Hotspot] = []
    for station in eligible:
        intensity = round(station.total / max_total * _STATION_MAX_INTENSITY, 3)
        if intensity < _STATION_MIN_INTENSITY:
            continue
        hotspots.append(
            Hotspot(
                center_lat=round(station.lat, 6),
                center_lng=round(station.lng, 6),
                radius_m=_STATION_RADIUS_M,
                count=station.total,
                dominant_category=station.top_category,
                intensity=intensity,
                source="STATIONS",
            )
        )

    hotspots.sort(key=lambda h: h.count, reverse=True)
    return hotspots
