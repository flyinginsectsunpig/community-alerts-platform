"""
schemas.py — Pydantic request/response models for all ML endpoints.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ── Shared ────────────────────────────────────────────────────────────────────

class IncidentType(str, Enum):
    CRIME       = "CRIME"
    ACCIDENT    = "ACCIDENT"
    POWER_OUTAGE = "POWER_OUTAGE"
    SUSPICIOUS  = "SUSPICIOUS"
    FIRE        = "FIRE"
    INFO        = "INFO"


class AlertLevel(str, Enum):
    GREEN  = "GREEN"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    RED    = "RED"


# ── 1. NLP Entity Extraction ──────────────────────────────────────────────────

class EntityExtractionRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        example="Two men fled on foot. Tall guy in a blue hoodie and black jeans, "
                "carried what looked like a knife. Shorter one had a red cap. "
                "They ran north toward the taxi rank in a silver Polo, CA 443 GP."
    )


class ExtractedEntities(BaseModel):
    clothing:  list[str] = Field(default_factory=list, example=["blue hoodie", "black jeans", "red cap"])
    weapons:   list[str] = Field(default_factory=list, example=["knife"])
    vehicles:  list[str] = Field(default_factory=list, example=["silver Polo"])
    plates:    list[str] = Field(default_factory=list, example=["CA 443 GP"])
    directions: list[str] = Field(default_factory=list, example=["north"])
    count_suspects: Optional[int] = Field(None, example=2)
    height_descriptors: list[str] = Field(default_factory=list, example=["tall", "shorter"])


class EntityExtractionResponse(BaseModel):
    entities: ExtractedEntities
    auto_tags: list[str] = Field(
        description="Ready-to-use tags extracted from text, formatted for the incident pin."
    )
    confidence: float = Field(description="Extraction confidence score 0–1")


# ── 2. Urgency Classification ─────────────────────────────────────────────────

class UrgencyRequest(BaseModel):
    title: str       = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=2000)
    incident_type: IncidentType


class UrgencyLevel(str, Enum):
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


class UrgencyResponse(BaseModel):
    urgency: UrgencyLevel
    confidence: float
    reason: str = Field(description="Human-readable explanation of the urgency rating")
    probabilities: dict[str, float] = Field(
        description="Probability for each urgency class"
    )


# ── 3. Heat Score Prediction ──────────────────────────────────────────────────

class HeatPredictionRequest(BaseModel):
    suburb_id: str = Field(..., example="khaye")
    current_score: int = Field(..., ge=0, example=28)
    incidents_last_7_days:  int = Field(..., ge=0, example=6)
    incidents_last_30_days: int = Field(..., ge=0, example=14)
    crime_count:      int = Field(..., ge=0, example=8)
    fire_count:       int = Field(..., ge=0, example=1)
    suspicious_count: int = Field(..., ge=0, example=3)
    accident_count:   int = Field(..., ge=0, example=2)
    hour_of_day:      int = Field(..., ge=0, le=23, example=22)
    day_of_week:      int = Field(..., ge=0, le=6, example=5)  # 0=Mon, 6=Sun


class HeatPredictionResponse(BaseModel):
    predicted_score:       float
    predicted_alert_level: AlertLevel
    current_alert_level:   AlertLevel
    trend:    str = Field(description="RISING | STABLE | FALLING")
    delta:    float = Field(description="Predicted change from current score")
    confidence: float


# ── 4. Pattern Detection (Serial Incidents) ───────────────────────────────────

class PatternIncident(BaseModel):
    id: int
    latitude:  float
    longitude: float
    incident_type: IncidentType
    hour_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    severity:    int = Field(..., ge=1, le=5)


class PatternDetectionRequest(BaseModel):
    incidents: list[PatternIncident] = Field(..., min_length=3)
    n_clusters: Optional[int] = Field(
        None,
        description="Force a specific number of clusters. "
                    "If omitted, the optimal k is selected automatically."
    )


class DetectedCluster(BaseModel):
    cluster_id:     int
    incident_ids:   list[int]
    centroid_lat:   float
    centroid_lng:   float
    dominant_type:  IncidentType
    avg_hour:       float = Field(description="Average hour-of-day for incidents in this cluster")
    avg_day:        float
    size:           int
    serial_risk:    str = Field(description="LOW | MEDIUM | HIGH — likelihood this is a serial pattern")


class PatternDetectionResponse(BaseModel):
    clusters:      list[DetectedCluster]
    n_clusters:    int
    silhouette_score: float = Field(
        description="Cluster quality score −1 to 1. "
                    "Higher is better. < 0.2 means no clear pattern."
    )
    has_serial_pattern: bool


# ── 5. Risk Forecasting ───────────────────────────────────────────────────────

class RiskForecastRequest(BaseModel):
    suburb_id:            str = Field(..., example="mitch")
    incidents_by_hour:    list[int] = Field(
        ...,
        min_length=24, max_length=24,
        description="Incident count per hour (index 0=midnight, 23=11pm) over the last 30 days",
        example=[2, 1, 0, 0, 0, 1, 3, 5, 4, 3, 4, 5, 6, 7, 6, 5, 7, 9, 12, 14, 11, 8, 5, 3]
    )
    incidents_by_weekday: list[int] = Field(
        ...,
        min_length=7, max_length=7,
        description="Incident count per weekday (0=Mon … 6=Sun)",
        example=[8, 7, 9, 10, 14, 18, 12]
    )


class HourRisk(BaseModel):
    hour:       int
    risk_score: float = Field(description="Normalised risk 0–1")
    label:      str   = Field(description="SAFE | MODERATE | HIGH | PEAK")


class RiskForecastResponse(BaseModel):
    suburb_id:       str
    peak_hours:      list[int] = Field(description="Top 3 highest-risk hours")
    peak_days:       list[str] = Field(description="Top 2 highest-risk weekdays by name")
    hourly_risk:     list[HourRisk]
    daily_summary:   str = Field(description="Plain-English risk summary")
    recommendation:  str = Field(description="Actionable advice for residents")
