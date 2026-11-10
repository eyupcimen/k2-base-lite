import type { Pt } from './homography';

/** Web Mercator (EPSG:3857) helpers for 256 px XYZ tiles. Pixel y grows southwards. */
export const TILE_PX = 256;
const EQUATOR_M_PER_PX_Z0 = 156543.03392;
const rad = (d: number) => (d * Math.PI) / 180;

export const worldPx = (z: number) => TILE_PX * 2 ** z;

/** lat/lon -> global pixel at zoom z. */
export function latLonToPixel(lat: number, lon: number, z: number): Pt {
  const s = worldPx(z), sinLat = Math.sin(rad(lat));
  return [((lon + 180) / 360) * s, (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * s];
}

/** Global pixel at zoom z -> [lat, lon]. */
export function pixelToLatLon([x, y]: Pt, z: number): [number, number] {
  const s = worldPx(z);
  const n = Math.PI - (2 * Math.PI * y) / s;
  return [(Math.atan(Math.sinh(n)) * 180) / Math.PI, (x / s) * 360 - 180];
}

/** Ground metres per image pixel at latitude `lat` and zoom z. */
export const metersPerPixel = (lat: number, z: number) => (EQUATOR_M_PER_PX_Z0 * Math.cos(rad(lat))) / 2 ** z;

/** n x n tile block whose centre is closest to the point; origin = global pixel of its top-left corner. */
export function tileRange(lat: number, lon: number, z: number, n = 4) {
  const [px, py] = latLonToPixel(lat, lon, z);
  const x0 = Math.round(px / TILE_PX - n / 2), y0 = Math.round(py / TILE_PX - n / 2);
  const tiles: { x: number; y: number; col: number; row: number }[] = [];
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) tiles.push({ x: x0 + col, y: y0 + row, col, row });
  return { x0, y0, n, origin: [x0 * TILE_PX, y0 * TILE_PX] as Pt, tiles };
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull (monotone chain). */
export function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const half = (src: Pt[]) => {
    const h: Pt[] = [];
    for (const q of src) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
    h.pop();
    return h;
  };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * Minimum-area bounding rectangle (rotating edges of the hull).
 * Returns 4 corners clockwise on screen (y down), starting with the top-left end of the
 * most horizontal top edge, so edge 1→2 is the "top" edge. `angle` = edge 1→2 direction in
 * degrees, clockwise from image +x, in [-45, 45).
 */
export function minAreaRect(points: Pt[]): { corners: Pt[]; angle: number; width: number; height: number } {
  const hull = convexHull(points);
  if (hull.length < 3) throw new Error('Need at least 3 non-collinear points');
  let best: { area: number; a: number; c: Pt[] } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i], q = hull[(i + 1) % hull.length];
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const ux = Math.cos(a), uy = Math.sin(a);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of hull) {
      const u = x * ux + y * uy, v = -x * uy + y * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area - 1e-9) {
      const P = (u: number, v: number): Pt => [u * ux - v * uy, u * uy + v * ux];
      best = { area, a, c: [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)] };
    }
  }
  // Normalise: rotate the axis into [-45, 45) and order corners top-left, top-right, bottom-right, bottom-left.
  let deg = (best!.a * 180) / Math.PI;
  deg = ((((deg + 45) % 90) + 90) % 90) - 45;
  const t = rad(deg), ux = Math.cos(t), uy = Math.sin(t);
  const local = best!.c.map(([x, y]) => ({ p: [x, y] as Pt, u: x * ux + y * uy, v: -x * uy + y * ux }));
  const cu = local.reduce((s, l) => s + l.u, 0) / 4, cv = local.reduce((s, l) => s + l.v, 0) / 4;
  const pick = (su: number, sv: number) => local.reduce((m, l) => ((l.u - cu) * su + (l.v - cv) * sv > (m.u - cu) * su + (m.v - cv) * sv ? l : m)).p;
  const corners = [pick(-1, -1), pick(1, -1), pick(1, 1), pick(-1, 1)];
  const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return { corners, angle: deg, width: d(corners[0], corners[1]), height: d(corners[1], corners[2]) };
}

/** Roof azimuth (0..359) for the 3D scene from the edge 1→2 angle of a north-up image. */
export const azimuthFromAngle = (angleDeg: number) => Math.round((((angleDeg + 180) % 360) + 360) % 360) % 360;
