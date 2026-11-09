import { describe, expect, it } from 'vitest';
import { buildHouse, footprintUV, gableDims, houseToWorld } from './gable';
import { fromRotated, rotatedSize, splitRotation, straightenRotation, toRotated } from './rotate';

describe('gableDims', () => {
  it('splits the span across the ridge', () => {
    const d = gableDims(12, 8, '12', 30);
    expect(d.ridgeLen).toBe(12);
    expect(d.half).toBe(4);
    expect(d.slope).toBeCloseTo(4 / Math.cos(Math.PI / 6), 6);
    expect(d.rise).toBeCloseTo(4 * Math.tan(Math.PI / 6), 6);
    expect(gableDims(12, 8, '23', 30).ridgeLen).toBe(8);
    expect(gableDims(12, 8, '23', 30).half).toBe(6);
  });
});

describe('footprintUV', () => {
  it('maps footprint corners to texture corners (top-left image = +x,+z)', () => {
    expect(footprintUV(5, 2, 10, 4)).toEqual([0, 1]);
    expect(footprintUV(-5, -2, 10, 4)).toEqual([1, 0]);
    expect(footprintUV(0, 0, 10, 4)).toEqual([0.5, 0.5]);
  });
  it('roof UVs stay within [0,1] and ridge sits mid-texture', () => {
    for (const r of ['12', '23'] as const) {
      const { roof } = buildHouse(10, 6, r, 35);
      roof.uv.forEach((u) => { expect(u).toBeGreaterThanOrEqual(-1e-9); expect(u).toBeLessThanOrEqual(1 + 1e-9); });
      expect(roof.position.length / 3).toBe(12);
    }
  });
  it('houseToWorld for ridge 23 runs along z', () => {
    expect(houseToWorld(1, 0, '23')).toEqual([0, -1]);
  });
});

describe('rotate', () => {
  it('round-trips points', () => {
    const p: [number, number] = [30, 70];
    const q = fromRotated(toRotated(p, 200, 100, 23), 200, 100, 23);
    expect(q[0]).toBeCloseTo(30, 6); expect(q[1]).toBeCloseTo(70, 6);
  });
  it('90° swaps size and maps top-left to top-right', () => {
    const [w, h] = rotatedSize(200, 100, 90);
    expect(w).toBeCloseTo(100, 6); expect(h).toBeCloseTo(200, 6);
    const q = toRotated([0, 0], 200, 100, 90);
    expect(q[0]).toBeCloseTo(100, 6); expect(q[1]).toBeCloseTo(0, 6);
  });
  it('straighten makes the edge horizontal', () => {
    const tot = straightenRotation(0, [0, 0], [10, 10 * Math.tan(Math.PI / 9)]);
    expect(tot).toBeCloseTo(-20, 6);
    const a = toRotated([0, 0], 100, 100, tot), b = toRotated([10, 10 * Math.tan(Math.PI / 9)], 100, 100, tot);
    expect(b[1] - a[1]).toBeCloseTo(0, 6);
    expect(splitRotation(-20)).toEqual({ quarter: 0, fine: -20 });
    expect(splitRotation(110)).toEqual({ quarter: 1, fine: 20 });
  });
});
