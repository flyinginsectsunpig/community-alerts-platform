"""
heat_predictor.py — Predicts the NEXT heat score for a suburb using
a Random Forest Regressor trained on synthetic Cape Town time-series data.

This extends the deterministic Java algorithm (Stage 2) with a learned model
that captures non-linear interactions between features:
  - Time-of-day and day-of-week effects
  - Momentum: rapidly-rising incident counts predict higher future scores
  - Type composition: crime-heavy suburbs regress more slowly than power-outage suburbs

Features (9 total):
  current_score, incidents_7d, incidents_30d,
  crime_count, fire_count, suspicious_count, accident_count,
  hour_of_day, day_of_week

Target: heat score 24 hours from now
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

_ALERT_THRESHOLDS = {"GREEN": 12, "YELLOW": 20, "ORANGE": 30}

def _score_to_level(score: float) -> str:
    if score >= 30: return "RED"
    if score >= 20: return "ORANGE"
    if score >= 12: return "YELLOW"
    return "GREEN"


def _generate_training_data(n_samples: int = 2000, seed: int = 42):
    """
    Generates synthetic suburb time-series training data.

    Each row represents a suburb snapshot. The target is the simulated
    heat score 24 hours later, incorporating:
      - Random crime spikes on weekends (Friday–Saturday nights)
      - Score decay when no new incidents arrive
      - Non-linear interaction between crime count and time-of-day
    """
    rng = np.random.default_rng(seed)

    current_scores   = rng.integers(0, 60, n_samples).astype(float)
    incidents_7d     = rng.integers(0, 30, n_samples).astype(float)
    incidents_30d    = incidents_7d + rng.integers(0, 50, n_samples)
    crime_count      = rng.integers(0, 20, n_samples).astype(float)
    fire_count       = rng.integers(0,  5, n_samples).astype(float)
    suspicious_count = rng.integers(0, 10, n_samples).astype(float)
    accident_count   = rng.integers(0,  8, n_samples).astype(float)
    hour_of_day      = rng.integers(0, 24, n_samples).astype(float)
    day_of_week      = rng.integers(0,  7, n_samples).astype(float)

    # Decay current score, then add incident-type contributions
    future_score = current_scores * 0.85

    night_mask = (hour_of_day >= 20) | (hour_of_day <= 4)
    future_score += crime_count * 2.5
    future_score += crime_count * night_mask * 1.8      # night amplifier

    weekend_mask = (day_of_week >= 4) & (day_of_week <= 5)
    future_score += weekend_mask * rng.uniform(2, 8, n_samples)

    future_score += fire_count       * 3.0
    future_score += suspicious_count * 1.5
    future_score += accident_count   * 1.0

    momentum = (incidents_7d / (incidents_30d + 1)) * 10
    future_score += momentum

    future_score += rng.normal(0, 2, n_samples)
    future_score  = np.clip(future_score, 0, 80)

    X = np.column_stack([
        current_scores, incidents_7d, incidents_30d,
        crime_count, fire_count, suspicious_count, accident_count,
        hour_of_day, day_of_week,
    ])

    return X, future_score


def build_heat_predictor() -> Pipeline:
    """Train and return the heat score prediction pipeline."""
    X, y = _generate_training_data()

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model",  GradientBoostingRegressor(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42,
        )),
    ])
    pipeline.fit(X, y)
    return pipeline


def predict_heat(
    pipeline: Pipeline,
    current_score:       int,
    incidents_7d:        int,
    incidents_30d:       int,
    crime_count:         int,
    fire_count:          int,
    suspicious_count:    int,
    accident_count:      int,
    hour_of_day:         int,
    day_of_week:         int,
) -> dict:
    features = np.array([[
        current_score, incidents_7d, incidents_30d,
        crime_count, fire_count, suspicious_count, accident_count,
        hour_of_day, day_of_week,
    ]], dtype=float)

    predicted = float(pipeline.predict(features)[0])
    predicted = max(0.0, round(predicted, 1))
    delta     = predicted - current_score

    current_level   = _score_to_level(current_score)
    predicted_level = _score_to_level(predicted)

    if delta > 3:
        trend = "RISING"
    elif delta < -3:
        trend = "FALLING"
    else:
        trend = "STABLE"

    # Confidence proxy: based on how far prediction is from decision boundaries
    # (lower confidence near thresholds)
    nearest_threshold = min(
        abs(predicted - 12),
        abs(predicted - 20),
        abs(predicted - 30),
    )
    confidence = round(min(nearest_threshold / 8.0, 1.0), 3)

    return {
        "predicted_score":       predicted,
        "predicted_alert_level": predicted_level,
        "current_alert_level":   current_level,
        "trend":                 trend,
        "delta":                 round(delta, 1),
        "confidence":            confidence,
    }
