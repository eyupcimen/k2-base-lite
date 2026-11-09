import { LIMITS, PANEL_GAP_M, PANEL_HEIGHT_M, PANEL_WIDTH_M } from '../constants';

export type Pt = [number, number];
/** Row-major 3x3 matrix, h[8] = 1. */
export type H = number[];

/** Solve A x = b (Gaussian elimination, partial pivoting). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('Degenerate points');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** 4-point DLT: homography mapping src[i] -> dst[i]. */
export function homography(src: Pt[], dst: Pt[]): H {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...solve(A, b), 1];
}

export function apply(h: H, [x, y]: Pt): Pt {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Roof size from 4 clockwise corners; edge 1→2 = widthM. Depth from averaged opposite-edge ratio. */
export function roofDims(pts: Pt[], widthM: number) {
  const w = (dist(pts[0], pts[1]) + dist(pts[3], pts[2])) / 2;
  const d = (dist(pts[1], pts[2]) + dist(pts[0], pts[3])) / 2;
  return { width: widthM, depth: (widthM * d) / w, ratio: d / w };
}

export const EDGE_MARGIN_M = 0.3;
/** Panels that fit along `len`; 0 if none fit, capped at the API limit. */
const fit = (len: number, panel: number, [, hi]: readonly [number, number]) =>
  Math.min(hi, Math.max(0, Math.floor((len - 2 * EDGE_MARGIN_M + PANEL_GAP_M) / (panel + PANEL_GAP_M))));

/** Max cols along width; max rows along slope length = depth / cos(tilt). */
export function suggestLayout(width: number, depth: number, tiltDeg: number) {
  const slope = depth / Math.cos((tiltDeg * Math.PI) / 180);
  return { slope, cols: fit(width, PANEL_WIDTH_M, LIMITS.cols), rows: fit(slope, PANEL_HEIGHT_M, LIMITS.rows) };
}

/** Rectify the quad `pts` of `img` into an outW x outH canvas. */
export function rectify(img: HTMLImageElement | HTMLCanvasElement, pts: Pt[], outW: number, outH: number): HTMLCanvasElement {
  let src: HTMLCanvasElement;
  if (img instanceof HTMLCanvasElement) src = img;
  else {
    src = document.createElement('canvas');
    src.width = img.naturalWidth; src.height = img.naturalHeight;
    src.getContext('2d')!.drawImage(img, 0, 0);
  }
  const sctx = src.getContext('2d')!;
  const sd = sctx.getImageData(0, 0, src.width, src.height).data;
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(outW, outH);
  const h = homography([[0, 0], [outW, 0], [outW, outH], [0, outH]], pts);
  for (let y = 0; y < outH; y++)
    for (let x = 0; x < outW; x++) {
      const [sx, sy] = apply(h, [x + 0.5, y + 0.5]);
      const ix = Math.min(src.width - 1, Math.max(0, Math.floor(sx)));
      const iy = Math.min(src.height - 1, Math.max(0, Math.floor(sy)));
      const si = (iy * src.width + ix) * 4, oi = (y * outW + x) * 4;
      od.data[oi] = sd[si]; od.data[oi + 1] = sd[si + 1]; od.data[oi + 2] = sd[si + 2]; od.data[oi + 3] = 255;
    }
  octx.putImageData(od, 0, 0);
  return out;
}
