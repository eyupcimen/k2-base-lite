import { describe, expect, it } from 'vitest';
import { azimuthFromAngle, latLonToPixel, metersPerPixel, minAreaRect, pixelToLatLon, tileRange, TILE_PX } from './geo';
import type { Pt } from './homography';

describe('web mercator', () => {
  it('maps (0,0) to the world centre', () => {
    expect(latLonToPixel(0, 0, 0)).toEqual([128, 128]);
  });
  it('round-trips lat/lon', () => {
    const [lat, lon] = pixelToLatLon(latLonToPixel(52.5163, 13.3777, 20), 20);
    expect(lat).toBeCloseTo(52.5163, 9);
    expect(lon).toBeCloseTo(13.3777, 9);
  });
  it('metres per pixel', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543.03392, 4);
    expect(metersPerPixel(60, 1)).toBeCloseTo(156543.03392 / 4, 4);
  });
  it('pixel distance x m/px matches ground distance', () => {
    const [x0] = latLonToPixel(52.5, 13, 20), [x1] = latLonToPixel(52.5, 13.001, 20);
    const ground = 0.001 * (Math.PI / 180) * 6378137 * Math.cos((52.5 * Math.PI) / 180);
    expect((x1 - x0) * metersPerPixel(52.5, 20)).toBeCloseTo(ground, 3);
  });
});

describe('tileRange', () => {
  it('4x4 block contains the point near its centre', () => {
    const r = tileRange(52.5163, 13.3777, 20);
    expect(r.tiles).toHaveLength(16);
    const [px, py] = latLonToPixel(52.5163, 13.3777, 20);
    const lx = px - r.origin[0], ly = py - r.origin[1];
    expect(lx).toBeGreaterThanOrEqual(1.5 * TILE_PX);
    expect(lx).toBeLessThanOrEqual(2.5 * TILE_PX);
    expect(ly).toBeGreaterThanOrEqual(1.5 * TILE_PX);
    expect(ly).toBeLessThanOrEqual(2.5 * TILE_PX);
    expect(r.tiles[5]).toEqual({ x: r.x0 + 1, y: r.y0 + 1, col: 1, row: 1 });
  });
});

describe('minAreaRect', () => {
  it('axis-aligned rectangle, with a notch point', () => {
    const r = minAreaRect([[0, 0], [10, 0], [10, 4], [5, 2], [0, 4]]);
    expect(r.angle).toBeCloseTo(0);
    expect(r.width).toBeCloseTo(10);
    expect(r.height).toBeCloseTo(4);
    expect(r.corners[0][0]).toBeCloseTo(0); expect(r.corners[0][1]).toBeCloseTo(0);
    expect(r.corners[2][0]).toBeCloseTo(10); expect(r.corners[2][1]).toBeCloseTo(4);
  });
  it('rotated rectangle recovers angle and size', () => {
    const a = (30 * Math.PI) / 180, R = ([x, y]: Pt): Pt => [x * Math.cos(a) - y * Math.sin(a) + 50, x * Math.sin(a) + y * Math.cos(a) + 20];
    const r = minAreaRect([[0, 0], [8, 0], [8, 3], [0, 3]].map((p) => R(p as Pt)));
    expect(r.angle).toBeCloseTo(30);
    expect(r.width * r.height).toBeCloseTo(24);
    expect(Math.max(r.width, r.height)).toBeCloseTo(8);
    // clockwise on screen (y down): positive shoelace sum
    const c = r.corners; let s = 0;
    for (let i = 0; i < 4; i++) s += c[i][0] * c[(i + 1) % 4][1] - c[(i + 1) % 4][0] * c[i][1];
    expect(s).toBeGreaterThan(0);
  });
  it('normalises steep angles into [-45, 45)', () => {
    const a = (80 * Math.PI) / 180;
    const r = minAreaRect([[0, 0], [6, 0], [6, 2], [0, 2]].map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)] as Pt));
    expect(r.angle).toBeCloseTo(-10);
    expect(r.width).toBeCloseTo(2);
    expect(r.height).toBeCloseTo(6);
  });
  it('throws on degenerate input', () => {
    expect(() => minAreaRect([[0, 0], [1, 1]])).toThrow();
  });
});

describe('azimuthFromAngle', () => {
  it('adds 180 and wraps', () => {
    expect(azimuthFromAngle(0)).toBe(180);
    expect(azimuthFromAngle(-10)).toBe(170);
    expect(azimuthFromAngle(200)).toBe(20);
  });
});
