"""
bundle.py — Trains all ML models at startup and holds them in memory.

All models train in < 2 seconds on startup.
Inference for any endpoint is < 10ms.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from sklearn.pipeline import Pipeline

from app.models.urgency_classifier import build_urgency_classifier
from app.models.heat_predictor     import build_heat_predictor

logger = logging.getLogger(__name__)


@dataclass
class ModelBundle:
    urgency_classifier: Pipeline
    heat_predictor:     Pipeline


def train_all_models() -> ModelBundle:
    logger.info("Training Community Alerts ML models...")
    t0 = time.perf_counter()

    urgency = build_urgency_classifier()
    logger.info("  ✓ Urgency classifier trained")

    heat = build_heat_predictor()
    logger.info("  ✓ Heat score predictor trained")

    elapsed = time.perf_counter() - t0
    logger.info(f"All models ready in {elapsed:.2f}s")

    return ModelBundle(
        urgency_classifier=urgency,
        heat_predictor=heat,
    )
