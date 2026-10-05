import type { ParamDef } from '../types';
import { CHARSET_OPTIONS, CHARSET_RAMPS, GRADIENT_OPTIONS, PALETTE_CUSTOM, PALETTE_OPTIONS } from '../palettes';
import { GLYPH_FONTS } from '../glyphAtlas';

export const BACKDROP: ParamDef[] = [
  {
    key: 'bdMode', label: 'Mode', type: 'select', section: 'Backdrop', noUniform: true,
    options: [
      { label: 'Blurred Image', value: 0 },
      { label: 'Solid Color', value: 1 },
      { label: 'Original Image', value: 2 },
      { label: 'None (Transparent)', value: 3 },
    ],
    default: 0,
  },
  { key: 'bdSoftness', label: 'Softness', type: 'range', min: 0, max: 40, default: 8, unit: 'px', section: 'Backdrop', showIf: { bdMode: [0] }, noUniform: true },
  { key: 'bdOpacity', label: 'Opacity', type: 'range', min: 0, max: 100, default: 100, unit: '%', section: 'Backdrop', showIf: { bdMode: [0, 2] }, noUniform: true },
  { key: 'bdColor', label: 'Color', type: 'color', default: '#000000', section: 'Backdrop', showIf: { bdMode: [1] }, noUniform: true },
];

export function backdrop(mode = 0, softness = 8, opacity = 100, color = '#000000'): ParamDef[] {
  return BACKDROP.map((p) => {
    if (p.key === 'bdMode') return { ...p, default: mode } as ParamDef;
    if (p.key === 'bdSoftness') return { ...p, default: softness } as ParamDef;
    if (p.key === 'bdOpacity') return { ...p, default: opacity } as ParamDef;
    if (p.key === 'bdColor') return { ...p, default: color } as ParamDef;
    return p;
  });
}

export function charsetParams(charset = 0, fontSize = 11): ParamDef[] {
  return [
    { key: 'fontSize', label: 'Font Size', type: 'range', min: 4, max: 64, step: 1, default: fontSize },
    {
      key: 'charset', label: 'Character Set', type: 'select', options: CHARSET_OPTIONS, default: charset,
      sets: { chars: CHARSET_RAMPS },
    },
    { key: 'chars', label: 'Chars', type: 'text', default: CHARSET_RAMPS[charset], atlas: true },
    { key: 'font', label: 'Font', type: 'select', options: GLYPH_FONTS.map((f, i) => ({ label: f.label, value: i })), default: 0, noUniform: true },
  ];
}

export function inkParams(mode = 0, ink = '#ffffff', gradient = 2, section?: string): ParamDef[] {
  return [
    {
      key: 'colorMode', label: 'Color', type: 'select', section,
      options: [
        { label: 'Image', value: 0 },
        { label: 'Image (Bright)', value: 1 },
        { label: 'Mono', value: 2 },
        { label: 'Gradient', value: 3 },
      ],
      default: mode,
    },
    { key: 'ink', label: 'Ink', type: 'color', default: ink, section, showIf: { colorMode: [2] } },
    { key: 'gradient', label: 'Gradient', type: 'select', options: GRADIENT_OPTIONS, default: gradient, section, showIf: { colorMode: [3] }, noUniform: true },
  ];
}

export const INK_FN = /* glsl */ `
vec3 inkColor(vec3 c, float l){
  int m = int(u_colorMode + 0.5);
  if (m == 0) return c;
  if (m == 1) return c / max(max(c.r, max(c.g, c.b)), 0.2);
  if (m == 2) return u_ink;
  return gradMap(l);
}`;

export function paletteParams(def = 3, section?: string): ParamDef[] {
  return [
    { key: 'palette', label: 'Palette', type: 'select', options: PALETTE_OPTIONS, default: def, section, noUniform: true },
    { key: 'c1', label: 'Color 1', type: 'color', default: '#0b0b0e', section, showIf: { palette: [PALETTE_CUSTOM] }, noUniform: true },
    { key: 'c2', label: 'Color 2', type: 'color', default: '#ff3b6b', section, showIf: { palette: [PALETTE_CUSTOM] }, noUniform: true },
    { key: 'c3', label: 'Color 3', type: 'color', default: '#3be0ff', section, showIf: { palette: [PALETTE_CUSTOM] }, noUniform: true },
    { key: 'c4', label: 'Color 4', type: 'color', default: '#f5f1e6', section, showIf: { palette: [PALETTE_CUSTOM] }, noUniform: true },
  ];
}

export const range = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ key, label, type: 'range', min, max, default: def, ...extra }) as ParamDef;
export const toggle = (key: string, label: string, def = false, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ key, label, type: 'toggle', default: def, ...extra }) as ParamDef;
export const color = (key: string, label: string, def: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ key, label, type: 'color', default: def, ...extra }) as ParamDef;
export const select = (key: string, label: string, options: string[], def = 0, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ key, label, type: 'select', options: options.map((l, i) => ({ label: l, value: i })), default: def, ...extra }) as ParamDef;

/** Common "center" params for distortions and lenses. */
export const center = (section?: string): ParamDef[] => [
  range('cx', 'Center X', 0, 100, 50, { unit: '%', section }),
  range('cy', 'Center Y', 0, 100, 50, { unit: '%', section }),
];

/** uv of the center param (cx/cy are 0..100, top-left origin). */
export const CENTER_FN = /* glsl */ `vec2 ctr(){ return vec2(u_cx / 100.0, 1.0 - u_cy / 100.0); }`;
