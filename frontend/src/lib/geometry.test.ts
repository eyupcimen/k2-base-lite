import { describe, expect, it } from 'vitest';
import { arrayWidth, arrayDepth, panelPlacements, railPlacements, railLengthPerRail, totalRailLength, railBarsNeeded, rowCenterZ } from './geometry';

describe('geometry', () => {
  it('computes array size with gaps', () => {
    expect(arrayWidth(1)).toBeCloseTo(1.134);
    expect(arrayWidth(3)).toBeCloseTo(3 * 1.134 + 2 * 0.02);
    expect(arrayDepth(2)).toBeCloseTo(2 * 1.722 + 0.02);
  });
  it('places panels centred and all on one local plane (no staircase)', () => {
    const p = panelPlacements(3, 4, 0.06);
    expect(p).toHaveLength(12);
    expect(new Set(p.map((x) => x.position[1]))).toEqual(new Set([0.06]));
    const xs = p.map((x) => x.position[0]);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0);
    expect(rowCenterZ(1, 3) - rowCenterZ(0, 3)).toBeCloseTo(1.722 + 0.02);
  });
  it('places 2 rails per row at ±0.4 m below panels', () => {
    const r = railPlacements(2, 5, 0.02);
    expect(r).toHaveLength(4);
    expect(r[1].position[2] - r[0].position[2]).toBeCloseTo(0.8);
    expect(r[0].length).toBeCloseTo(arrayWidth(5) + 0.2);
  });
  it('computes rail totals', () => {
    expect(railLengthPerRail(3)).toBeCloseTo(3.642);
    expect(totalRailLength(2, 3)).toBeCloseTo(4 * 3.642);
    expect(railBarsNeeded(1, 4)).toBe(4); // 4.756 m -> 2 bars per rail
  });
});
