import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InputPanel from './components/InputPanel';
import ResultsPanel from './components/ResultsPanel';
import RoofScene from './components/RoofScene';
import RoofCalibration, { type RoofCalib } from './components/RoofCalibration';
import { useCalculation } from './lib/useCalculation';
import type { CalcInput } from './lib/api';
import { DEFAULT_ROOF, slopeSize, type RoofShape } from './lib/gable';
import { adjacentSpot, autoFill, computeRuns, defaultArea, gridFill, newId, OBSTACLE_MARGIN_M, type Obstacle, type Panel, type Rect } from './lib/layout';
import type { EditMode } from './components/SlopeEditor';

const DEFAULTS: CalcInput = { rows: 2, cols: 2, roof_tilt: 30, wind_zone: 2, snow_zone: 1 };

const MODES: { id: EditMode; label: string; hint: string }[] = [
  { id: 'panels', label: 'Panels', hint: 'Drag a panel to move it (snaps to neighbours). Shift+click to multi-select. Red = invalid, reverts on drop.' },
  { id: 'obstacles', label: 'Obstacles', hint: 'Drag on the roof to draw a window, chimney or vent. Click one to select, drag its corners to resize.' },
  { id: 'area', label: 'Usable area', hint: 'Drag the 4 edge handles to mark the part of the roof that is yours. Panels stay inside.' },
];

export default function App() {
  const [input, setInput] = useState<CalcInput>(DEFAULTS);
  const [roof, setRoof] = useState<RoofShape>(DEFAULT_ROOF);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [calib, setCalib] = useState<RoofCalib | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [mode, setMode] = useState<EditMode>('panels');
  const [snap, setSnap] = useState(true);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [keepOut, setKeepOut] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selOb, setSelOb] = useState<string | null>(null);
  const pendingFill = useRef(false);

  const ss = slopeSize(roof.type, roof.ridge, input.roof_tilt, calib);
  const slopeKey = `${ss.ridgeLen.toFixed(3)}x${ss.slopeLen.toFixed(3)}`;
  const [area, setArea] = useState<Rect>(() => defaultArea(ss.ridgeLen, ss.slopeLen));
  const margin = keepOut ? OBSTACLE_MARGIN_M : 0;
  const ctx = useMemo(() => ({ area, obstacles, margin }), [area, obstacles, margin]);
  const runs = useMemo(() => computeRuns(panels), [panels]);
  const calc = useCalculation({ ...input, runs: runs.map((r) => ({ panels: r.panels })) });

  useEffect(() => { setArea(defaultArea(ss.ridgeLen, ss.slopeLen)); }, [slopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPanels(gridFill(input.rows, input.cols, ctx)); }, [input.rows, input.cols]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pendingFill.current) { pendingFill.current = false; setPanels(autoFill(ctx)); } }, [ctx]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  const onPhoto = (url: string | null) => { setPhotoUrl(url); setCalib(null); setCalibrating(!!url); };

  const fill = () => { setPanels(autoFill(ctx)); setSelected(new Set()); };
  const addPanel = () => { const p = adjacentSpot(panels, ctx, [...selected].pop()); if (p) setPanels([...panels, { id: newId(), ...p }]); };
  const clear = () => { setPanels([]); setSelected(new Set()); };
  const deleteSelected = useCallback(() => {
    if (mode === 'obstacles' && selOb) { setObstacles((o) => o.filter((x) => x.id !== selOb)); setSelOb(null); return; }
    if (mode === 'panels' && selected.size) { setPanels((p) => p.filter((x) => !selected.has(x.id))); setSelected(new Set()); }
  }, [mode, selOb, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape') { setSelected(new Set()); setSelOb(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected]);
  const hint = MODES.find((m) => m.id === mode)!.hint;

  return (
    <div className="app">
      <header className="app-header">
        <h1>K2 Base Lite</h1>
        <span className="app-sub">PV roof layout and BOM configurator (demo)</span>
      </header>
      <main className="layout">
        <InputPanel value={input} onChange={setInput} roof={roof} onRoof={setRoof} photoUrl={photoUrl} onPhoto={onPhoto} calibrated={!!calib} onCalibrate={() => setCalibrating(true)} />
        <section className="scene card" aria-label="3D roof layout">
          <div className="scene-toolbar">
            <div className="segmented" role="tablist" aria-label="Edit mode">
              {MODES.map((m) => (
                <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'seg seg-on' : 'seg'}
                  onClick={() => { setMode(m.id); setSelOb(null); }}>{m.label}</button>
              ))}
            </div>
            <div className="scene-actions">
              {mode === 'panels' && (
                <>
                  <button type="button" className="btn-secondary" onClick={fill}>Auto-fill</button>
                  <button type="button" className="btn-secondary" onClick={addPanel}>Add panel</button>
                  <button type="button" className="btn-secondary" disabled={!selected.size} onClick={deleteSelected}>Delete{selected.size ? ` (${selected.size})` : ''}</button>
                  <button type="button" className="btn-secondary" disabled={!panels.length} onClick={clear}>Clear</button>
                  <label className="check"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Magnet snap</label>
                </>
              )}
              {mode === 'obstacles' && (
                <>
                  <label className="check"><input type="checkbox" checked={keepOut} onChange={(e) => setKeepOut(e.target.checked)} /> 0.2 m clearance</label>
                  <button type="button" className="btn-secondary" disabled={!selOb} onClick={deleteSelected}>Delete obstacle</button>
                </>
              )}
              {mode === 'area' && (
                <button type="button" className="btn-secondary" onClick={() => setArea(defaultArea(ss.ridgeLen, ss.slopeLen))}>Reset area</button>
              )}
            </div>
            <p className="hint">{hint}</p>
          </div>
          <div className="scene-view">
            <RoofScene tilt={input.roof_tilt} roof={roof} calib={calib} mode={mode} snap={snap} panels={panels} obstacles={obstacles} area={area} margin={margin}
              selected={selected} selectedObstacle={selOb} onPanels={setPanels} onObstacles={setObstacles} onArea={setArea}
              onSelect={setSelected} onSelectObstacle={setSelOb} />
          </div>
          <p className="scene-note">
            {panels.length} panels in {runs.length} runs. Usable area {(area.u1 - area.u0).toFixed(2)} × {(area.v1 - area.v0).toFixed(2)} m.{calib ? ` Roof ${calib.width.toFixed(1)} × ${calib.depth.toFixed(1)} m (top-down${roof.type === 'gable' ? ' footprint' : ''}).` : ''}
          </p>
        </section>
        <ResultsPanel {...calc} />
      </main>
      {calibrating && photoUrl && (
        <RoofCalibration photoUrl={photoUrl} tilt={input.roof_tilt} roof={roof}
          onApply={() => { pendingFill.current = true; }}
          onDone={(c) => {
            const ridge = c.width >= c.depth ? '12' : '23';
            setCalib(c); setRoof((r) => ({ ...r, ridge }));
            if (pendingFill.current) { const n = slopeSize(roof.type, ridge, input.roof_tilt, c); setArea(defaultArea(n.ridgeLen, n.slopeLen)); }
            setCalibrating(false);
          }}
          onCancel={() => { if (pendingFill.current) { pendingFill.current = false; fill(); } setCalibrating(false); }} />
      )}
    </div>
  );
}
