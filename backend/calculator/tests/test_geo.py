import io
import json
from unittest import mock

import pytest
from rest_framework.test import APIClient

from calculator import geo


@pytest.fixture(autouse=True)
def _reset():
    geo.clear_cache()
    with mock.patch.object(geo, "MIN_INTERVAL_S", 0):
        yield


def fake_urlopen(payload):
    calls = []

    def _open(req, timeout):
        calls.append((req, timeout))
        return io.BytesIO(json.dumps(payload).encode())

    return _open, calls


@pytest.fixture
def client():
    return APIClient()


def test_geocode_ok_and_cached(client):
    opener, calls = fake_urlopen([{"display_name": "Brandenburger Tor", "lat": "52.5163", "lon": "13.3777"}])
    with mock.patch("urllib.request.urlopen", opener):
        r1 = client.get("/api/geocode/", {"q": "Brandenburger Tor"})
        r2 = client.get("/api/geocode/", {"q": "Brandenburger Tor"})
    assert r1.status_code == 200
    assert r1.json() == [{"label": "Brandenburger Tor", "lat": 52.5163, "lon": 13.3777}]
    assert r2.json() == r1.json()
    assert len(calls) == 1
    req, timeout = calls[0]
    assert timeout == 5
    assert req.get_header("User-agent") == geo.USER_AGENT
    for part in ("format=jsonv2", "limit=5", "addressdetails=0"):
        assert part in req.full_url


@pytest.mark.parametrize("q", ["", "ab", "x" * 201])
def test_geocode_validation(client, q):
    assert client.get("/api/geocode/", {"q": q}).status_code == 400


def test_geocode_upstream_error(client):
    with mock.patch("urllib.request.urlopen", side_effect=OSError("down")):
        assert client.get("/api/geocode/", {"q": "Berlin"}).status_code == 502


def test_throttle_sleeps():
    opener, _ = fake_urlopen([])
    with mock.patch.object(geo, "MIN_INTERVAL_S", 1.0), mock.patch("urllib.request.urlopen", opener), \
            mock.patch.object(geo.time, "sleep") as sleep:
        geo.geocode("aaa")
        geo.geocode("bbb")
    assert sleep.called


SQUARE = [
    {"lat": 0, "lon": 0}, {"lat": 0, "lon": 1e-4}, {"lat": 1e-4, "lon": 1e-4},
    {"lat": 1e-4, "lon": 0}, {"lat": 0, "lon": 0},
]
FAR = [{"lat": 5e-4 + a["lat"], "lon": a["lon"]} for a in SQUARE]


def test_footprint_contains(client):
    opener, calls = fake_urlopen({"elements": [{"geometry": FAR}, {"geometry": SQUARE}]})
    with mock.patch("urllib.request.urlopen", opener):
        res = client.get("/api/footprint/", {"lat": 5e-5, "lon": 5e-5})
    assert res.status_code == 200
    assert res.json()["polygon"] == [[0, 0], [0, 1e-4], [1e-4, 1e-4], [1e-4, 0]]
    assert b"around%3A25" in calls[0][0].data


def test_footprint_nearest(client):
    opener, _ = fake_urlopen({"elements": [{"geometry": FAR}, {"geometry": SQUARE}]})
    with mock.patch("urllib.request.urlopen", opener):
        res = client.get("/api/footprint/", {"lat": -5e-5, "lon": 5e-5})
    assert res.json()["polygon"][0] == [0, 0]


def test_footprint_none(client):
    opener, _ = fake_urlopen({"elements": []})
    with mock.patch("urllib.request.urlopen", opener):
        assert client.get("/api/footprint/", {"lat": 1, "lon": 1}).status_code == 404


@pytest.mark.parametrize("params", [{}, {"lat": "x", "lon": 1}, {"lat": 95, "lon": 1}])
def test_footprint_validation(client, params):
    assert client.get("/api/footprint/", params).status_code == 400
