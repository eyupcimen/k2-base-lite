// Geometry constants from CONTRACT.md. Must match backend.
export const PANEL_WIDTH_M = 1.134;
export const PANEL_HEIGHT_M = 1.722;
export const PANEL_GAP_M = 0.02;
export const RAIL_OVERHANG_M = 0.1;
export const RAIL_BAR_M = 4.4;
export const RAILS_PER_ROW = 2;
export const RAIL_OFFSET_M = 0.4;
export const PANEL_POWER_W = 430;
export const PANEL_WEIGHT_KG = 21.5;

// Render-only dimensions (local roof normal = +Y).
export const PANEL_THICKNESS_M = 0.04;
export const RAIL_SIZE_M = 0.04;
export const RAIL_Y_M = RAIL_SIZE_M / 2;
export const PANEL_Y_M = RAIL_SIZE_M + PANEL_THICKNESS_M / 2;
export const ROOF_MARGIN_M = 1;

export const LIMITS = { rows: [1, 20], cols: [1, 30], tilt: [0, 60], wind: [1, 4], snow: [1, 3] } as const;
