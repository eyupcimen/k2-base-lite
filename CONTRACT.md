# API Contract (shared by backend + frontend)

POST /api/calculate/   (JSON)
Request:
  rows: int 1..20, cols: int 1..30, roof_tilt: float 0..60 (deg),
  wind_zone: int 1..4, snow_zone: int 1..3
Response 200:
  {
    "total_panels": int, "total_power_kwp": float,
    "rail_length_m": float, "system_weight_kg": float,
    "load_check": { "status": "ok"|"warning", "message": str,
                    "disclaimer": "Simplified estimate, not a certified structural calculation (EN 1991)." },
    "bom": [ { "item_number": "EXAMPLE-xxx", "description": str, "quantity": int, "unit": "Pcs"|"Set" } ]
  }
Response 400: DRF serializer errors {field: [msg]}

GET /api/health/ -> {"status":"ok"}

Geometry constants (both sides MUST match): panel 1.134 x 1.722 m, gap 0.02 m,
rail overhang 0.1 m each end, rail bar 4.40 m, 2 rails per panel row,
rail offsets ±0.4 m from row center, panel 430 W / 21.5 kg.
Item numbers are placeholders prefixed EXAMPLE- (not real K2 catalog numbers).
Layout: backend/ (Django, port 8000), frontend/ (Vite React, port 5173, proxy /api -> 8000),
infra/ (k8s), docs/ (arc42, ADRs), .github/workflows/.

## v2: free panel layout (supersedes rows/cols when present)
Request may include `runs`: list of {"panels": int 1..60}, max 100 runs.
A run = panels side by side in one row with standard gap (contiguous). Each run gets its own 2 rails.
If `runs` is present, rows/cols are optional and ignored; total_panels = sum(panels).
Per run: rail length = n*1.134 + (n-1)*0.02 + 0.2; 2 rails; bars per rail = ceil(len/4.40);
connectors = (bars-1)*2; hooks per rail = ceil(len/spacing)+1; end clamps 4; mid clamps 2*(n-1).
Response unchanged, plus "runs": int (number of runs).
