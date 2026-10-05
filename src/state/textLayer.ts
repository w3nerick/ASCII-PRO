import type { TextItem } from '../engine/types';

export const TEXT_FONTS = [
  { label: 'Geist', css: '"Geist", -apple-system, "Segoe UI", sans-serif' },
  { label: 'Geist Mono', css: '"Geist Mono", ui-monospace, Menlo, monospace' },
  { label: 'Geist Pixel', css: '"Geist Pixel", "Geist Mono", monospace' },
  { label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { label: 'Impact', css: 'Impact, "Arial Black", "Helvetica Neue", sans-serif' },
];

let canvas: HTMLCanvasElement | null = null;

/** Draw all text items into a transparent canvas of the output size. */
export function renderTextLayer(texts: TextItem[], w: number, h: number): HTMLCanvasElement {
  if (!canvas) canvas = document.createElement('canvas');
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  for (const t of texts) drawText(ctx, t, w, h);
  return canvas;
}

export function textFont(t: TextItem, h: number) {
  const f = TEXT_FONTS[t.font] || TEXT_FONTS[0];
  return `${t.weight} ${Math.max(4, t.size * h)}px ${f.css}`;
}

export function drawText(ctx: CanvasRenderingContext2D, t: TextItem, w: number, h: number) {
  const px = Math.max(4, t.size * h);
  ctx.save();
  ctx.globalAlpha = t.opacity / 100;
  ctx.fillStyle = t.color;
  ctx.font = textFont(t, h);
  ctx.textAlign = t.align;
  ctx.textBaseline = 'middle';
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${t.letterSpacing * px * 0.01}px`;
  } catch {
    /* not supported */
  }
  const lines = t.text.split('\n');
  const lh = px * 1.12;
  const y0 = t.y * h - ((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => ctx.fillText(line, t.x * w, y0 + i * lh));
  ctx.restore();
}

let tid = 0;
export function newText(partial: Partial<TextItem> = {}): TextItem {
  tid += 1;
  return {
    id: `t${Date.now().toString(36)}${tid}`,
    text: 'Your text',
    x: 0.5,
    y: 0.5,
    size: 0.09,
    color: '#ffffff',
    font: 0,
    weight: 700,
    align: 'center',
    opacity: 100,
    letterSpacing: 0,
    ...partial,
  };
}
