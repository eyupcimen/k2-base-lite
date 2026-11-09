import { useEffect, useMemo, useRef, useState } from 'react';
import { DoubleSide, Plane, Raycaster, Vector2, Vector3, type Group } from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { PANEL_HEIGHT_M, PANEL_THICKNESS_M, PANEL_WIDTH_M, PANEL_Y_M, RAIL_SIZE_M, RAIL_Y_M } from '../constants';
import {
  computeRuns, GRID_M, SNAP_M, grow, isValid, moveAreaEdge, normRect, runRails, snapPanel,
  type Ctx, type Obstacle, type Panel, type Rect,
} from '../lib/layout';
import type { SceneTheme } from '../theme';

export type EditMode = 'panels' | 'obstacles' | 'area';
type UV = { u: number; v: number };
type Edge = 'u0' | 'u1' | 'v0' | 'v1';

export interface EditorProps {
  ridgeLen: number; slopeLen: number; mode: EditMode; snap: boolean;
  panels: Panel[]; obstacles: Obstacle[]; area: Rect; margin: number;
  selected: Set<string>; selectedObstacle: string | null;
  onPanels: (p: Panel[]) => void; onObstacles: (o: Obstacle[]) => void; onArea: (a: Rect) => void;
  onSelect: (ids: Set<string>) => void; onSelectObstacle: (id: string | null) => void;
}

type Drag =
  | { kind: 'panels'; start: UV; orig: Map<string, UV>; primary: string }
  | { kind: 'newObstacle'; start: UV }
  | { kind: 'corner'; id: string; fixed: UV }
  | { kind: 'edge'; edge: Edge };

interface Preview { panels?: Map<string, UV>; valid?: boolean; rect?: Rect; area?: Rect }

const FRAME_M = 0.03;
const OB_H = 0.25;
const HANDLE = 0.18;
const MIN_OB = 0.1;
const Y = { hit: 0.002, dim: 0.004, line: 0.008 };
const snap = (x: number) => Math.round(x / GRID_M) * GRID_M;
const center = (r: Rect): [number, number] => [(r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2];

function Flat({ r, y, color, opacity }: { r: Rect; y: number; color: string; opacity: number }) {
  const [cu, cv] = center(r);
  return (
    <mesh position={[cu, y, cv]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[r.u1 - r.u0, r.v1 - r.v0]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

const outline = (r: Rect, y: number): [number, number, number][] =>
  [[r.u0, y, r.v0], [r.u1, y, r.v0], [r.u1, y, r.v1], [r.u0, y, r.v1], [r.u0, y, r.v0]];

/** Interactive layout on one slope. Local frame: x = u (along ridge), z = v (up-slope from eave), y = roof normal. */
export default function SlopeEditor(props: EditorProps & { theme: SceneTheme }) {
  const { ridgeLen, slopeLen, mode, panels, obstacles, area, margin, selected, selectedObstacle, theme } = props;
  const { camera, gl } = useThree();
  const getThree = useThree((s) => s.get);
  const group = useRef<Group>(null);
  const ray = useMemo(() => new Raycaster(), []);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<Preview>({});
  const previewRef = useRef<Preview>({});
  const live = useRef(props);
  live.current = props;
  const [hover, setHover] = useState<string | null>(null);
  const slope: Rect = useMemo(() => ({ u0: -ridgeLen / 2, u1: ridgeLen / 2, v0: 0, v1: slopeLen }), [ridgeLen, slopeLen]);

  const setPrev = (p: Preview) => { previewRef.current = p; setPreview(p); };

  /** Ray from screen point onto the slope plane, returned in slope-local (u, v). */
  const toLocal = (cx: number, cy: number): UV | null => {
    const g = group.current;
    if (!g) return null;
    const r = gl.domElement.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    g.updateWorldMatrix(true, false);
    const n = new Vector3(0, 1, 0).transformDirection(g.matrixWorld);
    const plane = new Plane().setFromNormalAndCoplanarPoint(n, new Vector3().setFromMatrixPosition(g.matrixWorld));
    const hit = ray.ray.intersectPlane(plane, new Vector3());
    if (!hit) return null;
    g.worldToLocal(hit);
    return { u: hit.x, v: hit.z };
  };

  const setControls = (on: boolean) => { const c = getThree().controls as unknown as { enabled: boolean } | null; if (c) c.enabled = on; };

  const onMove = (ev: PointerEvent) => {
    const d = drag.current, p = toLocal(ev.clientX, ev.clientY);
    if (!d || !p) return;
    const s = live.current;
    const ctx: Ctx = { area: s.area, obstacles: s.obstacles, margin: s.margin };
    if (d.kind === 'panels') {
      const others = s.panels.filter((q) => !d.orig.has(q.id));
      const prim = d.orig.get(d.primary)!;
      const snapped = snapPanel({ u: prim.u + p.u - d.start.u, v: prim.v + p.v - d.start.v }, others, GRID_M, s.snap ? SNAP_M : 0);
      const du = snapped.u - prim.u, dv = snapped.v - prim.v;
      const next = new Map<string, UV>();
      d.orig.forEach((o, id) => next.set(id, { u: +(o.u + du).toFixed(6), v: +(o.v + dv).toFixed(6) }));
      const moved = [...next.values()];
      const valid = moved.every((m, i) => isValid(m, [...others, ...moved.filter((_, j) => j !== i)], ctx));
      setPrev({ panels: next, valid });
    } else if (d.kind === 'newObstacle') {
      setPrev({ rect: normRect({ u0: snap(d.start.u), u1: snap(p.u), v0: snap(d.start.v), v1: snap(p.v) }) });
    } else if (d.kind === 'corner') {
      setPrev({ rect: normRect({ u0: d.fixed.u, u1: snap(p.u), v0: d.fixed.v, v1: snap(p.v) }) });
    } else {
      setPrev({ area: moveAreaEdge(s.area, d.edge, snap(d.edge[0] === 'u' ? p.u : p.v), slope) });
    }
  };

  const onUp = () => {
    const d = drag.current, pv = previewRef.current, s = live.current;
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    setControls(true);
    if (d?.kind === 'panels' && pv.panels && pv.valid) s.onPanels(s.panels.map((q) => (pv.panels!.has(q.id) ? { ...q, ...pv.panels!.get(q.id)! } : q)));
    const big = pv.rect && pv.rect.u1 - pv.rect.u0 >= MIN_OB && pv.rect.v1 - pv.rect.v0 >= MIN_OB;
    if (d?.kind === 'newObstacle' && big) {
      const id = `o${Date.now()}`;
      s.onObstacles([...s.obstacles, { id, ...pv.rect! }]);
      s.onSelectObstacle(id);
    }
    if (d?.kind === 'corner' && big) s.onObstacles(s.obstacles.map((o) => (o.id === d.id ? { ...o, ...pv.rect! } : o)));
    if (d?.kind === 'edge' && pv.area) s.onArea(pv.area);
    setPrev({});
  };

  const begin = (e: ThreeEvent<PointerEvent>, d: Drag) => {
    e.stopPropagation();
    drag.current = d;
    setControls(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  useEffect(() => () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const local = (e: ThreeEvent<PointerEvent>) => toLocal(e.nativeEvent.clientX, e.nativeEvent.clientY);

  const onRoofDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode === 'panels') { if (!e.shiftKey) props.onSelect(new Set()); return; }
    if (mode !== 'obstacles') return;
    const p = local(e);
    if (!p) return;
    props.onSelectObstacle(null);
    begin(e, { kind: 'newObstacle', start: p });
  };

  const onPanelDown = (e: ThreeEvent<PointerEvent>, id: string) => {
    if (mode !== 'panels') return;
    e.stopPropagation();
    const p = local(e);
    let sel = new Set(selected);
    if (e.shiftKey) {
      if (sel.has(id)) { sel.delete(id); props.onSelect(sel); return; }
      sel.add(id);
    } else if (!sel.has(id)) sel = new Set([id]);
    props.onSelect(sel);
    if (!p) return;
    const orig = new Map<string, UV>();
    panels.forEach((q) => { if (sel.has(q.id)) orig.set(q.id, { u: q.u, v: q.v }); });
    begin(e, { kind: 'panels', start: p, orig, primary: id });
  };

  // Displayed state (preview overrides committed).
  const shown = preview.panels ? panels.map((q) => (preview.panels!.has(q.id) ? { ...q, ...preview.panels!.get(q.id)! } : q)) : panels;
  const shownArea = preview.area ?? area;
  const ctx: Ctx = { area: shownArea, obstacles, margin };
  const invalid = useMemo(() => {
    const bad = new Set<string>();
    shown.forEach((q, i) => { if (!isValid(q, shown.filter((_, j) => j !== i), ctx)) bad.add(q.id); });
    return bad;
  }, [shown, shownArea, obstacles, margin]); // eslint-disable-line react-hooks/exhaustive-deps
  const rails = useMemo(() => runRails(computeRuns(shown)), [shown]);
  const dragging = preview.panels;

  const dims: Rect[] = [
    { u0: slope.u0, u1: slope.u1, v0: slope.v0, v1: shownArea.v0 },
    { u0: slope.u0, u1: slope.u1, v0: shownArea.v1, v1: slope.v1 },
    { u0: slope.u0, u1: shownArea.u0, v0: shownArea.v0, v1: shownArea.v1 },
    { u0: shownArea.u1, u1: slope.u1, v0: shownArea.v0, v1: shownArea.v1 },
  ].filter((r) => r.u1 - r.u0 > 1e-3 && r.v1 - r.v0 > 1e-3);

  const edgeHandles: { edge: Edge; pos: [number, number]; size: [number, number] }[] = [
    { edge: 'u0', pos: [shownArea.u0, center(shownArea)[1]], size: [HANDLE, 0.8] },
    { edge: 'u1', pos: [shownArea.u1, center(shownArea)[1]], size: [HANDLE, 0.8] },
    { edge: 'v0', pos: [center(shownArea)[0], shownArea.v0], size: [0.8, HANDLE] },
    { edge: 'v1', pos: [center(shownArea)[0], shownArea.v1], size: [0.8, HANDLE] },
  ];

  const obShown = obstacles.map((o) => (preview.rect && drag.current?.kind === 'corner' && drag.current.id === o.id ? { ...o, ...preview.rect } : o));
  const selOb = mode === 'obstacles' ? obShown.find((o) => o.id === selectedObstacle) : undefined;

  return (
    <group ref={group}>
      {/* Hit plane for clicks on the roof (transparent, still raycast). */}
      <mesh position={[0, Y.hit, slopeLen / 2]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onRoofDown}>
        <planeGeometry args={[ridgeLen, slopeLen]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>

      {dims.map((r, i) => <Flat key={i} r={r} y={Y.dim} color={theme.dim} opacity={0.35} />)}
      <Line points={outline(shownArea, Y.line)} color={theme.brand} lineWidth={2} dashed={mode !== 'area'} dashSize={0.2} gapSize={0.1} />
      {mode === 'area' && edgeHandles.map((h) => (
        <mesh key={h.edge} position={[h.pos[0], 0.05, h.pos[1]]} onPointerDown={(e) => begin(e, { kind: 'edge', edge: h.edge })}>
          <boxGeometry args={[h.size[0], 0.08, h.size[1]]} />
          <meshStandardMaterial color={theme.handle} />
        </mesh>
      ))}

      {obShown.map((o) => {
        const [cu, cv] = center(o);
        const sel = o.id === selectedObstacle;
        return (
          <group key={o.id}>
            {margin > 0 && <Flat r={grow(o, margin)} y={Y.dim + 0.001} color={theme.danger} opacity={0.15} />}
            <mesh position={[cu, OB_H / 2 + 0.01, cv]}
              onPointerDown={mode === 'obstacles' ? (e) => { e.stopPropagation(); props.onSelectObstacle(o.id); } : undefined}>
              <boxGeometry args={[o.u1 - o.u0, OB_H, o.v1 - o.v0]} />
              <meshStandardMaterial color={theme.danger} transparent opacity={sel ? 0.75 : 0.45} />
            </mesh>
          </group>
        );
      })}
      {preview.rect && drag.current?.kind === 'newObstacle' && (
        <mesh position={[center(preview.rect)[0], OB_H / 2 + 0.01, center(preview.rect)[1]]} raycast={() => null}>
          <boxGeometry args={[Math.max(0.01, preview.rect.u1 - preview.rect.u0), OB_H, Math.max(0.01, preview.rect.v1 - preview.rect.v0)]} />
          <meshStandardMaterial color={theme.danger} transparent opacity={0.35} />
        </mesh>
      )}
      {selOb && ([[selOb.u0, selOb.v0, selOb.u1, selOb.v1], [selOb.u1, selOb.v0, selOb.u0, selOb.v1], [selOb.u1, selOb.v1, selOb.u0, selOb.v0], [selOb.u0, selOb.v1, selOb.u1, selOb.v0]] as const).map(([u, v, fu, fv], i) => (
        <mesh key={i} position={[u, OB_H + 0.02, v]} onPointerDown={(e) => begin(e, { kind: 'corner', id: selOb.id, fixed: { u: fu, v: fv } })}>
          <boxGeometry args={[HANDLE, HANDLE, HANDLE]} />
          <meshStandardMaterial color={theme.handle} />
        </mesh>
      ))}

      {rails.map((r) => (
        <mesh key={r.id} position={[r.u, RAIL_Y_M, r.v]} castShadow receiveShadow raycast={() => null}>
          <boxGeometry args={[r.length, RAIL_SIZE_M, RAIL_SIZE_M]} />
          <meshStandardMaterial color={theme.rail} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {shown.map((q) => {
        const moving = dragging?.has(q.id);
        const bad = moving ? preview.valid === false : invalid.has(q.id);
        const cell = bad ? theme.danger : selected.has(q.id) || hover === q.id ? theme.panelHover : theme.panel;
        return (
          <group key={q.id} position={[q.u, PANEL_Y_M + (moving ? 0.03 : 0), q.v]}
            onPointerDown={(e) => onPanelDown(e, q.id)}
            onPointerOver={(e) => { if (mode === 'panels') { e.stopPropagation(); setHover(q.id); } }}
            onPointerOut={() => setHover((h) => (h === q.id ? null : h))}>
            <mesh castShadow>
              <boxGeometry args={[PANEL_WIDTH_M, PANEL_THICKNESS_M, PANEL_HEIGHT_M]} />
              <meshStandardMaterial color={theme.panelFrame} metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, PANEL_THICKNESS_M / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[PANEL_WIDTH_M - 2 * FRAME_M, PANEL_HEIGHT_M - 2 * FRAME_M]} />
              <meshStandardMaterial color={cell} roughness={0.25} metalness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
