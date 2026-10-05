import type { CategoryId, Layer, ParamValue, StyleDef } from '../types';
import { ASCII_STYLES } from './ascii';
import { PIXEL_STYLES } from './pixel';
import { PRINT_STYLES } from './print';
import { GEOMETRIC_STYLES } from './geometric';
import { DISTORT_STYLES, BLUR_STYLES } from './distort';
import { GLITCH_STYLES } from './glitch';
import { LIGHT_STYLES } from './light';
import { GLASS_STYLES } from './glass';
import { MATERIAL_STYLES } from './material';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'ascii', label: 'ASCII & Text' },
  { id: 'pixel', label: 'Pixel & Blocks' },
  { id: 'print', label: 'Print & Paper' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'distort', label: 'Distort' },
  { id: 'blur', label: 'Blur & Focus' },
  { id: 'glitch', label: 'Glitch & Signal' },
  { id: 'light', label: 'Light & Color' },
  { id: 'glass', label: 'Glass' },
  { id: 'material', label: 'Material & Texture' },
];

export const STYLES: StyleDef[] = [
  ...ASCII_STYLES,
  ...PIXEL_STYLES,
  ...PRINT_STYLES,
  ...GEOMETRIC_STYLES,
  ...DISTORT_STYLES,
  ...BLUR_STYLES,
  ...GLITCH_STYLES,
  ...LIGHT_STYLES,
  ...GLASS_STYLES,
  ...MATERIAL_STYLES,
];

const BY_ID = new Map(STYLES.map((s) => [s.id, s]));

export function getStyle(id: string): StyleDef {
  return BY_ID.get(id) || STYLES[0];
}

export function defaultParams(style: StyleDef): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of style.params) out[p.key] = p.default;
  return out;
}

/** Fill missing params (e.g. after loading an old recipe). */
export function normalizeParams(style: StyleDef, params: Record<string, ParamValue>): Record<string, ParamValue> {
  const out = defaultParams(style);
  for (const p of style.params) {
    const v = params[p.key];
    if (v === undefined) continue;
    if (p.type === 'range' && typeof v === 'number') out[p.key] = Math.min(p.max, Math.max(p.min, v));
    else if (p.type === 'select' && typeof v === 'number') out[p.key] = p.options.some((o) => o.value === v) ? v : p.default;
    else if (p.type === 'toggle') out[p.key] = !!v;
    else if ((p.type === 'color' || p.type === 'text') && typeof v === 'string') out[p.key] = v;
  }
  return out;
}

let uid = 0;
export function newLayerId() {
  uid += 1;
  return `l${Date.now().toString(36)}${uid}`;
}

export function makeLayer(styleId: string, params?: Record<string, ParamValue>): Layer {
  const style = getStyle(styleId);
  return {
    id: newLayerId(),
    styleId: style.id,
    params: params ? normalizeParams(style, params) : defaultParams(style),
    enabled: true,
    opacity: 100,
    blend: 'normal',
  };
}

export function stylesIn(cat: CategoryId) {
  return STYLES.filter((s) => s.category === cat);
}

/** Randomize params of a style within sensible bounds (keeps text/atlas params). */
export function randomParams(style: StyleDef, base?: Record<string, ParamValue>, rng = Math.random): Record<string, ParamValue> {
  const out = { ...(base || defaultParams(style)) };
  for (const p of style.params) {
    if (p.noUniform && p.key.startsWith('bd')) continue;
    if (rng() < 0.35) continue; // leave some params alone
    if (p.type === 'range') {
      const span = p.max - p.min;
      const center = typeof out[p.key] === 'number' ? (out[p.key] as number) : p.default;
      let v = center + (rng() - 0.5) * span * 0.6;
      v = Math.min(p.max, Math.max(p.min, v));
      const step = p.step ?? (span > 20 ? 1 : 0.1);
      out[p.key] = Math.round(v / step) * step;
    } else if (p.type === 'select') {
      if (p.sets) continue;
      if (rng() < 0.5) out[p.key] = p.options[Math.floor(rng() * p.options.length)].value;
    } else if (p.type === 'toggle') {
      if (rng() < 0.3) out[p.key] = !out[p.key];
    } else if (p.type === 'color') {
      if (rng() < 0.5) {
        const h = Math.floor(rng() * 360);
        out[p.key] = hslHex(h, 60 + rng() * 35, 35 + rng() * 40);
      }
    }
  }
  return out;
}

function hslHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
