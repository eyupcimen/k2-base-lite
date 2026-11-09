import math

import pytest

from calculator.services import (
    DISCLAIMER,
    CalculationInput,
    calculate,
    hook_spacing,
    rail_length_per_rail,
)


def inp(rows=1, cols=1, tilt=30.0, wind=1, snow=1):
    return CalculationInput(rows=rows, cols=cols, roof_tilt=tilt, wind_zone=wind, snow_zone=snow)


def bom(result):
    return {i.description: i.quantity for i in result.bom}


def test_single_panel():
    r = calculate(inp())
    assert r.total_panels == 1
    assert r.total_power_kwp == 0.43
    assert rail_length_per_rail(1) == pytest.approx(1.334)
    assert r.rail_length_m == pytest.approx(2.668)
    b = bom(r)
    assert b["Mounting rail 4.40 m"] == 2
    assert b["End clamp 30-42 mm"] == 4
    assert "Mid clamp 30-42 mm" not in b  # zero quantity omitted
    assert "Rail connector set" not in b
    # ceil(1.334/1.2)+1 = 3 hooks per rail, 2 rails
    assert b["Roof hook"] == 6
    assert r.system_weight_kg == pytest.approx(round(21.5 + 2.668 * 0.85 + 6 * 0.7, 1))


@pytest.mark.parametrize("rows,cols", [(1, 1), (2, 5), (3, 10), (20, 30), (4, 3)])
def test_grid_formulas(rows, cols):
    r = calculate(inp(rows=rows, cols=cols))
    length = cols * 1.134 + (cols - 1) * 0.02 + 0.2
    rails = 2 * rows
    bars = math.ceil(length / 4.40)
    assert r.total_panels == rows * cols
    assert r.rail_length_m == pytest.approx(length * rails, abs=1e-3)
    b = bom(r)
    assert b["Mounting rail 4.40 m"] == bars * rails
    assert b["End clamp 30-42 mm"] == 4 * rows
    assert b.get("Mid clamp 30-42 mm", 0) == 2 * rows * (cols - 1)
    assert b.get("Rail connector set", 0) == (bars - 1) * rails


def test_connectors_long_row():
    # 10 cols: length = 11.34 + 0.18 + 0.2 = 11.72 m -> 3 bars -> 2 connectors per rail
    r = calculate(inp(rows=2, cols=10))
    assert bom(r)["Rail connector set"] == 2 * 4


def test_connector_unit_is_set():
    r = calculate(inp(cols=10))
    units = {i.description: i.unit for i in r.bom}
    assert units["Rail connector set"] == "Set"
    assert units["Roof hook"] == "Pcs"
    assert all(i.item_number.startswith("EXAMPLE-") for i in r.bom)


def test_zone_reduces_hook_spacing():
    assert hook_spacing(1, 1) > hook_spacing(4, 1)
    assert hook_spacing(1, 1) > hook_spacing(1, 3)
    low = bom(calculate(inp(cols=10)))["Roof hook"]
    high = bom(calculate(inp(cols=10, wind=4, snow=3)))["Roof hook"]
    assert high > low


def test_load_check_ok_and_warning():
    ok = calculate(inp(tilt=30, wind=1, snow=1)).load_check
    assert ok.status == "ok"
    assert ok.disclaimer == DISCLAIMER
    for kwargs in ({"wind": 4}, {"snow": 3}, {"tilt": 55}, {"tilt": 5, "snow": 2}):
        lc = calculate(inp(**kwargs)).load_check
        assert lc.status == "warning"
        assert lc.disclaimer == DISCLAIMER


def run_inp(runs, wind=1, snow=1):
    return CalculationInput(roof_tilt=30.0, wind_zone=wind, snow_zone=snow, runs=tuple(runs))


def test_mixed_runs():
    r = calculate(run_inp([1, 4, 10], wind=4, snow=2))  # spacing 0.8
    b = bom(r)
    exp_bars = exp_hooks = exp_conn = 0
    rail_m = 0.0
    for n in (1, 4, 10):
        length = n * 1.134 + (n - 1) * 0.02 + 0.2
        bars = math.ceil(round(length / 4.40, 9))
        exp_bars += 2 * bars
        exp_conn += 2 * (bars - 1)
        exp_hooks += 2 * (math.ceil(round(length / 0.8, 9)) + 1)
        rail_m += 2 * length
    assert r.runs == 3
    assert r.total_panels == 15
    assert b["Mounting rail 4.40 m"] == exp_bars
    assert b["Rail connector set"] == exp_conn
    assert b["Roof hook"] == exp_hooks
    assert b["End clamp 30-42 mm"] == 12
    assert b["Mid clamp 30-42 mm"] == 2 * (0 + 3 + 9)
    assert r.rail_length_m == pytest.approx(round(rail_m, 3))


def test_single_panel_run_equals_single_panel():
    assert calculate(run_inp([1])) == calculate(inp())


@pytest.mark.parametrize("rows,cols", [(1, 1), (2, 5), (20, 30)])
def test_v1_equivalence(rows, cols):
    assert calculate(inp(rows=rows, cols=cols)) == calculate(run_inp([cols] * rows))
    assert calculate(inp(rows=rows, cols=cols)).runs == rows
