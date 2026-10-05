import type { CropRect, Transform } from '../../engine/types';
import type { SourceMeta } from '../../state/store';
import { updateDoc } from '../../state/store';

type P = { x: number; y: number };

/** Output (top-left normalized, full image) -> source normalized. Mirrors srcUV() in GLSL. */
export function outToSrc(q: P, t: Transform): P {
  let { x, y } = q;
  if (t.flipX) x = 1 - x;
  if (t.flipY) y = 1 - y;
  if (t.rotate === 90) return { x: y, y: 1 - x };
  if (t.rotate === 180) return { x: 1 - x, y: 1 - y };
  if (t.rotate === 270) return { x: 1 - y, y: x };
  return { x, y };
}

export function srcToOut(s: P, t: Transform): P {
  let x = s.x, y = s.y;
  if (t.rotate === 90) [x, y] = [1 - y, x];
  else if (t.rotate === 180) [x, y] = [1 - x, 1 - y];
  else if (t.rotate === 270) [x, y] = [y, 1 - x];
  if (t.flipX) x = 1 - x;
  if (t.flipY) y = 1 - y;
  return { x, y };
}

export function rectOutToSrc(r: CropRect, t: Transform): CropRect {
  const a = outToSrc({ x: r.x, y: r.y }, t);
  const b = outToSrc({ x: r.x + r.w, y: r.y + r.h }, t);
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

export function rectSrcToOut(r: CropRect, t: Transform): CropRect {
  const a = srcToOut({ x: r.x, y: r.y }, t);
  const b = srcToOut({ x: r.x + r.w, y: r.y + r.h }, t);
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function outputAspect(src: SourceMeta | null, crop: CropRect | null, t: Transform, ignoreCrop = false) {
  if (!src) return 16 / 9;
  const c = ignoreCrop || !crop ? { w: 1, h: 1 } : crop;
  let a = (src.width * c.w) / Math.max(1, src.height * c.h);
  if (t.rotate === 90 || t.rotate === 270) a = 1 / a;
  return a;
}


export function rotateCrop(dir: 1 | -1) {
  updateDoc((d) => ({ ...d, transform: { ...d.transform, rotate: (((d.transform.rotate + dir * 90) % 360) + 360) % 360 as Transform['rotate'] } }));
}
