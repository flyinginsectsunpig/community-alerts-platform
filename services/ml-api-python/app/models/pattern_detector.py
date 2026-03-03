"""
pattern_detector.py — K-Means clustering to identify potential serial crime patterns.

Problem this solves:
  When 6 robberies happen in Mitchells Plain over 2 weeks, are they random
  or is one crew operating in a pattern?  Clustering by location + time-of-day
  + day-of-week can surface non-obvious groupings that a resident scrolling
  the map would never notice.

Feature vector per incident (normalised):
  [latitude, longitude, incident_type_encoded, hour_of_day, day_of_week, severity]

Normalisation is critical — lat/lng differences (fractions of a degree) would
otherwise dominate hour differences (0–23) without it.

Optimal k selection:
  We use the silhouette score to auto-select k between 2 and min(n/2, 6).
  The silhouette score measures how similar each point is to its own cluster
  vs other clusters.  Score > 0.5 → clear structure; < 0.2 → no real pattern.
"""
from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

_TYPE_ENCODING = {
    "CRIME":        5,
    "FIRE":         4,
    "SUSPICIOUS":   3,
    "ACCIDENT":     2,
    "POWER_OUTAGE": 1,
    "INFO":         0,
}

_SERIAL_RISK_THRESHOLDS = {
    "HIGH":   (4, 0.45),   # cluster size >= 4 AND silhouette >= 0.45
    "MEDIUM": (2, 0.25),   # cluster size >= 2 AND silhouette >= 0.25
}

_WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def detect_patterns(
    incidents: list[dict],
    n_clusters: int | None = None,
) -> dict:
    """
    Main entry point.

    incidents: list of dicts with keys:
        id, latitude, longitude, incident_type, hour_of_day, day_of_week, severity

    Returns cluster assignments and a serial risk assessment.
    """
    if len(incidents) < 3:
        return _empty_result("Not enough incidents to detect patterns (minimum 3)")

    # ── Build feature matrix ──────────────────────────────────────────────────
    X_raw = np.array([
        [
            inc["latitude"],
            inc["longitude"],
            _TYPE_ENCODING.get(inc["incident_type"], 0),
            inc["hour_of_day"],
            inc["day_of_week"],
            inc["severity"],
        ]
        for inc in incidents
    ], dtype=float)

    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)

    # ── Select optimal k ──────────────────────────────────────────────────────
    n = len(incidents)
    max_k = min(n // 2, 6)

    if n_clusters is not None:
        k = max(2, min(n_clusters, max_k))
        labels, score = _cluster(X, k)
    else:
        k, labels, score = _auto_select_k(X, max_k)

    # ── Build cluster summaries ───────────────────────────────────────────────
    clusters: list[dict] = []
    for cluster_id in range(k):
        mask  = labels == cluster_id
        idxs  = [i for i, m in enumerate(mask) if m]
        if not idxs:
            continue

        members      = [incidents[i] for i in idxs]
        member_ids   = [inc["id"] for inc in members]
        centroid_lat = float(np.mean([inc["latitude"]  for inc in members]))
        centroid_lng = float(np.mean([inc["longitude"] for inc in members]))
        avg_hour     = float(np.mean([inc["hour_of_day"] for inc in members]))
        avg_day      = float(np.mean([inc["day_of_week"] for inc in members]))

        # Dominant incident type (mode)
        type_counts: dict[str, int] = {}
        for inc in members:
            t = inc["incident_type"]
            type_counts[t] = type_counts.get(t, 0) + 1
        dominant_type = max(type_counts, key=lambda k: type_counts[k])

        serial_risk = _assess_serial_risk(len(members), score)

        clusters.append({
            "cluster_id":    cluster_id,
            "incident_ids":  member_ids,
            "centroid_lat":  round(centroid_lat, 6),
            "centroid_lng":  round(centroid_lng, 6),
            "dominant_type": dominant_type,
            "avg_hour":      round(avg_hour, 1),
            "avg_day":       round(avg_day, 1),
            "size":          len(members),
            "serial_risk":   serial_risk,
        })

    # Sort clusters by size descending
    clusters.sort(key=lambda c: c["size"], reverse=True)

    has_serial = any(c["serial_risk"] in ("MEDIUM", "HIGH") for c in clusters)

    return {
        "clusters":          clusters,
        "n_clusters":        k,
        "silhouette_score":  round(float(score), 4),
        "has_serial_pattern": has_serial,
    }


# ── Private helpers ───────────────────────────────────────────────────────────

def _cluster(X: np.ndarray, k: int) -> tuple[np.ndarray, float]:
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(X)
    score  = silhouette_score(X, labels) if len(set(labels)) > 1 else 0.0
    return labels, score


def _auto_select_k(X: np.ndarray, max_k: int) -> tuple[int, np.ndarray, float]:
    if max_k < 2:
        km = KMeans(n_clusters=2, n_init=10, random_state=42)
        labels = km.fit_predict(X)
        return 2, labels, 0.0

    best_k, best_labels, best_score = 2, None, -1.0
    for k in range(2, max_k + 1):
        labels, score = _cluster(X, k)
        if score > best_score:
            best_k, best_labels, best_score = k, labels, score

    return best_k, best_labels, best_score


def _assess_serial_risk(cluster_size: int, silhouette: float) -> str:
    if cluster_size >= _SERIAL_RISK_THRESHOLDS["HIGH"][0] and \
       silhouette   >= _SERIAL_RISK_THRESHOLDS["HIGH"][1]:
        return "HIGH"
    if cluster_size >= _SERIAL_RISK_THRESHOLDS["MEDIUM"][0] and \
       silhouette   >= _SERIAL_RISK_THRESHOLDS["MEDIUM"][1]:
        return "MEDIUM"
    return "LOW"


def _empty_result(reason: str) -> dict:
    return {
        "clusters":          [],
        "n_clusters":        0,
        "silhouette_score":  0.0,
        "has_serial_pattern": False,
        "note":              reason,
    }
