import type { AnimationSettings, BlurSettings, ColorSettings, DepthSettings, LightsSettings, Look, MaskSettings, PostSettings } from '../engine/types';
import { makeLayer } from '../engine/styles';

export const DEFAULT_COLOR: ColorSettings = {
  filter: 0,
  tint: '#ffffff',
  tintOpacity: 0,
  tintBlend: 0,
  saturation: 100,
  vibrance: 0,
  hue: 0,
  gradientMap: 0,
  grayscale: 0,
  invert: false,
  brightness: 0,
  contrast: 100,
  exposure: 0,
  temperature: 0,
};

export const DEFAULT_BLUR: BlurSettings = {
  type: 0,
  amount: 8,
  angle: 0,
  focus: 50,
  spread: 40,
  centerX: 50,
  centerY: 50,
};

export const DEFAULT_POST: PostSettings = {
  levels: { on: false, inBlack: 0, inWhite: 255, gamma: 100, outBlack: 0, outWhite: 255 },
  curves: { on: false, preset: 0, amount: 100 },
  vignette: { on: false, amount: 50, softness: 50 },
  scanlines: { on: false, amount: 50, density: 3 },
  crt: { on: false, amount: 60 },
  chromatic: { on: false, amount: 40 },
  bloom: { on: false, amount: 50, threshold: 60, radius: 16 },
  glow: { on: false, amount: 40 },
  tint: { on: false, color: '#ff9a3c', amount: 30 },
  grain: { on: false, amount: 30, colour: false },
  glitch: { on: false, amount: 30, slice: 12 },
  rgbSplit: { on: false, amount: 4, angle: 0 },
  pixelate: { on: false, size: 6 },
  halftone: { on: false, size: 8, shape: 0, mono: false },
  ascii: { on: false, size: 10, charset: 0, mono: false },
  sharpen: { on: false, amount: 40 },
  threshold: { on: false, level: 50 },
  noise: { on: false, amount: 20 },
};

export const DEFAULT_LIGHTS: LightsSettings = {
  enabled: false,
  mode: 0,
  radius: 35,
  intensity: 120,
  ambient: 25,
  color: '#fff4e0',
  points: [
    { x: 0.3, y: 0.35, color: '#ffd29a' },
    { x: 0.72, y: 0.6, color: '#9ad7ff' },
  ],
  flicker: false,
};

export const DEFAULT_ANIMATION: AnimationSettings = {
  animated: false,
  speed: 100,
  matrix: false,
  matrixDir: 2,
  matrixSpeed: 100,
  shimmer: 0,
  pulse: false,
};

export const DEFAULT_DEPTH: DepthSettings = { wave: 0, splay: 0, colorSplit: 0, etch: 0 };

export const DEFAULT_MASK: MaskSettings = {
  enabled: false,
  tool: 0,
  brushSize: 60,
  feather: 6,
  invert: false,
  showOverlay: true,
};

export function defaultLook(styleId = 'characters'): Look {
  return {
    layers: [makeLayer(styleId)],
    color: { ...DEFAULT_COLOR },
    blur: { ...DEFAULT_BLUR },
    post: JSON.parse(JSON.stringify(DEFAULT_POST)),
    lights: JSON.parse(JSON.stringify(DEFAULT_LIGHTS)),
    animation: { ...DEFAULT_ANIMATION },
    depth: { ...DEFAULT_DEPTH },
    mask: { ...DEFAULT_MASK },
  };
}

/** Deep-merge a partial look over defaults (for recipes from older versions). */
export function normalizeLook(input: Partial<Look> | null | undefined): Look {
  const base = defaultLook();
  if (!input) return base;
  const merge = <T extends object>(def: T, v: unknown): T => {
    if (!v || typeof v !== 'object') return def;
    const out = { ...def } as Record<string, unknown>;
    for (const k of Object.keys(def)) {
      const dv = (def as Record<string, unknown>)[k];
      const iv = (v as Record<string, unknown>)[k];
      if (iv === undefined) continue;
      if (dv && typeof dv === 'object' && !Array.isArray(dv)) out[k] = merge(dv as object, iv);
      else if (Array.isArray(dv)) out[k] = Array.isArray(iv) ? iv : dv;
      else if (typeof iv === typeof dv) out[k] = iv;
    }
    return out as T;
  };
  return {
    layers: Array.isArray(input.layers) && input.layers.length
      ? input.layers.map((l) => ({ ...makeLayer(l.styleId, l.params), enabled: l.enabled !== false, opacity: typeof l.opacity === 'number' ? l.opacity : 100, blend: l.blend || 'normal' }))
      : base.layers,
    color: merge(base.color, input.color),
    blur: merge(base.blur, input.blur),
    post: merge(base.post, input.post),
    lights: merge(base.lights, input.lights),
    animation: merge(base.animation, input.animation),
    depth: merge(base.depth, input.depth),
    mask: merge(base.mask, input.mask),
  };
}
