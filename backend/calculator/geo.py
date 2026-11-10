"""Proxies for OpenStreetMap Nominatim (geocode) and Overpass (building footprint).

Stdlib only (urllib). Small in-memory TTL cache and a global throttle of
<= 1 upstream request per second, as required by the Nominatim usage policy.
"""

import json
import math
import threading
import time
import urllib.parse
import urllib.request

USER_AGENT = "k2-base-lite-demo/1.0 (+https://github.com/eyupcimen/k2-base-lite)"
TIMEOUT_S = 5
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",  # fallback mirror when the main one is at capacity
)
CACHE_TTL_S = 24 * 3600
CACHE_MAX = 512
MIN_INTERVAL_S = 1.0

_cache: dict[str, tuple[float, object]] = {}
_lock = threading.Lock()
_last_call = 0.0


class UpstreamError(Exception):
    pass


def clear_cache() -> None:
    global _last_call
    with _lock:
        _cache.clear()
        _last_call = 0.0


def _fetch_json(url: str, data: bytes | None = None):
    global _last_call
    with _lock:
        hit = _cache.get(url + (data.decode() if data else ""))
        if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
            return hit[1]
        wait = MIN_INTERVAL_S - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except (OSError, ValueError) as exc:
        raise UpstreamError(str(exc)) from exc
    with _lock:
        if len(_cache) >= CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[url + (data.decode() if data else "")] = (time.monotonic(), payload)
    return payload


def geocode(q: str) -> list[dict]:
    params = urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 5, "addressdetails": 0})
    rows = _fetch_json(f"{NOMINATIM_URL}?{params}")
    return [
        {"label": r["display_name"], "lat": float(r["lat"]), "lon": float(r["lon"])}
        for r in rows
        if "lat" in r and "lon" in r
    ]


def point_in_polygon(lat: float, lon: float, poly: list[list[float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        yi, xi = poly[i]
        yj, xj = poly[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _dist_m(lat: float, lon: float, poly: list[list[float]]) -> float:
    """Distance (m) from the point to the polygon's nearest vertex/edge, local equirectangular."""
    k = math.cos(math.radians(lat))
    px, py = lon * k, lat
    best = math.inf
    for (a_lat, a_lon), (b_lat, b_lon) in zip(poly, poly[1:] + poly[:1], strict=True):
        ax, ay, bx, by = a_lon * k, a_lat, b_lon * k, b_lat
        dx, dy = bx - ax, by - ay
        den = dx * dx + dy * dy
        t = 0.0 if den == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / den))
        best = min(best, math.hypot(px - ax - t * dx, py - ay - t * dy))
    return best * 111_320


def footprint(lat: float, lon: float) -> list[list[float]] | None:
    query = f'[out:json][timeout:5];way(around:25,{lat},{lon})["building"];out geom;'
    body = urllib.parse.urlencode({"data": query}).encode()
    for i, url in enumerate(OVERPASS_URLS):
        try:
            data = _fetch_json(url, body)
            break
        except UpstreamError:
            if i == len(OVERPASS_URLS) - 1:
                raise
    polys = []
    for el in data.get("elements", []):
        geom = el.get("geometry") or []
        pts = [[g["lat"], g["lon"]] for g in geom]
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts = pts[:-1]
        if len(pts) >= 3:
            polys.append(pts)
    if not polys:
        return None
    for p in polys:
        if point_in_polygon(lat, lon, p):
            return p
    return min(polys, key=lambda p: _dist_m(lat, lon, p))
