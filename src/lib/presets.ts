import type { AsciiOptions } from './asciiConverter';
import { DEFAULT_OPTIONS } from './asciiConverter';

export interface Preset {
  id: string;
  label: string;
  hint: string;
  apply: (base: AsciiOptions) => AsciiOptions;
}

/**
 * One-click looks. Each preset only overrides a handful of options on top of
 * whatever the user currently has so resolution / fontSize aren't blown away.
 */
export const PRESETS: Preset[] = [
  {
    id: 'photo',
    label: 'PHOTO',
    hint: 'Detailed color portrait',
    apply: (b) => ({
      ...b,
      charset: 'detailed',
      color: true,
      invert: false,
      brightness: 0,
      contrast: 10,
      saturation: 20,
      colorEnhance: 30,
      blur: 0,
      edges: false,
      dithering: false,
      density: 1,
      bgColor: '#05010d',
      fgColor: '#00fff5',
    }),
  },
  {
    id: 'sketch',
    label: 'SKETCH',
    hint: 'Edge-detected pencil',
    apply: (b) => ({
      ...b,
      charset: 'minimal',
      color: false,
      invert: true,
      brightness: 10,
      contrast: 30,
      saturation: -100,
      blur: 1,
      edges: true,
      edgeThreshold: 50,
      dithering: false,
      bgColor: '#fafafa',
      fgColor: '#0d0d0d',
    }),
  },
  {
    id: 'matrix',
    label: 'MATRIX',
    hint: 'Green code rain look',
    apply: (b) => ({
      ...b,
      charset: 'matrix',
      color: false,
      invert: false,
      brightness: 0,
      contrast: 20,
      saturation: -100,
      blur: 0,
      edges: false,
      dithering: false,
      bgColor: '#000000',
      fgColor: '#39ff14',
    }),
  },
  {
    id: 'glitch',
    label: 'GLITCH',
    hint: 'High contrast magenta',
    apply: (b) => ({
      ...b,
      charset: 'glitch',
      color: true,
      invert: false,
      brightness: -10,
      contrast: 40,
      saturation: 60,
      blur: 0,
      edges: false,
      dithering: true,
      bgColor: '#0a0014',
      fgColor: '#ff2bd6',
    }),
  },
  {
    id: 'newspaper',
    label: 'NEWSPAPER',
    hint: 'Black & white dithered',
    apply: (b) => ({
      ...b,
      charset: 'standard',
      color: false,
      invert: false,
      brightness: 0,
      contrast: 25,
      saturation: -100,
      blur: 0,
      edges: false,
      dithering: true,
      bgColor: '#f5f1e6',
      fgColor: '#0a0a0a',
    }),
  },
  {
    id: 'blocks',
    label: 'BLOCKS',
    hint: 'Pixel-art shaded blocks',
    apply: (b) => ({
      ...b,
      charset: 'blocks',
      color: true,
      invert: false,
      brightness: 0,
      contrast: 15,
      saturation: 30,
      blur: 0,
      edges: false,
      dithering: false,
      bgColor: '#000000',
      fgColor: '#ffffff',
    }),
  },
];

/** Returns a preset by id, or DEFAULT_OPTIONS as fallback. */
export function applyPreset(id: string, base: AsciiOptions = DEFAULT_OPTIONS): AsciiOptions {
  const p = PRESETS.find((x) => x.id === id);
  return p ? p.apply(base) : base;
}
