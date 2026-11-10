import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { rectify, roofDims, suggestLayout, type Pt } from '../lib/homography';
import { fromRotated, rotatedSize, splitRotation, straightenRotation, toRotated } from '../lib/rotate';
import { gableDims, type RoofShape } from '../lib/gable';
import { MAP_ATTRIBUTION, type MapScale } from '../lib/mapImage';

export interface RoofCalib { textureUrl: string; width: number; depth: number }

interface Props {
  photoUrl: string; tilt: number; roof: RoofShape;
  /** Known ground scale (address search): no meters input, edge length = pixels x m/px. */
  scale?: MapScale | null;
  onDone: (c: RoofCalib) => void; onCancel: () => void;
  onApply: (rows: number, cols: number) => void;
}

const MAX_TEX = 1024;
const LABELS = ['Ridge left', 'Ridge right', 'Eave right', 'Eave left'];
const GABLE_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];

export default function RoofCalibration({ photoUrl, scale, tilt, roof, onDone, onCancel, onApply }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<HTMLImageElement | null>(null);
  const [quarter, setQuarter] = useState(0);
  const [fine, setFine] = useState(0);
  const [straighten, setStraighten] = useState<Pt[] | null>(null);
  /** Corners in ORIGINAL image coordinates, so they survive rotation changes. */
  const [orig, setOrig] = useState<Pt[]>(() => scale?.corners ?? []);
  const [drag, setDrag] = useState<number | null>(null);
  const [meters, setMeters] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const deg = quarter * 90 + fine;

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSrc(img);
    img.src = photoUrl;
  }, [photoUrl]);

  const w0 = src?.naturalWidth ?? 1, h0 = src?.naturalHeight ?? 1;
  const [cw, ch] = rotatedSize(w0, h0, deg).map(Math.round);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !src) return;
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d')!;
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(src, -w0 / 2, -h0 / 2);
  }, [src, deg, cw, ch, w0, h0]);

  const pts = orig.map((p) => toRotated(p, w0, h0, deg));
  const toCanvas = (e: PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * cw, ((e.clientY - r.top) / r.height) * ch];
  };
  const toOrig = (e: PointerEvent) => fromRotated(toCanvas(e), w0, h0, deg);
  const setTotal = (t: number) => { const r = splitRotation(t); setQuarter(r.quarter); setFine(r.fine); };
  const onDown = (e: PointerEvent) => {
    if (drag !== null) return;
    if (straighten) {
      const next = [...straighten, toCanvas(e)];
      if (next.length < 2) { setStraighten(next); return; }
      setTotal(straightenRotation(deg, next[0], next[1]));
      setStraighten(null);
      return;
    }
    if (orig.length < 4) setOrig([...orig, toOrig(e)]);
  };
  const onMove = (e: PointerEvent) => { if (drag !== null) setOrig(orig.map((p, i) => (i === drag ? toOrig(e) : p))); };

  const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // Rotation preserves scale, so m/px holds in the rotated canvas too. Average edges 1→2 and 4→3 like roofDims.
  const edgeM = scale ? (pts.length === 4 ? ((d(pts[0], pts[1]) + d(pts[3], pts[2])) / 2) * scale.mpp : 0) : meters;
  const ready = pts.length === 4 && edgeM > 0;
  const dims = ready ? roofDims(pts, edgeM) : null;
  const gable = dims && roof.type === 'gable' ? gableDims(dims.width, dims.depth, roof.ridge, tilt) : null;
  const fit = dims ? (gable ? suggestLayout(gable.ridgeLen, gable.half, tilt) : suggestLayout(dims.width, dims.depth, tilt)) : null;
  const pct = (p: Pt) => ({ left: `${(p[0] / cw) * 100}%`, top: `${(p[1] / ch) * 100}%` });
  const labels = roof.type === 'gable' ? GABLE_LABELS : LABELS;

  const done = () => {
    if (!dims || !canvasRef.current) return;
    try {
      const k = MAX_TEX / Math.max(1, dims.ratio);
      const w = Math.round(dims.ratio > 1 ? k : MAX_TEX), h = Math.round((dims.ratio > 1 ? k : MAX_TEX) * dims.ratio);
      const c = rectify(canvasRef.current, pts, w, h);
      onDone({ textureUrl: c.toDataURL('image/jpeg', 0.9), width: dims.width, depth: dims.depth });
    } catch (err) { setError(err instanceof Error ? err.message : 'Rectification failed'); }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Roof calibration">
      <div className="modal card">
        <h2>Roof calibration</h2>
        <div className="calib-rotate">
          <button type="button" className="btn-secondary" aria-label="Rotate left 90 degrees" onClick={() => setQuarter((q) => (q + 3) % 4)}>⟲ 90°</button>
          <button type="button" className="btn-secondary" aria-label="Rotate right 90 degrees" onClick={() => setQuarter((q) => (q + 1) % 4)}>⟳ 90°</button>
          <label className="field">
            <span>Fine rotation <output>{fine.toFixed(1)}°</output></span>
            <input type="range" min={-45} max={45} step={0.5} value={fine} onChange={(e) => setFine(+e.target.value)} />
          </label>
          <button type="button" className={straighten ? 'btn-secondary btn-active' : 'btn-secondary'} aria-pressed={!!straighten}
            onClick={() => setStraighten(straighten ? null : [])}>Auto-straighten</button>
        </div>
        <p className="hint">{straighten
          ? `Click 2 points along a roof edge (${straighten.length}/2). That edge becomes horizontal.`
          : `Rotate first, then click the 4 ${roof.type === 'gable' ? 'building footprint' : 'roof'} corners clockwise: ${labels.map((l, i) => `${i + 1} ${l}`).join(', ')}. Drag a marker to adjust.`}</p>
        <div className="calib-stage" onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
          <canvas ref={canvasRef} role="img" aria-label="Uploaded roof" onPointerDown={onDown} />
          {pts.length > 1 && (
            <svg className="calib-lines" viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="none" aria-hidden>
              <polygon points={pts.map((p) => p.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {pts.map((p, i) => (
            <button key={i} type="button" className="calib-marker" style={pct(p)} aria-label={`Corner ${i + 1}`}
              onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(i); }}>{i + 1}</button>
          ))}
        </div>
        {scale && <p className="addr-attrib">{MAP_ATTRIBUTION.join(' · ')}</p>}
        <div className="field-row">
          {scale ? (
            <p className="hint">Known scale (zoom {scale.zoom}, <span className="mono">{scale.mpp.toFixed(3)} m/px</span>){pts.length === 4 ? <>: edge 1→2 <b className="mono">{edgeM.toFixed(2)} m</b></> : null}.{scale.corners ? ' Corners pre-placed from the OpenStreetMap footprint: drag to adjust.' : ''}</p>
          ) : (
            <label className="field">
              <span>Edge 1→2 length (m)</span>
              <input type="number" min={1} step={0.1} value={meters} onChange={(e) => setMeters(+e.target.value)} />
            </label>
          )}
          <button type="button" className="btn-secondary" onClick={() => setOrig([])}>Reset points</button>
          {scale?.corners && <button type="button" className="btn-secondary" onClick={() => setOrig(scale.corners!)}>Footprint corners</button>}
        </div>
        {dims && fit && (
          <div className="calib-result">
            <p>{gable ? 'Footprint' : 'Roof'} width <b className="mono">{dims.width.toFixed(2)} m</b> · depth (top-down) <b className="mono">{dims.depth.toFixed(2)} m</b>{gable && <> · ridge <b className="mono">{gable.ridgeLen.toFixed(2)} m</b></>} · slope length <b className="mono">{fit.slope.toFixed(2)} m</b></p>
            <p className="hint">{gable ? `Gable: each slope = (span / 2) / cos(tilt ${tilt}°); fit uses the selected slope, 0.3 m edge margin.` : `A top-down image gives true width. Slope length = depth / cos(tilt ${tilt}°) is used for row fitting (0.3 m edge margin).`}</p>
            <div className="field-row">
              <p>Fits <b className="mono">{fit.rows} rows × {fit.cols} cols</b></p>
              <button type="button" className="btn-secondary" disabled={fit.rows < 1 || fit.cols < 1} onClick={() => onApply(fit.rows, fit.cols)}>Apply (auto-fill)</button>
            </div>
          </div>
        )}
        {error && <p className="alert alert-danger">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!ready} onClick={done}>Use calibrated photo</button>
        </div>
      </div>
    </div>
  );
}
