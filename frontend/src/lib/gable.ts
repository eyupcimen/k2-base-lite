import { degToRad } from './geometry';

export type RoofType = 'gable' | 'mono';
export type RidgeDir = '12' | '23';
export type SlopeSide = 'A' | 'B';
export interface RoofShape { type: RoofType; ridge: RidgeDir; side: SlopeSide; azimuth: number }
export const DEFAULT_ROOF: RoofShape = { type: 'gable', ridge: '12', side: 'A', azimuth: 0 };
export const WALL_HEIGHT_M = 2.6;

/** Footprint W (image horizontal, edge 1→2) x D (image vertical) -> gable dimensions. */
export function gableDims(W: number, D: number, ridge: RidgeDir, tiltDeg: number) {
  const ridgeLen = ridge === '12' ? W : D;
  const span = ridge === '12' ? D : W;
  const half = span / 2;
  return { ridgeLen, span, half, slope: half / Math.cos(degToRad(tiltDeg)), rise: half * Math.tan(degToRad(tiltDeg)) };
}

/** Planar top-down UV for footprint point (x, z). Image left = +x, image top = +z (texture flipY). */
export const footprintUV = (x: number, z: number, W: number, D: number): [number, number] => [0.5 - x / W, 0.5 + z / D];

/** House frame (a along ridge, b across) -> footprint (x, z). Matches a Y-rotation of +90° for ridge '23'. */
export const houseToWorld = (a: number, b: number, ridge: RidgeDir): [number, number] => (ridge === '12' ? [a, b] : [b, -a]);

type V = [number, number, number];
export interface HouseMesh { roof: { position: number[]; uv: number[] }; walls: number[] }

/** Non-indexed triangle soup for both roof planes (with UVs), gable triangles and walls. */
export function buildHouse(W: number, D: number, ridge: RidgeDir, tiltDeg: number, wallH = WALL_HEIGHT_M): HouseMesh {
  const { ridgeLen: L, half: S2, rise } = gableDims(W, D, ridge, tiltDeg);
  const P = (a: number, y: number, b: number): V => { const [x, z] = houseToWorld(a, b, ridge); return [x, y, z]; };
  const roof = { position: [] as number[], uv: [] as number[] };
  const walls: number[] = [];
  const tri = (out: number[], ...v: V[]) => v.forEach((p) => out.push(...p));
  const roofTri = (...v: V[]) => v.forEach((p) => { roof.position.push(...p); roof.uv.push(...footprintUV(p[0], p[2], W, D)); });
  const top = wallH + rise;
  for (const s of [1, -1]) {
    const e0 = P(-L / 2, wallH, s * S2), e1 = P(L / 2, wallH, s * S2), r1 = P(L / 2, top, 0), r0 = P(-L / 2, top, 0);
    roofTri(e0, e1, r1); roofTri(e0, r1, r0);
    tri(walls, P(s * L / 2, wallH, -S2), P(s * L / 2, wallH, S2), P(s * L / 2, top, 0));
  }
  const quad = (a: V, b: V) => {
    const a0: V = [a[0], 0, a[2]], b0: V = [b[0], 0, b[2]];
    tri(walls, a0, b0, b); tri(walls, a0, b, a);
  };
  const c = [P(-L / 2, wallH, -S2), P(L / 2, wallH, -S2), P(L / 2, wallH, S2), P(-L / 2, wallH, S2)];
  c.forEach((p, i) => quad(p, c[(i + 1) % 4]));
  return { roof, walls };
}

/** Default footprint (top-down) when no photo is calibrated. */
export const DEFAULT_FOOTPRINT: [number, number] = [10, 9];
export const DEFAULT_MONO: [number, number] = [10, 5];

/** Active slope size: ridgeLen along the ridge/eave (u), slopeLen up-slope (v). */
export function slopeSize(type: RoofType, ridge: RidgeDir, tiltDeg: number, calib: { width: number; depth: number } | null) {
  if (type === 'gable') {
    const [W, D] = calib ? [calib.width, calib.depth] : DEFAULT_FOOTPRINT;
    const g = gableDims(W, D, ridge, tiltDeg);
    return { foot: [W, D] as [number, number], ridgeLen: g.ridgeLen, slopeLen: g.slope };
  }
  const [W, D] = calib ? [calib.width, calib.depth] : DEFAULT_MONO;
  return { foot: [W, D] as [number, number], ridgeLen: W, slopeLen: D / Math.cos(degToRad(tiltDeg)) };
}
