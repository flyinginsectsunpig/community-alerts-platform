"""
risk_forecaster.py — Identifies peak risk hours and days for a suburb
using a combination of historical frequency analysis and a trained
GaussianNB model for smooth probability estimation.

Inputs:
  - incidents_by_hour[24]: historical incident count per hour (30-day window)
  - incidents_by_weekday[7]: historical count per weekday

Outputs:
  - Risk score per hour (normalised 0–1)
  - Peak hours (top 3)
  - Peak days (top 2, named)
  - Plain-English summary and recommendation

Why Gaussian Naive Bayes for smoothing?
  Raw hourly counts are noisy — a single violent night in hour 22 shouldn't
  permanently mark that hour as PEAK.  GNB fits a smooth Gaussian distribution
  over the observed counts, giving a more robust risk estimate that degrades
  gracefully for hours with few observations.
"""
from __future__ import annotations

import numpy as np
from sklearn.naive_bayes import GaussianNB

_WEEKDAY_NAMES   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_RISK_LABELS     = {0: "SAFE", 1: "MODERATE", 2: "HIGH", 3: "PEAK"}
_RISK_THRESHOLDS = [0.25, 0.50, 0.75]   # normalised score boundaries


def forecast_risk(
    suburb_id:            str,
    incidents_by_hour:    list[int],
    incidents_by_weekday: list[int],
) -> dict:
    """
    Returns a risk profile for the suburb based on historical incident distribution.
    """
    hour_array = np.array(incidents_by_hour, dtype=float)
    day_array  = np.array(incidents_by_weekday, dtype=float)

    # ── Smooth hourly risk with GNB ───────────────────────────────────────────
    smoothed_hour_risk = _smooth_risk(hour_array)

    # ── Identify peak hours and days ──────────────────────────────────────────
    peak_hours = sorted(
        np.argsort(smoothed_hour_risk)[-3:].tolist(),
        key=lambda h: smoothed_hour_risk[h],
        reverse=True,
    )

    peak_day_idxs = np.argsort(day_array)[-2:][::-1].tolist()
    peak_days     = [_WEEKDAY_NAMES[i] for i in peak_day_idxs]

    # ── Build hourly risk objects ─────────────────────────────────────────────
    hourly_risk: list[dict] = []
    for h in range(24):
        score = float(smoothed_hour_risk[h])
        label = _risk_label(score)
        hourly_risk.append({
            "hour":       h,
            "risk_score": round(score, 4),
            "label":      label,
        })

    # ── Generate human-readable summary ──────────────────────────────────────
    summary      = _build_summary(peak_hours, peak_days, smoothed_hour_risk)
    recommendation = _build_recommendation(peak_hours, peak_days)

    return {
        "suburb_id":     suburb_id,
        "peak_hours":    peak_hours,
        "peak_days":     peak_days,
        "hourly_risk":   hourly_risk,
        "daily_summary": summary,
        "recommendation": recommendation,
    }


# ── Smoothing ─────────────────────────────────────────────────────────────────

def _smooth_risk(counts: np.ndarray) -> np.ndarray:
    """
    Uses Gaussian smoothing to create a continuous risk distribution from
    discrete hourly counts.

    We train a GNB on (hour → count) pairs and use the posterior probability
    of the "high risk" class as our risk score.
    """
    # Avoid division by zero
    if counts.max() == 0:
        return np.zeros(24)

    # Create binary labels: above-median hours are "high risk"
    median   = np.median(counts)
    hours    = np.arange(24).reshape(-1, 1)
    labels   = (counts > median).astype(int)

    gnb = GaussianNB()
    gnb.fit(hours, labels)

    # P(high_risk | hour)
    proba = gnb.predict_proba(hours)[:, 1]

    # Blend raw normalised counts with GNB probabilities for robustness
    raw_norm = counts / counts.max()
    blended  = 0.6 * raw_norm + 0.4 * proba

    # Normalise to 0–1
    if blended.max() > 0:
        blended = blended / blended.max()

    return blended


# ── Helpers ───────────────────────────────────────────────────────────────────

def _risk_label(score: float) -> str:
    if score >= _RISK_THRESHOLDS[2]: return "PEAK"
    if score >= _RISK_THRESHOLDS[1]: return "HIGH"
    if score >= _RISK_THRESHOLDS[0]: return "MODERATE"
    return "SAFE"


def _fmt_hour(h: int) -> str:
    suffix = "AM" if h < 12 else "PM"
    hour   = h if h <= 12 else h - 12
    hour   = 12 if hour == 0 else hour
    return f"{hour}:00 {suffix}"


def _build_summary(peak_hours: list[int], peak_days: list[str], risk: np.ndarray) -> str:
    top_hour = peak_hours[0] if peak_hours else 0
    parts: list[str] = []

    if risk[top_hour] > 0.75:
        parts.append(
            f"Historically highest risk around {_fmt_hour(top_hour)}."
        )
    elif risk[top_hour] > 0.5:
        parts.append(
            f"Moderate elevated risk around {_fmt_hour(top_hour)}."
        )

    if peak_days:
        parts.append(
            f"{peak_days[0]}s and {peak_days[1]}s show the highest incident volumes."
            if len(peak_days) > 1
            else f"{peak_days[0]}s show the highest incident volumes."
        )

    night_risk = float(np.mean(np.concatenate([risk[20:], risk[:5]])))  # 8pm–5am
    day_risk   = float(np.mean(risk[8:18]))                            # 8am–6pm

    if night_risk > day_risk * 1.3:
        parts.append("This suburb's risk profile is predominantly nocturnal.")
    elif day_risk > night_risk * 1.3:
        parts.append("Incidents here tend to occur during daylight hours.")

    return " ".join(parts) if parts else "Insufficient historical data for detailed analysis."


def _build_recommendation(peak_hours: list[int], peak_days: list[str]) -> str:
    if not peak_hours:
        return "Monitor the app for new alerts in your area."

    h = peak_hours[0]
    if 20 <= h <= 23 or 0 <= h <= 4:
        return (
            f"Avoid travelling alone after {_fmt_hour(h - 1)} in this area. "
            f"Ensure home security is active during evening hours, "
            f"particularly on {peak_days[0]}s."
        )
    elif 6 <= h <= 9:
        return (
            f"Stay alert during the morning commute around {_fmt_hour(h)}. "
            f"Travel in groups where possible on {peak_days[0]}s."
        )
    else:
        return (
            f"Peak risk window is around {_fmt_hour(h)}. "
            f"Heightened vigilance recommended, especially on {peak_days[0]}s."
        )
