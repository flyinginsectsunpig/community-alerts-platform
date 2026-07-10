import csv

from saps import LocatedStation, Station, join_coords, normalize_name, parse_coords, parse_overrides


def test_normalize_name_strips_case_and_punctuation():
    assert normalize_name("KwaBhaca") == "KWABHACA"
    assert normalize_name("  Cape Town Central ") == "CAPETOWNCENTRAL"
    assert normalize_name("Ga-Rankuwa") == "GARANKUWA"


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def test_parse_coords_maps_normalized_name_to_lat_lng(tmp_path):
    path = tmp_path / "coords.csv"
    write_csv(path, ["the_geom", "compnt_nm", "create_dt", "location_x", "location_y", "version"],
              [["x", "KOLOMANE", "20140207", "26.78883", "-32.42247", "1.1.0"]])
    assert parse_coords(path) == {"KOLOMANE": (-32.42247, 26.78883)}  # (lat, lng)


def test_parse_overrides_keyed_by_workbook_name(tmp_path):
    path = tmp_path / "overrides.csv"
    write_csv(path, ["workbook_name", "lat", "lng"], [["Dutywa", "-32.098", "28.311"]])
    assert parse_overrides(path) == {"DUTYWA": (-32.098, 28.311)}


def test_join_coords_prefers_overrides_and_reports_unmatched():
    stations = [Station("Kolomane", "D1", "P1"), Station("Dutywa", "D2", "P2"),
                Station("Ghost Town", "D3", "P3")]
    coords = {"KOLOMANE": (-32.4, 26.7), "DUTYWA": (-99.0, 99.0)}
    overrides = {"DUTYWA": (-32.098, 28.311)}
    located, unmatched = join_coords(stations, coords, overrides)
    assert located == [LocatedStation(stations[0], -32.4, 26.7),
                       LocatedStation(stations[1], -32.098, 28.311)]
    assert unmatched == ["Ghost Town"]
