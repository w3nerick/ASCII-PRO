// Paintable mask: alpha = where the effect is visible. Fixed resolution with the output aspect.
import { bumpMask, setMaskCanvas } from './renderer';

let canvas: HTMLCanvasElement | null = null;
let aspect = 0;
const LONG = 1400;

export function getMask(outAspect: number): HTMLCanvasElement {
  if (!canvas || Math.abs(aspect - outAspect) > 0.002) {
    const prev = canvas;
    canvas = document.createElement('canvas');
    canvas.width = outAspect >= 1 ? LONG : Math.max(1, Math.round(LONG * outAspect));
    canvas.height = outAspect >= 1 ? Math.max(1, Math.round(LONG / outAspect)) : LONG;
    if (prev) canvas.getContext('2d')!.drawImage(prev, 0, 0, canvas.width, canvas.height);
    aspect = outAspect;
    setMaskCanvas(canvas);
  }
  return canvas;
}

export function maskCanvas() {
  return canvas;
}

export function fillMask() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  bumpMask();
}

export function clearMask() {
  if (!canvas) return;
  canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  bumpMask();
}

/** Stroke from (x0,y0) to (x1,y1) in normalized coords. radius in mask px. */
export function paintStroke(x0: number, y0: number, x1: number, y1: number, radius: number, erase: boolean) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  const dist = Math.hypot((x1 - x0) * w, (y1 - y0) * h);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (x0 + (x1 - x0) * t) * w;
    const y = (y0 + (y1 - y0) * t) * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  bumpMask();
}

export function paintShape(kind: 'rect' | 'ellipse', x0: number, y0: number, x1: number, y1: number, erase = false) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const x = Math.min(x0, x1) * w, y = Math.min(y0, y1) * h;
  const rw = Math.abs(x1 - x0) * w, rh = Math.abs(y1 - y0) * h;
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  if (kind === 'rect') ctx.rect(x, y, rw, rh);
  else ctx.ellipse(x + rw / 2, y + rh / 2, Math.max(0.5, rw / 2), Math.max(0.5, rh / 2), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  bumpMask();
}
