import pytest
from rest_framework.test import APIClient

from calculator.services import DISCLAIMER

VALID = {"rows": 2, "cols": 5, "roof_tilt": 30, "wind_zone": 2, "snow_zone": 1}


@pytest.fixture
def client():
    return APIClient()


def test_health(client):
    res = client.get("/api/health/")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_calculate_ok(client):
    res = client.post("/api/calculate/", VALID, format="json")
    assert res.status_code == 200
    data = res.json()
    assert set(data) == {
        "total_panels", "total_power_kwp", "rail_length_m",
        "system_weight_kg", "load_check", "bom", "runs",
    }
    assert data["total_panels"] == 10
    assert data["load_check"]["disclaimer"] == DISCLAIMER
    assert data["load_check"]["status"] in {"ok", "warning"}
    for item in data["bom"]:
        assert set(item) == {"item_number", "description", "quantity", "unit"}
        assert item["unit"] in {"Pcs", "Set"}


@pytest.mark.parametrize(
    "field,value",
    [("rows", 0), ("rows", 21), ("cols", 31), ("roof_tilt", 61), ("roof_tilt", -1),
     ("wind_zone", 5), ("snow_zone", 0), ("rows", "abc")],
)
def test_calculate_validation(client, field, value):
    res = client.post("/api/calculate/", {**VALID, field: value}, format="json")
    assert res.status_code == 400
    assert field in res.json()


def test_calculate_missing_fields(client):
    res = client.post("/api/calculate/", {}, format="json")
    assert res.status_code == 400
    assert set(res.json()) == {"roof_tilt", "wind_zone", "snow_zone"}


def test_calculate_get_not_allowed(client):
    assert client.get("/api/calculate/").status_code == 405


BASE = {"roof_tilt": 30, "wind_zone": 2, "snow_zone": 1}


def test_runs_ok_ignores_rows_cols(client):
    body = {**BASE, "rows": 5, "cols": 5, "runs": [{"panels": 3}, {"panels": 1}]}
    data = client.post("/api/calculate/", body, format="json").json()
    assert data["runs"] == 2
    assert data["total_panels"] == 4


def test_v1_reports_runs(client):
    assert client.post("/api/calculate/", VALID, format="json").json()["runs"] == 2


def test_runs_matches_v1(client):
    v1 = client.post("/api/calculate/", VALID, format="json").json()
    v2 = client.post("/api/calculate/", {**BASE, "runs": [{"panels": 5}] * 2}, format="json").json()
    assert v1 == v2


@pytest.mark.parametrize(
    "runs",
    [[], [{"panels": 0}], [{"panels": 61}], [{"panels": 1}] * 101, [{}], "x", [{"panels": "a"}]],
)
def test_runs_validation(client, runs):
    res = client.post("/api/calculate/", {**BASE, "runs": runs}, format="json")
    assert res.status_code == 400
    assert "runs" in res.json()


def test_runs_max_ok(client):
    res = client.post("/api/calculate/", {**BASE, "runs": [{"panels": 60}] * 100}, format="json")
    assert res.status_code == 200
    assert res.json()["total_panels"] == 6000


@pytest.mark.parametrize("extra", [{}, {"rows": 2}, {"cols": 3}])
def test_requires_rows_cols_or_runs(client, extra):
    res = client.post("/api/calculate/", {**BASE, **extra}, format="json")
    assert res.status_code == 400
