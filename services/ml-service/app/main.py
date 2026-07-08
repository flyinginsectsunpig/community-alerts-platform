"""Community Alerts ML service.

HTTP surface (consumed only by the Java API, never directly by browsers):
    GET  /health            liveness + consumer status
    GET  /hotspots          DBSCAN crime hotspots over recent alerts (Redis-cached)
    POST /severity/preview  synchronous severity prediction for as-you-type UX

Async surface: consumes alert.created from LavinMQ, publishes alert.scored.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import psycopg
from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .cache import Cache
from .config import load_settings
from .db import fetch_recent_alerts
from .messaging.consumer import AlertScoringConsumer
from .models.hotspots import compute_hotspots
from .models.severity import SeverityModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    app.state.settings = settings
    app.state.model = SeverityModel(settings.model_version)
    app.state.cache = Cache(settings)
    app.state.consumer = AlertScoringConsumer(settings, app.state.model)
    app.state.consumer.start()
    log.info("ML service ready (model %s)", settings.model_version)
    yield
    app.state.consumer.stop()


app = FastAPI(title="Community Alerts ML Service", version="1.0.0", lifespan=lifespan)


class SeverityRequest(BaseModel):
    text: str = Field(min_length=3, max_length=2000)


@app.get("/health")
def health(request: Request) -> dict:
    return {
        "status": "ok",
        "modelVersion": request.app.state.settings.model_version,
        "consumerAlive": request.app.state.consumer.is_alive(),
    }


@app.post("/severity/preview")
def severity_preview(request: Request, body: SeverityRequest) -> dict:
    prediction = request.app.state.model.predict(body.text)
    return {
        "severity": prediction.severity,
        "riskScore": prediction.risk_score,
        "modelVersion": prediction.model_version,
    }


@app.get("/hotspots")
def hotspots(
    request: Request,
    window_hours: int = Query(default=168, ge=1, le=2160, alias="windowHours"),
    eps_m: float = Query(default=250.0, ge=50, le=2000, alias="epsM"),
    min_samples: int = Query(default=3, ge=2, le=50, alias="minSamples"),
) -> dict:
    settings = request.app.state.settings
    cache: Cache = request.app.state.cache

    cache_key = f"hotspots:{window_hours}:{eps_m}:{min_samples}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    try:
        points = fetch_recent_alerts(settings.database_url, window_hours)
    except psycopg.Error as exc:
        log.error("Hotspot query failed: %s", exc)
        raise HTTPException(status_code=503, detail="Alert database unavailable") from exc

    result = {
        "hotspots": [h.to_dict() for h in compute_hotspots(points, eps_m, min_samples)],
        "windowHours": window_hours,
        "sampleSize": len(points),
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    cache.set_json(cache_key, result, settings.hotspot_cache_ttl_seconds)
    return result
