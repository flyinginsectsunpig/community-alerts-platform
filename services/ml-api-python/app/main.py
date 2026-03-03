"""
main.py — FastAPI application for the Community Alerts ML service.

Endpoints:
  POST /api/v1/ml/extract-entities   — NLP entity extraction from description text
  POST /api/v1/ml/classify-urgency   — Incident urgency classification (LOW→CRITICAL)
  POST /api/v1/ml/predict-heat       — Suburb heat score prediction (24hr ahead)
  POST /api/v1/ml/detect-patterns    — K-Means serial crime pattern detection
  POST /api/v1/ml/forecast-risk      — Time-of-day risk profiling
  GET  /api/v1/ml/health             — Service health + model status
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models.bundle import ModelBundle, train_all_models
from app.models.entity_extractor import extract_entities, build_auto_tags
from app.models.urgency_classifier import predict_urgency
from app.models.heat_predictor import predict_heat
from app.models.pattern_detector import detect_patterns
from app.models.risk_forecaster import forecast_risk
from app.schemas import (
    EntityExtractionRequest, EntityExtractionResponse, ExtractedEntities,
    UrgencyRequest,          UrgencyResponse,
    HeatPredictionRequest,   HeatPredictionResponse,
    PatternDetectionRequest, PatternDetectionResponse, DetectedCluster,
    RiskForecastRequest,     RiskForecastResponse,    HourRisk,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Model lifecycle ───────────────────────────────────────────────────────────

_models: ModelBundle | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _models
    _models = train_all_models()
    yield
    logger.info("ML service shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Community Alerts ML Service",
    description=(
        "Machine learning microservice for the Community Alerts platform. "
        "Provides NLP entity extraction, urgency classification, "
        "heat score prediction, serial pattern detection, and risk forecasting."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_models() -> ModelBundle:
    if _models is None:
        raise HTTPException(status_code=503, detail="Models not yet initialised. Retry shortly.")
    return _models


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/v1/ml/health", tags=["Health"])
def health():
    return {
        "status":  "ok" if _models is not None else "initialising",
        "models": {
            "urgency_classifier": _models is not None,
            "heat_predictor":     _models is not None,
            "entity_extractor":   True,   # rule-based, no training required
            "pattern_detector":   True,   # fits on demand per request
            "risk_forecaster":    True,   # fits on demand per request
        },
    }


# ── 1. NLP Entity Extraction ──────────────────────────────────────────────────

@app.post(
    "/api/v1/ml/extract-entities",
    response_model=EntityExtractionResponse,
    tags=["NLP"],
    summary="Extract suspect / vehicle / weapon features from incident description",
    description=(
        "Parses freetext incident descriptions and returns structured entities: "
        "clothing items, weapons, vehicles, number plates, directions, and suspect count. "
        "Auto-generates a tag list suitable for storing on the Incident entity."
    ),
)
def extract_entities_endpoint(payload: EntityExtractionRequest) -> EntityExtractionResponse:
    result    = extract_entities(payload.text)
    auto_tags = build_auto_tags(result)

    return EntityExtractionResponse(
        entities=ExtractedEntities(
            clothing=result.clothing,
            weapons=result.weapons,
            vehicles=result.vehicles,
            plates=result.plates,
            directions=result.directions,
            count_suspects=result.count_suspects,
            height_descriptors=result.height_descriptors,
        ),
        auto_tags=auto_tags,
        confidence=result.confidence,
    )


# ── 2. Urgency Classification ─────────────────────────────────────────────────

@app.post(
    "/api/v1/ml/classify-urgency",
    response_model=UrgencyResponse,
    tags=["Classification"],
    summary="Classify incident urgency: LOW | MEDIUM | HIGH | CRITICAL",
    description=(
        "Uses a TF-IDF + Logistic Regression model trained on Cape Town incident reports "
        "to assign an urgency level. The incident type acts as a prior: CRIME and FIRE "
        "shift probability mass toward higher urgency classes."
    ),
)
def classify_urgency(payload: UrgencyRequest) -> UrgencyResponse:
    models = _require_models()
    result = predict_urgency(
        models.urgency_classifier,
        payload.title,
        payload.description,
        payload.incident_type.value,
    )
    return UrgencyResponse(**result)


# ── 3. Heat Score Prediction ──────────────────────────────────────────────────

@app.post(
    "/api/v1/ml/predict-heat",
    response_model=HeatPredictionResponse,
    tags=["Prediction"],
    summary="Predict suburb heat score 24 hours ahead",
    description=(
        "Gradient Boosting Regressor trained on synthetic Cape Town time-series data. "
        "Captures non-linear interactions between crime type composition, "
        "time-of-day effects, and momentum. "
        "Extends the deterministic Java scoring algorithm with learned patterns."
    ),
)
def predict_heat_endpoint(payload: HeatPredictionRequest) -> HeatPredictionResponse:
    models = _require_models()
    result = predict_heat(
        models.heat_predictor,
        payload.current_score,
        payload.incidents_last_7_days,
        payload.incidents_last_30_days,
        payload.crime_count,
        payload.fire_count,
        payload.suspicious_count,
        payload.accident_count,
        payload.hour_of_day,
        payload.day_of_week,
    )
    return HeatPredictionResponse(**result)


# ── 4. Pattern Detection ──────────────────────────────────────────────────────

@app.post(
    "/api/v1/ml/detect-patterns",
    response_model=PatternDetectionResponse,
    tags=["Clustering"],
    summary="K-Means clustering to detect potential serial crime patterns",
    description=(
        "Clusters incidents by location, time-of-day, day-of-week, and type. "
        "Optimal k is selected automatically using the silhouette score. "
        "Clusters are assessed for serial risk: HIGH risk clusters may indicate "
        "a single crew operating in a repeated pattern."
    ),
)
def detect_patterns_endpoint(payload: PatternDetectionRequest) -> PatternDetectionResponse:
    incident_dicts = [inc.model_dump() for inc in payload.incidents]
    result = detect_patterns(incident_dicts, payload.n_clusters)

    if "note" in result and not result["clusters"]:
        raise HTTPException(status_code=422, detail=result["note"])

    clusters = [DetectedCluster(**c) for c in result["clusters"]]

    return PatternDetectionResponse(
        clusters=clusters,
        n_clusters=result["n_clusters"],
        silhouette_score=result["silhouette_score"],
        has_serial_pattern=result["has_serial_pattern"],
    )


# ── 5. Risk Forecasting ───────────────────────────────────────────────────────

@app.post(
    "/api/v1/ml/forecast-risk",
    response_model=RiskForecastResponse,
    tags=["Forecasting"],
    summary="Predict peak risk hours and days for a suburb",
    description=(
        "Combines raw historical frequency analysis with Gaussian Naive Bayes smoothing "
        "to produce a continuous hourly risk profile. "
        "Avoids over-fitting to single outlier events by blending raw counts "
        "with learned Gaussian posteriors."
    ),
)
def forecast_risk_endpoint(payload: RiskForecastRequest) -> RiskForecastResponse:
    result = forecast_risk(
        payload.suburb_id,
        payload.incidents_by_hour,
        payload.incidents_by_weekday,
    )

    return RiskForecastResponse(
        suburb_id=result["suburb_id"],
        peak_hours=result["peak_hours"],
        peak_days=result["peak_days"],
        hourly_risk=[HourRisk(**h) for h in result["hourly_risk"]],
        daily_summary=result["daily_summary"],
        recommendation=result["recommendation"],
    )
