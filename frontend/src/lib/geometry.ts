import { PANEL_GAP_M, PANEL_HEIGHT_M, PANEL_WIDTH_M, RAIL_OFFSET_M, RAIL_OVERHANG_M, RAIL_BAR_M, ROOF_MARGIN_M } from '../constants';

/** Local roof coordinates: x along the eave, z up the slope, y = roof normal. */
export type Vec3 = [number, number, number];

export const arrayWidth = (cols: number) => cols * PANEL_WIDTH_M + Math.max(0, cols - 1) * PANEL_GAP_M;
export const arrayDepth = (rows: number) => rows * PANEL_HEIGHT_M + Math.max(0, rows - 1) * PANEL_GAP_M;

/** Z of the centre of a panel row, array centred on the origin. */
export const rowCenterZ = (row: number, rows: number) => -arrayDepth(rows) / 2 + PANEL_HEIGHT_M / 2 + row * (PANEL_HEIGHT_M + PANEL_GAP_M);
export const colCenterX = (col: number, cols: number) => -arrayWidth(cols) / 2 + PANEL_WIDTH_M / 2 + col * (PANEL_WIDTH_M + PANEL_GAP_M);

export interface PanelPlacement { id: string; row: number; col: number; position: Vec3 }

export function panelPlacements(rows: number, cols: number, y: number): PanelPlacement[] {
  const out: PanelPlacement[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push({ id: `${r}-${c}`, row: r, col: c, position: [colCenterX(c, cols), y, rowCenterZ(r, rows)] });
  return out;
}

export interface RailPlacement { id: string; position: Vec3; length: number }

export function railPlacements(rows: number, cols: number, y: number): RailPlacement[] {
  const length = railLengthPerRail(cols);
  const out: RailPlacement[] = [];
  for (let r = 0; r < rows; r++)
    for (const s of [-1, 1]) out.push({ id: `${r}-${s}`, position: [0, y, rowCenterZ(r, rows) + s * RAIL_OFFSET_M], length });
  return out;
}

export const railLengthPerRail = (cols: number) => arrayWidth(cols) + 2 * RAIL_OVERHANG_M;
export const totalRailLength = (rows: number, cols: number) => 2 * rows * railLengthPerRail(cols);
export const railBarsNeeded = (rows: number, cols: number) => 2 * rows * Math.ceil(railLengthPerRail(cols) / RAIL_BAR_M);

export const roofSize = (rows: number, cols: number): [number, number] => [arrayWidth(cols) + 2 * ROOF_MARGIN_M, arrayDepth(rows) + 2 * ROOF_MARGIN_M];
export const degToRad = (deg: number) => (deg * Math.PI) / 180;
