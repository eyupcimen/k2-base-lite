"""Pure-Python BOM calculation for a PV roof mounting system (no Django imports).

All values are simplified demo assumptions. Item numbers are placeholders,
not real K2 catalog numbers. This is NOT a certified structural calculation.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field

# Geometry constants (must match frontend, see CONTRACT.md)
PANEL_WIDTH_M = 1.134
PANEL_HEIGHT_M = 1.722
PANEL_GAP_M = 0.02
RAIL_OVERHANG_M = 0.1
RAIL_BAR_M = 4.40
RAILS_PER_ROW = 2
RAIL_OFFSET_M = 0.4  # +/- from row center (used by the frontend drawing)
PANEL_POWER_W = 430
PANEL_WEIGHT_KG = 21.5
RAIL_WEIGHT_KG_PER_M = 0.85
HOOK_WEIGHT_KG = 0.7

# Simplified roof hook spacing assumptions (m). The effective spacing is the
# stricter (smaller) of the wind and snow values. Not derived from EN 1991.
#   wind zone: 1 -> 1.20, 2 -> 1.10, 3 -> 1.00, 4 -> 0.80
#   snow zone: 1 -> 1.20, 2 -> 1.00, 3 -> 0.80
WIND_SPACING_M = {1: 1.20, 2: 1.10, 3: 1.00, 4: 0.80}
SNOW_SPACING_M = {1: 1.20, 2: 1.00, 3: 0.80}

DISCLAIMER = "Simplified estimate, not a certified structural calculation (EN 1991)."


@dataclass(frozen=True)
class CalculationInput:
    roof_tilt: float
    wind_zone: int
    snow_zone: int
    rows: int | None = None
    cols: int | None = None
    runs: tuple[int, ...] | None = None  # panels per run (v2); overrides rows/cols

    def panel_runs(self) -> tuple[int, ...]:
        if self.runs:
            return tuple(self.runs)
        return (self.cols,) * self.rows


@dataclass(frozen=True)
class BomItem:
    item_number: str
    description: str
    quantity: int
    unit: str


@dataclass(frozen=True)
class LoadCheck:
    status: str
    message: str
    disclaimer: str = DISCLAIMER


@dataclass(frozen=True)
class CalculationResult:
    total_panels: int
    runs: int
    total_power_kwp: float
    rail_length_m: float
    system_weight_kg: float
    load_check: LoadCheck
    bom: list[BomItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def rail_length_per_rail(cols: int) -> float:
    return cols * PANEL_WIDTH_M + (cols - 1) * PANEL_GAP_M + 2 * RAIL_OVERHANG_M


def hook_spacing(wind_zone: int, snow_zone: int) -> float:
    return min(WIND_SPACING_M[wind_zone], SNOW_SPACING_M[snow_zone])


def hooks_per_rail(length_m: float, spacing_m: float) -> int:
    # round() guards against float noise such as 2.0000000000000004
    return math.ceil(round(length_m / spacing_m, 9)) + 1


def load_check(roof_tilt: float, wind_zone: int, snow_zone: int) -> LoadCheck:
    """Heuristic only: flags combinations that typically need a closer look."""
    reasons = []
    if wind_zone >= 4:
        reasons.append("high wind zone")
    if snow_zone >= 3:
        reasons.append("high snow zone")
    if roof_tilt > 45:
        reasons.append("steep roof (higher wind suction)")
    if roof_tilt < 10 and snow_zone >= 2:
        reasons.append("low tilt with snow load (snow accumulation)")
    if wind_zone + snow_zone >= 5 and not reasons:
        reasons.append("combined wind and snow load")
    if reasons:
        return LoadCheck(
            status="warning",
            message="Review recommended: " + ", ".join(reasons)
            + ". Have a qualified engineer verify the layout.",
        )
    return LoadCheck(status="ok", message="No critical load combination detected by the heuristic.")


def calculate(inp: CalculationInput) -> CalculationResult:
    spacing = hook_spacing(inp.wind_zone, inp.snow_zone)
    runs = inp.panel_runs()
    bars = connectors = hooks = end_clamps = mid_clamps = panels = 0
    total_rail_m = 0.0
    for n in runs:
        length = rail_length_per_rail(n)
        bars_per_rail = math.ceil(round(length / RAIL_BAR_M, 9))
        bars += bars_per_rail * RAILS_PER_ROW
        connectors += (bars_per_rail - 1) * RAILS_PER_ROW
        hooks += hooks_per_rail(length, spacing) * RAILS_PER_ROW
        end_clamps += 4
        mid_clamps += 2 * (n - 1)
        panels += n
        total_rail_m += length * RAILS_PER_ROW

    weight = panels * PANEL_WEIGHT_KG + total_rail_m * RAIL_WEIGHT_KG_PER_M + hooks * HOOK_WEIGHT_KG

    candidates = [
        BomItem("EXAMPLE-001", "Mounting rail 4.40 m", bars, "Pcs"),
        BomItem("EXAMPLE-002", "Roof hook", hooks, "Pcs"),
        BomItem("EXAMPLE-003", "End clamp 30-42 mm", end_clamps, "Pcs"),
        BomItem("EXAMPLE-004", "Mid clamp 30-42 mm", mid_clamps, "Pcs"),
        BomItem("EXAMPLE-005", "Rail connector set", connectors, "Set"),
    ]
    return CalculationResult(
        total_panels=panels,
        runs=len(runs),
        total_power_kwp=round(panels * PANEL_POWER_W / 1000, 2),
        rail_length_m=round(total_rail_m, 3),
        system_weight_kg=round(weight, 1),
        load_check=load_check(inp.roof_tilt, inp.wind_zone, inp.snow_zone),
        bom=[item for item in candidates if item.quantity > 0],
    )
