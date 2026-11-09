import type { Pt } from './homography';

const rad = (d: number) => (d * Math.PI) / 180;

/** Bounding size of a w x h image rotated by `deg` (clockwise on screen, y down). */
export function rotatedSize(w: number, h: number, deg: number): [number, number] {
  const c = Math.abs(Math.cos(rad(deg))), s = Math.abs(Math.sin(rad(deg)));
  return [w * c + h * s, w * s + h * c];
}

/** Original-image point -> rotated-canvas point (canvas: translate to centre, ctx.rotate(deg)). */
export function toRotated([x, y]: Pt, w: number, h: number, deg: number): Pt {
  const [cw, ch] = rotatedSize(w, h, deg);
  const a = rad(deg), dx = x - w / 2, dy = y - h / 2;
  return [dx * Math.cos(a) - dy * Math.sin(a) + cw / 2, dx * Math.sin(a) + dy * Math.cos(a) + ch / 2];
}

/** Inverse of toRotated. */
export function fromRotated([x, y]: Pt, w: number, h: number, deg: number): Pt {
  const [cw, ch] = rotatedSize(w, h, deg);
  const a = rad(deg), dx = x - cw / 2, dy = y - ch / 2;
  return [dx * Math.cos(a) + dy * Math.sin(a) + w / 2, -dx * Math.sin(a) + dy * Math.cos(a) + h / 2];
}

/** New total rotation making the screen segment a→b (in the current rotated view) horizontal. */
export function straightenRotation(current: number, a: Pt, b: Pt): number {
  let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  while (ang > 90) ang -= 180;
  while (ang <= -90) ang += 180;
  return current - ang;
}

/** Split a total angle into quarter turns (0..3) and a fine part in [-45, 45]. */
export function splitRotation(total: number): { quarter: number; fine: number } {
  const q = Math.round(total / 90);
  return { quarter: ((q % 4) + 4) % 4, fine: total - 90 * q };
}
