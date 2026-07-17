import pytest

from app.models.hotspots import (
    AlertPoint,
    StationCrime,
    compute_hotspots,
    haversine_m,
    station_hotspots,
)


def cluster_around(lat: float, lng: float, count: int, category: str) -> list[AlertPoint]:
    """Points spread within ~100 m of a center."""
    offsets = [(0.0, 0.0), (0.0005, 0.0), (0.0, 0.0005), (-0.0005, 0.0),
               (0.0, -0.0005), (0.0004, 0.0004), (-0.0004, -0.0004)]
    return [
        AlertPoint(lat + d_lat, lng + d_lng, category)
        for d_lat, d_lng in offsets[:count]
    ]


def test_haversine_known_distance() -> None:
    # One degree of latitude is ~111.2 km.
    assert haversine_m(51.0, 0.0, 52.0, 0.0) == pytest.approx(111_195, rel=0.01)


def test_two_dense_clusters_are_found_and_noise_is_discarded() -> None:
    points = (
        cluster_around(51.5074, -0.1278, 5, "THEFT")        # central London
        + cluster_around(51.5205, -0.0999, 4, "VANDALISM")  # ~1.6 km away
        + [
            AlertPoint(51.60, -0.20, "OTHER"),  # isolated noise
            AlertPoint(51.40, -0.05, "OTHER"),
            AlertPoint(51.55, 0.10, "OTHER"),
        ]
    )

    hotspots = compute_hotspots(points, eps_m=250.0, min_samples=3)

    assert len(hotspots) == 2
    assert [h.count for h in hotspots] == [5, 4]  # sorted by size, noise excluded

    biggest = hotspots[0]
    assert biggest.dominant_category == "THEFT"
    assert biggest.intensity == 1.0
    assert haversine_m(biggest.center_lat, biggest.center_lng, 51.5074, -0.1278) < 150

    assert hotspots[1].dominant_category == "VANDALISM"
    assert 0.0 < hotspots[1].intensity < 1.0


def test_radius_has_a_sensible_floor() -> None:
    # Same coordinates for every alert: radius must not collapse to zero.
    points = [AlertPoint(51.5, -0.12, "THEFT") for _ in range(4)]

    hotspots = compute_hotspots(points, eps_m=250.0, min_samples=3)

    assert len(hotspots) == 1
    assert hotspots[0].radius_m >= 75.0


def test_too_few_points_returns_empty() -> None:
    assert compute_hotspots(cluster_around(51.5, -0.12, 2, "THEFT"), min_samples=3) == []


def test_scattered_points_produce_no_hotspots() -> None:
    points = [
        AlertPoint(51.50, -0.12, "THEFT"),
        AlertPoint(51.55, -0.20, "THEFT"),
        AlertPoint(51.45, -0.02, "THEFT"),
        AlertPoint(51.60, -0.30, "THEFT"),
    ]
    assert compute_hotspots(points, eps_m=250.0, min_samples=3) == []


def test_invalid_parameters_are_rejected() -> None:
    points = cluster_around(51.5, -0.12, 5, "THEFT")
    with pytest.raises(ValueError):
        compute_hotspots(points, eps_m=0)
    with pytest.raises(ValueError):
        compute_hotspots(points, min_samples=1)


def test_station_hotspots_normalize_against_the_busiest_station() -> None:
    stations = [
        StationCrime(lat=-33.92, lng=18.42, total=400, top_category="Common assault"),
        StationCrime(lat=-33.93, lng=18.47, total=200, top_category="Burglary at residential premises"),
        StationCrime(lat=-33.95, lng=18.50, total=10, top_category="Shoplifting"),
    ]

    spots = station_hotspots(stations)

    # The quiet station falls under the intensity floor and is dropped.
    assert [s.count for s in spots] == [400, 200]
    assert spots[0].intensity == 0.6  # busiest station carries the cap
    assert spots[1].intensity == 0.3
    assert spots[0].source == "STATIONS"
    assert spots[0].dominant_category == "Common assault"


def test_station_hotspots_with_no_data() -> None:
    assert station_hotspots([]) == []


def test_report_hotspots_are_tagged_with_their_source() -> None:
    points = cluster_around(51.5074, -0.1278, 5, "THEFT")

    hotspots = compute_hotspots(points, eps_m=250.0, min_samples=3)

    assert hotspots[0].source == "REPORTS"
    assert hotspots[0].to_dict()["source"] == "REPORTS"
