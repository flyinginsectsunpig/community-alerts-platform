"""
tests/test_ml_modules.py — Unit tests for all five ML modules.

Run with: pytest app/tests/ -v
"""
import pytest
import numpy as np
from app.models.entity_extractor   import extract_entities, build_auto_tags
from app.models.urgency_classifier import build_urgency_classifier, predict_urgency
from app.models.heat_predictor     import build_heat_predictor, predict_heat, _score_to_level
from app.models.pattern_detector   import detect_patterns
from app.models.risk_forecaster    import forecast_risk


# ── 1. Entity Extractor ───────────────────────────────────────────────────────

class TestEntityExtractor:

    def test_extracts_clothing(self):
        result = extract_entities("Man in blue hoodie and black jeans ran north.")
        assert "blue hoodie" in result.clothing
        assert "black jeans" in result.clothing

    def test_extracts_weapon(self):
        result = extract_entities("Suspect was carrying a knife and threatened cashier.")
        assert "knife" in result.weapons

    def test_extracts_vehicle_with_colour(self):
        result = extract_entities("They fled in a silver polo heading toward the station.")
        assert any("polo" in v.lower() for v in result.vehicles)

    def test_extracts_number_plate(self):
        result = extract_entities("Vehicle plate was CA 443 GP, a silver VW Polo.")
        assert "CA 443 GP" in result.plates

    def test_extracts_suspect_count(self):
        result = extract_entities("Two men jumped out of the car and ran.")
        assert result.count_suspects == 2

    def test_direction_extraction(self):
        result = extract_entities("They ran north toward the taxi rank.")
        assert "north" in result.directions

    def test_confidence_increases_with_more_entities(self):
        sparse = extract_entities("Something happened.")
        rich   = extract_entities(
            "Two tall men in blue hoodies carried knives, fled north in silver Polo CA 443 GP."
        )
        assert rich.confidence >= sparse.confidence

    def test_auto_tags_length_capped(self):
        result = extract_entities(
            "Two tall men in blue hoodies and black jeans carried knives and guns, "
            "fled north in silver Polo CA 443 GP toward the station."
        )
        tags = build_auto_tags(result)
        assert len(tags) <= 10

    def test_empty_text_returns_no_entities(self):
        result = extract_entities("Nothing to see here.")
        assert result.weapons == []
        assert result.plates  == []


# ── 2. Urgency Classifier ─────────────────────────────────────────────────────

class TestUrgencyClassifier:

    @pytest.fixture(scope="class")
    def pipeline(self):
        return build_urgency_classifier()

    def test_armed_robbery_is_critical(self, pipeline):
        result = predict_urgency(
            pipeline,
            "Armed robbery at gunpoint",
            "Two armed men held cashier at gunpoint and fled with cash.",
            "CRIME"
        )
        assert result["urgency"] in ("HIGH", "CRITICAL")

    def test_power_outage_is_low_or_medium(self, pipeline):
        result = predict_urgency(
            pipeline,
            "Power outage Bellville",
            "Eskom transformer fault. Large area without electricity.",
            "POWER_OUTAGE"
        )
        assert result["urgency"] in ("LOW", "MEDIUM")

    def test_probabilities_sum_to_one(self, pipeline):
        result = predict_urgency(pipeline, "Test", "Test description", "INFO")
        total = sum(result["probabilities"].values())
        assert abs(total - 1.0) < 0.01

    def test_confidence_is_between_0_and_1(self, pipeline):
        result = predict_urgency(pipeline, "Break-in", "House broken into", "CRIME")
        assert 0.0 <= result["confidence"] <= 1.0

    def test_reason_is_non_empty(self, pipeline):
        result = predict_urgency(pipeline, "Fire", "Building on fire", "FIRE")
        assert len(result["reason"]) > 10


# ── 3. Heat Score Predictor ───────────────────────────────────────────────────

class TestHeatPredictor:

    @pytest.fixture(scope="class")
    def pipeline(self):
        return build_heat_predictor()

    def test_high_crime_suburb_predicts_high_score(self, pipeline):
        result = predict_heat(
            pipeline,
            current_score=35, incidents_7d=12, incidents_30d=40,
            crime_count=18, fire_count=2, suspicious_count=5,
            accident_count=3, hour_of_day=22, day_of_week=5,
        )
        assert result["predicted_score"] > 20

    def test_quiet_suburb_predicts_low_score(self, pipeline):
        result = predict_heat(
            pipeline,
            current_score=4, incidents_7d=0, incidents_30d=1,
            crime_count=0, fire_count=0, suspicious_count=0,
            accident_count=1, hour_of_day=10, day_of_week=1,
        )
        assert result["predicted_score"] < 25

    def test_trend_is_valid_value(self, pipeline):
        result = predict_heat(
            pipeline, 20, 5, 15, 3, 0, 1, 1, 14, 2
        )
        assert result["trend"] in ("RISING", "STABLE", "FALLING")

    def test_alert_level_matches_predicted_score(self, pipeline):
        result = predict_heat(
            pipeline, 15, 3, 10, 2, 0, 1, 1, 12, 1
        )
        assert result["predicted_alert_level"] == _score_to_level(result["predicted_score"])

    def test_score_to_level_thresholds(self):
        assert _score_to_level(0)  == "GREEN"
        assert _score_to_level(11) == "GREEN"
        assert _score_to_level(12) == "YELLOW"
        assert _score_to_level(19) == "YELLOW"
        assert _score_to_level(20) == "ORANGE"
        assert _score_to_level(29) == "ORANGE"
        assert _score_to_level(30) == "RED"


# ── 4. Pattern Detector ───────────────────────────────────────────────────────

class TestPatternDetector:

    def _make_incidents(self, n: int, lat_base=-34.05, lng_base=18.62):
        """Generate synthetic incidents clustered in two locations."""
        incidents = []
        for i in range(n):
            # Alternate between two location clusters
            offset_lat = 0.005 if i % 2 == 0 else 0.05
            offset_lng = 0.005 if i % 2 == 0 else 0.05
            incidents.append({
                "id":            i + 1,
                "latitude":      lat_base + offset_lat,
                "longitude":     lng_base + offset_lng,
                "incident_type": "CRIME",
                "hour_of_day":   22 if i % 2 == 0 else 14,
                "day_of_week":   5  if i % 2 == 0 else 2,
                "severity":      4,
            })
        return incidents

    def test_returns_clusters(self):
        result = detect_patterns(self._make_incidents(10))
        assert result["n_clusters"] >= 1
        assert len(result["clusters"]) >= 1

    def test_cluster_contains_incident_ids(self):
        incidents = self._make_incidents(6)
        result    = detect_patterns(incidents)
        all_ids   = [i["id"] for i in incidents]
        for cluster in result["clusters"]:
            for iid in cluster["incident_ids"]:
                assert iid in all_ids

    def test_too_few_incidents_returns_note(self):
        result = detect_patterns([
            {"id": 1, "latitude": -34.05, "longitude": 18.62,
             "incident_type": "CRIME", "hour_of_day": 10, "day_of_week": 1, "severity": 3}
        ])
        assert result["n_clusters"] == 0

    def test_silhouette_score_in_range(self):
        result = detect_patterns(self._make_incidents(12))
        assert -1.0 <= result["silhouette_score"] <= 1.0

    def test_forced_n_clusters(self):
        result = detect_patterns(self._make_incidents(12), n_clusters=2)
        assert result["n_clusters"] == 2


# ── 5. Risk Forecaster ────────────────────────────────────────────────────────

class TestRiskForecaster:

    def _cape_flats_profile(self):
        # Typical Cape Flats pattern: quiet mornings, spikes 8pm–midnight
        return [1, 0, 0, 0, 0, 1, 2, 3, 4, 4, 3, 3,
                4, 5, 4, 4, 5, 6, 8, 12, 14, 11, 8, 4]

    def test_returns_24_hourly_risk_entries(self):
        result = forecast_risk("mitch", self._cape_flats_profile(), [8,7,9,10,14,18,12])
        assert len(result["hourly_risk"]) == 24

    def test_peak_hours_in_valid_range(self):
        result = forecast_risk("khaye", self._cape_flats_profile(), [5,5,6,7,9,12,8])
        for h in result["peak_hours"]:
            assert 0 <= h <= 23

    def test_peak_days_are_named(self):
        result = forecast_risk("gugulethu", self._cape_flats_profile(), [4,5,6,7,14,18,10])
        days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
        for d in result["peak_days"]:
            assert d in days

    def test_risk_scores_normalised(self):
        result = forecast_risk("obs", self._cape_flats_profile(), [3,3,4,4,6,8,5])
        for entry in result["hourly_risk"]:
            assert 0.0 <= entry["risk_score"] <= 1.0

    def test_summary_is_non_empty(self):
        result = forecast_risk("clar", self._cape_flats_profile(), [2,2,3,4,5,7,4])
        assert len(result["daily_summary"]) > 10

    def test_all_zeros_does_not_crash(self):
        result = forecast_risk("test", [0]*24, [0]*7)
        assert len(result["hourly_risk"]) == 24
