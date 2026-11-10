import type { ChangeEvent } from 'react';
import { LIMITS } from '../constants';
import type { CalcInput } from '../lib/api';
import type { RoofShape } from '../lib/gable';
import AddressSearch from './AddressSearch';
import type { GeoResult } from '../lib/api';

interface Props { value: CalcInput; onChange: (v: CalcInput) => void; roof: RoofShape; onRoof: (r: RoofShape) => void; photoUrl: string | null; onPhoto: (url: string | null) => void; calibrated: boolean; onCalibrate: () => void; onAddress: (r: GeoResult) => void; mapBusy: boolean; mapError: string | null }

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(n || lo)));

export default function InputPanel({ value, onChange, roof, onRoof, photoUrl, onPhoto, calibrated, onCalibrate, onAddress, mapBusy, mapError }: Props) {
  const set = (patch: Partial<CalcInput>) => onChange({ ...value, ...patch });
  const setRoof = (patch: Partial<RoofShape>) => onRoof({ ...roof, ...patch });
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    onPhoto(f ? URL.createObjectURL(f) : null);
  };
  return (
    <aside className="card panel" aria-label="Inputs">
      <h2>Layout</h2>
      <p className="hint">Auto-fill grid: rows × cols centred in the usable area.</p>
      <div className="field-row">
        <label className="field">
          <span>Rows</span>
          <input type="number" inputMode="numeric" min={LIMITS.rows[0]} max={LIMITS.rows[1]} value={value.rows}
            onChange={(e) => set({ rows: clamp(+e.target.value, LIMITS.rows) })} />
        </label>
        <label className="field">
          <span>Columns</span>
          <input type="number" inputMode="numeric" min={LIMITS.cols[0]} max={LIMITS.cols[1]} value={value.cols}
            onChange={(e) => set({ cols: clamp(+e.target.value, LIMITS.cols) })} />
        </label>
      </div>
      <label className="field">
        <span>Roof tilt <output>{value.roof_tilt}°</output></span>
        <input type="range" min={LIMITS.tilt[0]} max={LIMITS.tilt[1]} step={1} value={value.roof_tilt}
          onChange={(e) => set({ roof_tilt: +e.target.value })} />
      </label>
      <h2>Roof</h2>
      <label className="field">
        <span>Roof type</span>
        <select value={roof.type} onChange={(e) => setRoof({ type: e.target.value as RoofShape['type'] })}>
          <option value="gable">Gable (two slopes)</option>
          <option value="mono">Mono-pitch</option>
        </select>
      </label>
      {roof.type === 'gable' && (
        <>
          <label className="field">
            <span>Ridge direction</span>
            <select value={roof.ridge} onChange={(e) => setRoof({ ridge: e.target.value as RoofShape['ridge'] })}>
              <option value="12">Along edge 1→2</option>
              <option value="23">Along edge 2→3</option>
            </select>
          </label>
          <label className="field">
            <span>Panels on</span>
            <select value={roof.side} onChange={(e) => setRoof({ side: e.target.value as RoofShape['side'] })}>
              <option value="A">Front slope (edge {roof.ridge === '12' ? '1→2' : '4→1'} side)</option>
              <option value="B">Back slope (edge {roof.ridge === '12' ? '3→4' : '2→3'} side)</option>
            </select>
          </label>
        </>
      )}
      <label className="field">
        <span>Roof azimuth <output>{roof.azimuth}°</output></span>
        <input type="range" min={0} max={359} step={1} value={roof.azimuth} onChange={(e) => setRoof({ azimuth: +e.target.value })} />
      </label>
      <h2>Site loads</h2>
      <label className="field">
        <span>Wind zone</span>
        <select value={value.wind_zone} onChange={(e) => set({ wind_zone: +e.target.value })}>
          {[1, 2, 3, 4].map((z) => <option key={z} value={z}>Zone {z}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Snow zone</span>
        <select value={value.snow_zone} onChange={(e) => set({ snow_zone: +e.target.value })}>
          {[1, 2, 3].map((z) => <option key={z} value={z}>Zone {z}</option>)}
        </select>
      </label>
      <h2>Roof photo</h2>
      <AddressSearch onPick={onAddress} busy={mapBusy} />
      {mapError && <p className="alert alert-danger">{mapError}</p>}
      <label className="field">
        <span>Or upload a satellite screenshot (any rotation or zoom, needs one edge length)</span>
        <input type="file" accept="image/*" onChange={onFile} />
      </label>
      {photoUrl && (
        <>
          <p className="hint">{calibrated ? 'Photo calibrated and mapped on the roof.' : 'Not calibrated yet: the photo is not shown in 3D.'}</p>
          <button type="button" className="btn-secondary" onClick={onCalibrate}>{calibrated ? 'Recalibrate roof' : 'Calibrate roof'}</button>
          <button type="button" className="btn-secondary" onClick={() => onPhoto(null)}>Remove photo</button>
        </>
      )}
    </aside>
  );
}
