import { Suspense, useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three';
import { Canvas } from '@react-three/fiber';
import { Bounds, Grid, OrbitControls, useBounds, useTexture } from '@react-three/drei';
import { degToRad } from '../lib/geometry';
import { buildHouse, gableDims, slopeSize, WALL_HEIGHT_M, type RoofShape } from '../lib/gable';
import SlopeEditor, { type EditorProps } from './SlopeEditor';
import type { SceneTheme } from '../theme';
import { sceneTheme } from '../theme';
import type { RoofCalib } from './RoofCalibration';

type EditProps = Omit<EditorProps, 'ridgeLen' | 'slopeLen'>;
interface Props extends EditProps { tilt: number; roof: RoofShape; calib: RoofCalib | null }

/** Rectified photo; image top (corner 1→2) = ridge (+z), image left = +x seen from the eave camera. */
function PhotoRoof({ url, size }: { url: string; size: [number, number] }) {
  const tex = useTexture(url);
  return (
    <mesh rotation={[-Math.PI / 2, 0, Math.PI]} position={[0, 0.003, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} />
    </mesh>
  );
}

/** Refit camera whenever the framed content changes. */
function Refit({ deps }: { deps: unknown[] }) {
  const api = useBounds();
  useEffect(() => { api.refresh().clip().fit(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const geom = (pos: number[], uv?: number[]) => {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  if (uv) g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.computeVertexNormals();
  return g;
};

function PlainSurface({ g, color }: { g: BufferGeometry; color: string }) {
  return <mesh geometry={g} castShadow receiveShadow><meshStandardMaterial color={color} side={DoubleSide} roughness={0.9} /></mesh>;
}

function PhotoSurface({ g, url }: { g: BufferGeometry; url: string }) {
  const tex = useTexture(url);
  return <mesh geometry={g} castShadow receiveShadow><meshStandardMaterial map={tex} side={DoubleSide} roughness={0.9} /></mesh>;
}

interface GableProps { W: number; D: number; tilt: number; roof: RoofShape; url?: string; theme: SceneTheme; edit: EditorProps }

function GableHouse({ W, D, tilt, roof, url, theme, edit }: GableProps) {
  const house = useMemo(() => buildHouse(W, D, roof.ridge, tilt), [W, D, roof.ridge, tilt]);
  const roofG = useMemo(() => geom(house.roof.position, house.roof.uv), [house]);
  const wallG = useMemo(() => geom(house.walls), [house]);
  const { half } = gableDims(W, D, roof.ridge, tilt);
  return (
    <group>
      {url ? <Suspense fallback={<PlainSurface g={roofG} color={theme.roof} />}><PhotoSurface g={roofG} url={url} /></Suspense>
        : <PlainSurface g={roofG} color={theme.roof} />}
      <mesh geometry={wallG} castShadow receiveShadow>
        <meshStandardMaterial color={theme.wall} side={DoubleSide} roughness={0.95} />
      </mesh>
      {/* House frame: a along ridge (x), b across (z). Side A = +b, side B = -b. */}
      <group rotation={[0, roof.ridge === '23' ? Math.PI / 2 : 0, 0]}>
        <group rotation={[0, roof.side === 'A' ? Math.PI : 0, 0]}>
          <group position={[0, WALL_HEIGHT_M, -half]} rotation={[-degToRad(tilt), 0, 0]}>
            <SlopeEditor {...edit} theme={theme} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Compass({ r, y, color }: { r: number; y: number; color: string }) {
  return (
    <group position={[0, y + 0.01, -r]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <coneGeometry args={[r * 0.08, r * 0.25, 3]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export default function RoofScene({ tilt, roof, calib, ...rest }: Props) {
  const theme = useMemo(() => sceneTheme(), []);
  const gable = roof.type === 'gable';
  const ss = slopeSize(roof.type, roof.ridge, tilt, calib);
  const foot = ss.foot;
  const size: [number, number] = [ss.ridgeLen, ss.slopeLen];
  const edit: EditorProps = { ...rest, ridgeLen: ss.ridgeLen, slopeLen: ss.slopeLen };
  const gd = gableDims(foot[0], foot[1], roof.ridge, tilt);
  const span = gable ? Math.max(foot[0], foot[1], WALL_HEIGHT_M + gd.rise) : Math.max(size[0], size[1]);
  const groundY = gable ? 0 : -(size[1] / 2) * Math.sin(degToRad(tilt)) - 0.05;

  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [span * 0.7, span * 1.3, span * 1.0], fov: 40 }}>
      <color attach="background" args={[theme.background]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={[theme.background, theme.ground, 0.8]} />
      <directionalLight position={[span * 0.6, span * 1.5, -span]} intensity={1.8} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
      <Bounds fit clip observe margin={1.15}>
        <Refit deps={[size[0], size[1], tilt, calib?.textureUrl, roof.type, roof.ridge, roof.side]} />
        <group rotation={[0, -degToRad(roof.azimuth), 0]}>
          {gable ? <GableHouse W={foot[0]} D={foot[1]} tilt={tilt} roof={roof} url={calib?.textureUrl} theme={theme} edit={edit} /> : (
            /* Roof group: local roof coordinates (y = roof normal, +z up-slope). */
            <group rotation={[-degToRad(tilt), 0, 0]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={size} />
                <meshStandardMaterial color={theme.roof} roughness={0.9} />
              </mesh>
              {calib && <Suspense fallback={null}><PhotoRoof url={calib.textureUrl} size={size} /></Suspense>}
              <group position={[0, 0, -size[1] / 2]}><SlopeEditor {...edit} theme={theme} /></group>
            </group>
          )}
        </group>
      </Bounds>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY - 0.01, 0]} receiveShadow>
        <planeGeometry args={[span * 6, span * 6]} />
        <meshStandardMaterial color={theme.ground} />
      </mesh>
      <Grid position={[0, groundY, 0]} args={[span * 6, span * 6]} cellSize={1} sectionSize={5} cellColor={theme.grid} sectionColor={theme.grid}
        cellThickness={0.6} sectionThickness={1} fadeDistance={span * 4} infiniteGrid={false} />
      <Compass r={span * 1.2} y={groundY} color={theme.compass} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} enableDamping />
    </Canvas>
  );
}
