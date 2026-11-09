export interface CalcInput { rows: number; cols: number; roof_tilt: number; wind_zone: number; snow_zone: number; runs?: { panels: number }[] }
export interface BomItem { item_number: string; description: string; quantity: number; unit: 'Pcs' | 'Set' }
export interface CalcResult {
  total_panels: number; runs?: number; total_power_kwp: number; rail_length_m: number; system_weight_kg: number;
  load_check: { status: 'ok' | 'warning'; message: string; disclaimer: string };
  bom: BomItem[];
}

export class ApiError extends Error {}

export function formatApiErrors(body: unknown): string {
  if (body && typeof body === 'object') {
    return Object.entries(body as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`).join('; ');
  }
  return 'Unknown error';
}

export async function calculate(input: CalcInput, signal?: AbortSignal): Promise<CalcResult> {
  const res = await fetch('/api/calculate/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  if (res.status === 400) throw new ApiError(formatApiErrors(await res.json().catch(() => null)));
  if (!res.ok) throw new ApiError(`Server error (${res.status})`);
  return res.json();
}
