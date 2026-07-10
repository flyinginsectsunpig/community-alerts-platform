import csv
import datetime as dt

import openpyxl

from saps import CategoryNormalizer, LocatedStation, Station, StatRow, join_coords, month_columns, normalize_name, parse_coords, parse_overrides, parse_workbook


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


def test_month_columns_picks_only_datetime_headers():
    header = ("x", None, "Comp level", 42, dt.datetime(2026, 1, 15), "Jan 2026 total", dt.datetime(2026, 2, 1))
    assert month_columns(header) == {4: dt.date(2026, 1, 1), 6: dt.date(2026, 2, 1)}


def test_category_normalizer_first_seen_spelling_wins():
    n = CategoryNormalizer()
    assert n.canonical("17 Community reported serious Crime") == "17 Community reported serious Crime"
    assert n.canonical("17 Community reported serious crime") == "17 Community reported serious Crime"
    assert n.canonical("Murder") == "Murder"


def build_fixture(path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "RAW Data"
    ws.append([""] * 12)
    ws.append([""] * 12)
    header = [""] * 12
    header[2], header[4], header[5], header[6], header[7] = (
        "Comp level", "Station", "District", "Province", "Crime_Category")
    header[9], header[10], header[11] = (
        dt.datetime(2026, 1, 1), dt.datetime(2026, 2, 1), dt.datetime(2026, 3, 1))
    ws.append(header)

    def row(level, station, cat, jan, feb, mar):
        r = [""] * 12
        r[2], r[4], r[5], r[6], r[7] = level, station, "Test District", "Test Province", cat
        r[9], r[10], r[11] = jan, feb, mar
        return r

    ws.append(row("Station", "Testville", "Murder", 1, 2, 3))
    ws.append(row("Station", "Testville", "murder", 4, None, 6))     # case variant merges; None skipped
    ws.append(row("Province", "Test Province", "Murder", 9, 9, 9))   # non-station rows filtered
    wb.save(path)


def test_parse_workbook_filters_merges_and_expands_months(tmp_path):
    path = tmp_path / "fixture.xlsx"
    build_fixture(path)
    data = parse_workbook(path)

    assert [s.name for s in data.stations] == ["Testville"]
    assert data.stations[0].district == "Test District"
    assert all(row.category == "Murder" for row in data.stats)  # "murder" merged into first-seen casing
    assert len(data.stats) == 5  # 3 months + 2 non-empty months on the variant row
    assert StatRow("Testville", "Murder", dt.date(2026, 2, 1), 2) in data.stats
