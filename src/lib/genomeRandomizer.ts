/**
 * Genome Randomizer — "Surprise Me" button
 *
 * Combines parameters aesthetically using curated gene pools.
 * Unlike pure random, this guarantees visually pleasing results by:
 * 1. Choosing from curated color palettes
 * 2. Balancing opposing effects (e.g., high bloom + low grain)
 * 3. Respecting perceptual constraints (e.g., dark bg + bright chars)
 *
 * Inspired by lumenshaders' genome synthesizer.
 */

import type { AsciiOptions, RenderMode, ColorPalette, BlendMode, AnimPreset, ShapeMask } from './asciiConverter';
import type { CharsetKey } from './charsets';

/* ─── Gene Pools ──────────────────────────────────────────────── */

interface ColorScheme {
  bg: string;
  fg: string;
  name: string;
}

const COLOR_SCHEMES: ColorScheme[] = [
  { bg: '#000000', fg: '#00ff88', name: 'matrix' },
  { bg: '#05010d', fg: '#00fff5', name: 'cyber' },
  { bg: '#0a0014', fg: '#ff2bd6', name: 'synthwave' },
  { bg: '#0d1117', fg: '#58a6ff', name: 'github-dark' },
  { bg: '#1a1a2e', fg: '#e94560', name: 'crimson' },
  { bg: '#000000', fg: '#ffd700', name: 'gold' },
  { bg: '#0f0f23', fg: '#cccccc', name: 'advent' },
  { bg: '#1e1e1e', fg: '#d4d4d4', name: 'vscode' },
  { bg: '#0a0a0a', fg: '#39ff14', name: 'phosphor' },
  { bg: '#0d0221', fg: '#ff6ec7', name: 'neon-pink' },
  { bg: '#000814', fg: '#ffc300', name: 'amber' },
  { bg: '#10002b', fg: '#c77dff', name: 'purple-haze' },
  { bg: '#03071e', fg: '#ffba08', name: 'firelight' },
  { bg: '#0b090a', fg: '#b5179e', name: 'magenta' },
  { bg: '#001219', fg: '#94d2bd', name: 'ocean' },
  { bg: '#0f0e17', fg: '#ff8906', name: 'warmth' },
];

const RENDER_MODES: RenderMode[] = [
  'text', 'filled_circle', 'filled_square', 'triangle',
  'diamond', 'cross', 'hexagon', 'pixel', 'lego', 'mosaic',
  'wave', 'outline', 'mixed', 'halftone',
];

const CHARSETS_POOL: CharsetKey[] = [
  'standard', 'detailed', 'ascii_magic', 'dense', 'blocks',
  'shades', 'braille', 'dots', 'lines', 'matrix',
  'cyberpunk', 'minimal', 'binary', 'runic',
];

const FX_COMBOS = [
  // Minimal — clean look
  { bloom: false, chromatic: false, scanlines: false, vignette: true, grain: false, glitch: false, crt: false },
  // Neon — bloom + chromatic
  { bloom: true, chromatic: true, scanlines: false, vignette: true, grain: false, glitch: false, crt: false },
  // Retro — scanlines + CRT
  { bloom: false, chromatic: false, scanlines: true, vignette: true, grain: false, glitch: false, crt: true },
  // Film — grain + vignette
  { bloom: true, chromatic: false, scanlines: false, vignette: true, grain: true, glitch: false, crt: false },
  // Cyberpunk — everything
  { bloom: true, chromatic: true, scanlines: true, vignette: true, grain: false, glitch: false, crt: false },
  // Glitch — intentionally broken
  { bloom: false, chromatic: true, scanlines: false, vignette: false, grain: false, glitch: true, crt: false },
  // Clean — nothing
  { bloom: false, chromatic: false, scanlines: false, vignette: false, grain: false, glitch: false, crt: false },
  // Dreamy — bloom heavy
  { bloom: true, chromatic: false, scanlines: false, vignette: true, grain: true, glitch: false, crt: false },
];

/* ─── Utility ─────────────────────────────────────────────────── */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randf(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/* ─── Genome Generator ────────────────────────────────────────── */

/**
 * Generate a random but aesthetically pleasing set of options.
 * Preserves width/fontSize from current options (user's viewport preference).
 */
export function randomizeGenome(current: AsciiOptions): AsciiOptions {
  const scheme = pick(COLOR_SCHEMES);
  const fx = pick(FX_COMBOS);
  const renderMode = pick(RENDER_MODES);
  const charset = pick(CHARSETS_POOL);

  // Decide color vs mono (80% color, 20% mono)
  const useColor = Math.random() > 0.2;

  // Brightness/contrast balance
  const brightness = rand(-15, 15);
  const contrast = rand(5, 45);
  const saturation = useColor ? rand(-10, 70) : -100;
  const colorEnhance = useColor ? rand(10, 70) : 0;

  // Density and coverage
  const density = randf(0.7, 1.5);
  const coverage = rand(75, 98);

  // Char glow (stronger for dark backgrounds)
  const charGlow = fx.bloom ? rand(30, 80) : rand(0, 40);
  const charBrightness = rand(100, 200);

  // Background mode
  const bgModes: AsciiOptions['bgMode'][] = ['solid', 'blurred', 'solid', 'solid'];
  const bgMode = pick(bgModes);

  return {
    ...current, // preserve width, fontSize, exportScale, watermark, etc.
    charset,
    customRamp: current.customRamp,
    invert: Math.random() < 0.15,
    color: useColor,
    brightness,
    contrast,
    saturation,
    colorEnhance,
    blur: Math.random() < 0.2 ? rand(1, 3) : 0,
    edges: Math.random() < 0.2,
    edgeThreshold: rand(40, 80),
    dithering: Math.random() < 0.25,
    density,
    bgColor: scheme.bg,
    fgColor: scheme.fg,
    renderMode,
    blendMode: pick(['normal', 'normal', 'normal', 'screen'] as BlendMode[]),
    bgMode,
    bgBlur: bgMode === 'blurred' ? rand(4, 16) : 6,
    bgOpacity: bgMode === 'blurred' ? rand(15, 40) : 25,
    charOpacity: 100,
    coverage,
    charGlow,
    charBrightness,
    colorPalette: pick(['original', 'original', 'warm', 'cool', 'cyberpunk', 'neon'] as ColorPalette[]),
    gradientMap: Math.random() < 0.1,
    gradientStart: current.gradientStart,
    gradientEnd: current.gradientEnd,
    aspectRatio: current.aspectRatio,
    animatedAscii: Math.random() < 0.3,
    animSpeed: rand(2, 6),
    // FX
    fx_bloom: fx.bloom,
    fx_bloom_intensity: fx.bloom ? rand(25, 60) : 35,
    fx_chromatic: fx.chromatic,
    fx_chromatic_px: fx.chromatic ? rand(1, 4) : 2,
    fx_scanlines: fx.scanlines,
    fx_scanlines_intensity: fx.scanlines ? rand(20, 50) : 40,
    fx_vignette: fx.vignette,
    fx_vignette_intensity: fx.vignette ? rand(20, 50) : 30,
    fx_glitch: fx.glitch,
    fx_glitch_intensity: fx.glitch ? rand(20, 50) : 30,
    fx_grain: fx.grain,
    fx_grain_intensity: fx.grain ? rand(15, 40) : 25,
    fx_crt: fx.crt,
    fx_crt_intensity: fx.crt ? rand(25, 50) : 40,
    // Keep lights/masks simple
    pointLightsEnabled: false,
    animPreset: Math.random() < 0.3 ? pick(['wave', 'pulse', 'cascade'] as AnimPreset[]) : 'none',
    animPresetSpeed: rand(3, 7),
    shapeMask: Math.random() < 0.1 ? pick(['circle', 'heart', 'star'] as ShapeMask[]) : 'none',
    discoMode: Math.random() < 0.08,
    discoSpeed: rand(2, 5),
  };
}
