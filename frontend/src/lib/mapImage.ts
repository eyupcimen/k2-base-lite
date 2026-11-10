import { footprint } from './api';
import { azimuthFromAngle, latLonToPixel, metersPerPixel, minAreaRect, tileRange, TILE_PX } from './geo';
import type { Pt } from './homography';

export const ESRI_TILE = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
export const MAP_ATTRIBUTION = ['Imagery © Esri, Maxar, Earthstar Geographics', '© OpenStreetMap contributors'];

/** Image with a known ground scale (north-up) and optional pre-placed roof corners. */
export interface MapScale { mpp: number; zoom: number; corners?: Pt[]; azimuth?: number }

const loadTile = (url: string) => new Promise<HTMLImageElement>((ok, fail) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => (img.naturalWidth ? ok(img) : fail(new Error('Empty tile')));
  img.onerror = () => fail(new Error('Tile failed'));
  img.src = url;
});

/** Esri serves a flat grey "Map data not yet available" tile where a zoom level has no imagery. */
function isPlaceholder(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let sum = 0, sq = 0, sat = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] + d[i + 1] + d[i + 2]) / 3;
    sum += g; sq += g * g;
    sat += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  }
  const n = d.length / 4, mean = sum / n, sd = Math.sqrt(sq / n - mean * mean);
  return sd < 12 && sat / n < 6;
}

async function stitch(lat: number, lon: number, z: number) {
  const r = tileRange(lat, lon, z);
  const imgs = await Promise.all(r.tiles.map((t) => loadTile(ESRI_TILE(z, t.x, t.y))));
  if (imgs.filter(isPlaceholder).length > imgs.length / 2) throw new Error(`No imagery at zoom ${z}`);
  const c = document.createElement('canvas');
  c.width = c.height = r.n * TILE_PX;
  const ctx = c.getContext('2d')!;
  r.tiles.forEach((t, i) => ctx.drawImage(imgs[i], t.col * TILE_PX, t.row * TILE_PX));
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not export the satellite image');
  return { url: URL.createObjectURL(blob), origin: r.origin };
}

/** Stitch a 4x4 Esri tile block at the deepest zoom with real imagery (z20 down to z17) and pre-place corners from the OSM footprint. */
export async function loadMapImage(lat: number, lon: number): Promise<{ url: string; scale: MapScale }> {
  let z = 20, img;
  for (;;) {
    try { img = await stitch(lat, lon, z); break; } catch (e) { if (--z < 17) throw e; }
  }
  const scale: MapScale = { mpp: metersPerPixel(lat, z), zoom: z };
  try {
    const poly = await footprint(lat, lon);
    if (poly && poly.length >= 3) {
      const px = poly.map(([a, b]) => { const [x, y] = latLonToPixel(a, b, z); return [x - img.origin[0], y - img.origin[1]] as Pt; });
      const rect = minAreaRect(px);
      scale.corners = rect.corners;
      scale.azimuth = azimuthFromAngle(rect.angle);
    }
  } catch { /* footprint is optional: user places corners manually */ }
  return { url: img.url, scale };
}
