import { describe, expect, it } from 'vitest';
import { apply, homography, roofDims, suggestLayout, type Pt } from './homography';

const rot = ([x, y]: Pt, deg: number, s: number, t: Pt): Pt => {
  const a = (deg * Math.PI) / 180;
  return [s * (x * Math.cos(a) - y * Math.sin(a)) + t[0], s * (x * Math.sin(a) + y * Math.cos(a)) + t[1]];
};

describe('homography', () => {
  it('maps the 4 points exactly', () => {
    const src: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const dst: Pt[] = [[10, 20], [200, 35], [180, 240], [5, 210]];
    const h = homography(src, dst);
    src.forEach((p, i) => { const q = apply(h, p); expect(q[0]).toBeCloseTo(dst[i][0], 6); expect(q[1]).toBeCloseTo(dst[i][1], 6); });
  });
  it('recovers a 20° rotated, scaled roof (synthetic screenshot)', () => {
    // 12 m x 7 m roof, 23 px/m, rotated 20°, offset in a 1600x1000 screenshot.
    const rect: Pt[] = [[0, 0], [12, 0], [12, 7], [0, 7]];
    const img = rect.map((p) => rot(p, 20, 23, [600, 300]));
    const dims = roofDims(img, 12);
    expect(dims.depth).toBeCloseTo(7, 6);
    const h = homography(rect, img);
    const mid = apply(h, [6, 3.5]);
    const exp = rot([6, 3.5], 20, 23, [600, 300]);
    expect(mid[0]).toBeCloseTo(exp[0], 6);
    expect(mid[1]).toBeCloseTo(exp[1], 6);
  });
  it('throws on degenerate (collinear) points', () => {
    expect(() => homography([[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]])).toThrow();
  });
  it('suggests rows on slope length with 0.3 m margin', () => {
    const s = suggestLayout(10, 6, 30);
    expect(s.slope).toBeCloseTo(6 / Math.cos(Math.PI / 6));
    expect(s.cols).toBe(8); // (10-0.6+0.02)/1.154 = 8.16
    expect(s.rows).toBe(3); // (6.928-0.6+0.02)/1.742 = 3.64
  });
});
