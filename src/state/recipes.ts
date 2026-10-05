// Recipes: shareable codes for a look + curated presets.
import type { Look, ParamValue } from '../engine/types';
import { defaultParams, getStyle, makeLayer } from '../engine/styles';
import { defaultLook, normalizeLook } from './defaults';
import { CHARSETS } from '../engine/palettes';

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Keep only values that differ from the defaults (short, stable codes). */
function diff(def: unknown, val: unknown): unknown {
  if (val && typeof val === 'object' && !Array.isArray(val) && def && typeof def === 'object' && !Array.isArray(def)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(val as object)) {
      const d = diff((def as Record<string, unknown>)[k], (val as Record<string, unknown>)[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return JSON.stringify(def) === JSON.stringify(val) ? undefined : val;
}

function serializable(look: Look) {
  const base = defaultLook();
  const out: Record<string, unknown> = {
    layers: look.layers.map((l) => {
      const st = getStyle(l.styleId);
      const p = diff(defaultParams(st), l.params);
      const o: Record<string, unknown> = { styleId: l.styleId };
      if (p) o.params = p;
      if (!l.enabled) o.enabled = false;
      if (l.opacity !== 100) o.opacity = l.opacity;
      if (l.blend !== 'normal') o.blend = l.blend;
      return o;
    }),
  };
  for (const k of ['color', 'blur', 'post', 'lights', 'animation', 'depth', 'mask'] as const) {
    const d = diff(base[k], look[k]);
    if (d) out[k] = d;
  }
  return out;
}

export async function encodeRecipe(look: Look): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(serializable(look)));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + toB64Url(await pipe(json, new CompressionStream('deflate-raw')));
    } catch {
      /* fall through */
    }
  }
  return 'j' + toB64Url(json);
}

export async function decodeRecipe(code: string): Promise<Look | null> {
  try {
    code = code.trim();
    const m = /[#&?]r=([A-Za-z0-9_-]+)/.exec(code);
    if (m) code = m[1];
    const kind = code[0];
    let bytes = fromB64Url(code.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return normalizeLook(obj);
  } catch {
    return null;
  }
}

export function recipeUrl(code: string): string {
  return `${location.origin}${location.pathname}#r=${code}`;
}

export function recipeFromHash(): string | null {
  const m = /[#&]r=([A-Za-z0-9_-]+)/.exec(location.hash);
  return m ? m[1] : null;
}

/* ───────── Curated recipes ───────── */

export interface CuratedRecipe {
  id: string;
  name: string;
  tags: string;
  build: () => Look;
}

function look(styleId: string, params: Record<string, ParamValue> = {}, mut?: (l: Look) => void): Look {
  const l = defaultLook(styleId);
  l.layers = [makeLayer(styleId, { ...l.layers[0].params, ...params })];
  mut?.(l);
  return l;
}

const kata = CHARSETS.findIndex((c) => c.label === 'Katakana');

export const CURATED: CuratedRecipe[] = [
  {
    id: 'matrix', name: 'Matrix Rain', tags: 'Animated · Green',
    build: () => look('characters', { charset: kata, chars: CHARSETS[kata].ramp, colorMode: 3, gradient: 18, bdMode: 1, bdColor: '#000000', fontSize: 12 }, (l) => {
      l.animation = { ...l.animation, animated: true, matrix: true, matrixDir: 2, shimmer: 40 };
      l.post.bloom = { ...l.post.bloom, on: true, amount: 45 };
    }),
  },
  {
    id: 'terminal', name: 'Terminal', tags: 'Mono · Retro',
    build: () => look('ascii-studio', { colorMode: 3, gradient: 18, fontSize: 10, cellFill: 0 }, (l) => {
      l.post.scanlines = { ...l.post.scanlines, on: true, amount: 35 };
      l.post.crt = { ...l.post.crt, on: true, amount: 40 };
      l.post.glow = { ...l.post.glow, on: true, amount: 35 };
    }),
  },
  {
    id: 'newsprint', name: 'Newsprint', tags: 'Print · Mono',
    build: () => look('halftone', { mode: 0, size: 7, ink: '#1b1b1b', paperC: '#efe9da' }, (l) => { l.post.grain = { ...l.post.grain, on: true, amount: 20 }; }),
  },
  { id: 'gameboy', name: 'Game Boy', tags: 'Pixel · Retro', build: () => look('pixel-art', { palette: 4, pixelSize: 6, dither: 50 }) },
  { id: 'riso', name: 'Riso Zine', tags: 'Print · Color', build: () => look('risograph', { ink1: '#ff48b0', ink2: '#00a95c', size: 4 }) },
  {
    id: 'hacker', name: 'Hacker CRT', tags: 'ASCII · Glow',
    build: () => look('characters', { colorMode: 2, ink: '#39ff88', bdMode: 1, bdColor: '#020604', fontSize: 9 }, (l) => {
      l.post.crt = { ...l.post.crt, on: true, amount: 55 };
      l.post.scanlines = { ...l.post.scanlines, on: true, amount: 40 };
      l.post.bloom = { ...l.post.bloom, on: true, amount: 40, threshold: 40 };
    }),
  },
  {
    id: 'neon', name: 'Neon Edges', tags: 'Light · Glow',
    build: () => look('edge-glow', { colorMode: 1, dim: 92 }, (l) => { l.post.bloom = { ...l.post.bloom, on: true, amount: 70, threshold: 30 }; }),
  },
  { id: 'blueprint', name: 'Blueprint', tags: 'Geometric · Minimal', build: () => look('schematic') },
  {
    id: 'vhs', name: 'VHS Tape', tags: 'Glitch · Retro',
    build: () => look('lofi', { downsample: 2, chroma: 4, colors: 6 }, (l) => {
      l.post.rgbSplit = { ...l.post.rgbSplit, on: true, amount: 3 };
      l.post.scanlines = { ...l.post.scanlines, on: true, amount: 30 };
      l.post.glitch = { ...l.post.glitch, on: true, amount: 15 };
      l.animation = { ...l.animation, animated: true };
    }),
  },
  { id: 'stained', name: 'Cathedral', tags: 'Glass · Color', build: () => look('vitrine', { size: 38 }) },
  { id: 'predator', name: 'Predator', tags: 'Thermal · Color', build: () => look('thermal', { thermal: 2 }) },
  { id: 'graphite', name: 'Graphite', tags: 'Sketch · Mono', build: () => look('sketch') },
  {
    id: 'disco', name: 'Disco Night', tags: 'Animated · Color',
    build: () => look('disco', {}, (l) => { l.post.bloom = { ...l.post.bloom, on: true, amount: 55, threshold: 35 }; l.animation = { ...l.animation, animated: true }; }),
  },
  { id: 'gold', name: 'Golden Idol', tags: 'Material · Metal', build: () => look('molten-metal') },
  { id: 'cmyk', name: 'Offset Print', tags: 'Print · Color', build: () => look('cmyk-drops') },
  {
    id: 'braille-noir', name: 'Braille Noir', tags: 'ASCII · Mono',
    build: () => look('braille', { colorMode: 2, ink: '#f5f5f5', size: 8 }, (l) => { l.post.vignette = { ...l.post.vignette, on: true, amount: 60 }; }),
  },
  {
    id: 'dream', name: 'Dreamcore', tags: 'Light · Pastel',
    build: () => look('dreamdust', {}, (l) => { l.animation = { ...l.animation, animated: true }; l.color = { ...l.color, saturation: 80 }; }),
  },
  { id: 'lego-pop', name: 'Brick Pop', tags: 'Pixel · Color', build: () => look('lego', { size: 14 }) },
];
