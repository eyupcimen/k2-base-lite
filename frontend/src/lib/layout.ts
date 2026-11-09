// Free panel layout on one roof slope (CONTRACT v2).
// Slope-local coordinates: u along the ridge (0 = slope centre), v up-slope (0 = eave). Metres.
import { PANEL_GAP_M, PANEL_HEIGHT_M, PANEL_WIDTH_M, RAIL_OFFSET_M, RAIL_OVERHANG_M } from '../constants';

export interface Panel { id: string; u: number; v: number }
export interface Rect { u0: number; u1: number; v0: number; v1: number }
export interface Obstacle extends Rect { id: string }
export interface Run { panels: number; ids: string[]; u: number; v: number; length: number }

export const AREA_MARGIN_M = 0.3;
export const OBSTACLE_MARGIN_M = 0.2;
export const GRID_M = 0.05;
export const SNAP_M = 0.35;
export const MAX_RUN = 60;
const EPS = 1e-6;
const ROW_TOL = 0.01;
const PITCH_U = PANEL_WIDTH_M + PANEL_GAP_M;
const PITCH_V = PANEL_HEIGHT_M + PANEL_GAP_M;

export const panelRect = (p: { u: number; v: number }): Rect =>
  ({ u0: p.u - PANEL_WIDTH_M / 2, u1: p.u + PANEL_WIDTH_M / 2, v0: p.v - PANEL_HEIGHT_M / 2, v1: p.v + PANEL_HEIGHT_M / 2 });
export const normRect = (r: Rect): Rect =>
  ({ u0: Math.min(r.u0, r.u1), u1: Math.max(r.u0, r.u1), v0: Math.min(r.v0, r.v1), v1: Math.max(r.v0, r.v1) });
export const grow = (r: Rect, m: number): Rect => ({ u0: r.u0 - m, u1: r.u1 + m, v0: r.v0 - m, v1: r.v1 + m });

/** Strict overlap; touching edges do not count. */
export const overlaps = (a: Rect, b: Rect) => a.u0 < b.u1 - EPS && b.u0 < a.u1 - EPS && a.v0 < b.v1 - EPS && b.v0 < a.v1 - EPS;
export const insideArea = (r: Rect, area: Rect) => r.u0 >= area.u0 - EPS && r.u1 <= area.u1 + EPS && r.v0 >= area.v0 - EPS && r.v1 <= area.v1 + EPS;

/** Whole slope minus the default edge margin. */
export const defaultArea = (ridgeLen: number, slopeLen: number, m = AREA_MARGIN_M): Rect =>
  ({ u0: -ridgeLen / 2 + m, u1: ridgeLen / 2 - m, v0: m, v1: Math.max(m, slopeLen - m) });

export interface Ctx { area: Rect; obstacles: Rect[]; margin: number }

export function isValid(p: { u: number; v: number }, others: { u: number; v: number }[], ctx: Ctx): boolean {
  const r = panelRect(p);
  if (!insideArea(r, ctx.area)) return false;
  if (ctx.obstacles.some((o) => overlaps(r, grow(normRect(o), ctx.margin)))) return false;
  return !others.some((o) => overlaps(r, panelRect(o)));
}

const snapGrid = (x: number, g: number) => Math.round(x / g) * g;

/** Grid snap, overridden per axis by the nearest neighbour edge/alignment within `thr`. */
export function snapPanel(p: { u: number; v: number }, others: { u: number; v: number }[], grid = GRID_M, thr = SNAP_M) {
  let u = snapGrid(p.u, grid), v = snapGrid(p.v, grid);
  let bu = thr + EPS, bv = thr + EPS;
  for (const n of others) {
    const nearU = Math.abs(p.v - n.v) < PITCH_V + thr; // neighbour row band
    const nearV = Math.abs(p.u - n.u) < PITCH_U + thr;
    if (nearU) for (const c of [n.u - PITCH_U, n.u, n.u + PITCH_U]) {
      const d = Math.abs(p.u - c);
      if (d < bu) { bu = d; u = c; }
    }
    if (nearV) for (const c of [n.v - PITCH_V, n.v, n.v + PITCH_V]) {
      const d = Math.abs(p.v - c);
      if (d < bv) { bv = d; v = c; }
    }
  }
  return { u: round(u), v: round(v) };
}
const round = (x: number) => Math.round(x * 1e6) / 1e6;

/** Free u-intervals of `area` for a horizontal band [v0, v1], minus obstacles (+margin). */
function freeIntervals(area: Rect, v0: number, v1: number, obstacles: Rect[], margin: number): [number, number][] {
  const blocks = obstacles.map((o) => grow(normRect(o), margin)).filter((o) => o.v0 < v1 - EPS && v0 < o.v1 - EPS)
    .map((o) => [o.u0, o.u1] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = area.u0;
  for (const [a, b] of blocks) {
    if (a > cur) out.push([cur, Math.min(a, area.u1)]);
    cur = Math.max(cur, b);
    if (cur >= area.u1) break;
  }
  if (cur < area.u1) out.push([cur, area.u1]);
  return out.filter(([a, b]) => b - a >= PANEL_WIDTH_M - EPS);
}

let seq = 0;
export const newId = () => `p${++seq}`;

/** Fill the usable area row by row from the eave; each free segment is centred. */
export function autoFill(ctx: Ctx, mkId = newId): Panel[] {
  const { area } = ctx;
  const out: Panel[] = [];
  for (let v = area.v0 + PANEL_HEIGHT_M / 2; v + PANEL_HEIGHT_M / 2 <= area.v1 + EPS; v += PITCH_V) {
    for (const [a, b] of freeIntervals(area, v - PANEL_HEIGHT_M / 2, v + PANEL_HEIGHT_M / 2, ctx.obstacles, ctx.margin)) {
      const n = Math.floor((b - a + PANEL_GAP_M + EPS) / PITCH_U);
      const start = (a + b) / 2 - (n * PITCH_U - PANEL_GAP_M) / 2 + PANEL_WIDTH_M / 2;
      for (let i = 0; i < n; i++) out.push({ id: mkId(), u: round(start + i * PITCH_U), v: round(v) });
    }
  }
  return out;
}

/** rows x cols block centred in the usable area; positions that are not valid are dropped. */
export function gridFill(rows: number, cols: number, ctx: Ctx, mkId = newId): Panel[] {
  const cu = (ctx.area.u0 + ctx.area.u1) / 2, cv = (ctx.area.v0 + ctx.area.v1) / 2;
  const out: Panel[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = { id: mkId(), u: round(cu + (c - (cols - 1) / 2) * PITCH_U), v: round(cv + (r - (rows - 1) / 2) * PITCH_V) };
      if (isValid(p, out, ctx)) out.push(p);
    }
  return out;
}

/** First valid position scanning from the eave, left to right, on the snap grid. */
export function firstFreeSpot(panels: Panel[], ctx: Ctx, step = GRID_M): { u: number; v: number } | null {
  const { area } = ctx;
  for (let v = area.v0 + PANEL_HEIGHT_M / 2; v + PANEL_HEIGHT_M / 2 <= area.v1 + EPS; v += step)
    for (let u = area.u0 + PANEL_WIDTH_M / 2; u + PANEL_WIDTH_M / 2 <= area.u1 + EPS; u += step) {
      const p = { u: round(u), v: round(v) };
      if (isValid(p, panels, ctx)) return p;
    }
  return null;
}

export const runLength = (n: number) => n * PANEL_WIDTH_M + (n - 1) * PANEL_GAP_M + 2 * RAIL_OVERHANG_M;

/** Runs = same v (±0.01) and contiguous along u with the standard gap; split at MAX_RUN. */
export function computeRuns(panels: { id: string; u: number; v: number }[]): Run[] {
  const sorted = [...panels].sort((a, b) => a.v - b.v || a.u - b.u);
  const rows: (typeof sorted)[] = [];
  for (const p of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(p.v - row[0].v) <= ROW_TOL) row.push(p); else rows.push([p]);
  }
  const runs: Run[] = [];
  const flush = (g: typeof sorted) => {
    if (!g.length) return;
    const u = (g[0].u + g[g.length - 1].u) / 2;
    const v = g.reduce((s, p) => s + p.v, 0) / g.length;
    runs.push({ panels: g.length, ids: g.map((p) => p.id), u, v, length: runLength(g.length) });
  };
  for (const row of rows) {
    row.sort((a, b) => a.u - b.u);
    let g = [row[0]];
    for (let i = 1; i < row.length; i++) {
      const contiguous = Math.abs(row[i].u - row[i - 1].u - PITCH_U) <= ROW_TOL;
      if (contiguous && g.length < MAX_RUN) g.push(row[i]); else { flush(g); g = [row[i]]; }
    }
    flush(g);
  }
  return runs;
}

/** Two rails per run at ±RAIL_OFFSET_M from the run centre. */
export const runRails = (runs: Run[]) =>
  runs.flatMap((r, i) => [-1, 1].map((s) => ({ id: `${i}-${s}`, u: r.u, v: r.v + s * RAIL_OFFSET_M, length: r.length })));

/** Move one edge of the usable area, clamped to the slope with a minimum size. */
export function moveAreaEdge(area: Rect, edge: 'u0' | 'u1' | 'v0' | 'v1', value: number, slope: Rect, min = 0.5): Rect {
  const next = { ...area };
  if (edge === 'u0') next.u0 = Math.min(Math.max(value, slope.u0), area.u1 - min);
  if (edge === 'u1') next.u1 = Math.max(Math.min(value, slope.u1), area.u0 + min);
  if (edge === 'v0') next.v0 = Math.min(Math.max(value, slope.v0), area.v1 - min);
  if (edge === 'v1') next.v1 = Math.max(Math.min(value, slope.v1), area.v0 + min);
  return next;
}
