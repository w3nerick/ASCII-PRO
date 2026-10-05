// Core types shared by the render engine, style registry and UI.

export type ParamValue = number | boolean | string;

export interface ParamOption {
  label: string;
  value: number;
}

interface ParamBase {
  key: string;
  label: string;
  /** Visual group heading inside the panel (e.g. "Pattern", "Color"). */
  section?: string;
  /** Hide unless another param matches (key -> allowed values). */
  showIf?: Record<string, (number | boolean | string)[]>;
  /** Engine handles this param itself (no auto-generated uniform). */
  noUniform?: boolean;
}

export interface RangeParam extends ParamBase {
  type: 'range';
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
}

export interface SelectParam extends ParamBase {
  type: 'select';
  options: ParamOption[];
  default: number;
  /** Choosing option i also sets other params: key -> value per option. */
  sets?: Record<string, ParamValue[]>;
}

export interface ToggleParam extends ParamBase {
  type: 'toggle';
  default: boolean;
}

export interface ColorParam extends ParamBase {
  type: 'color';
  default: string; // #rrggbb
}

export interface TextParam extends ParamBase {
  type: 'text';
  default: string;
  /** Used by glyph styles: text becomes the glyph atlas. */
  atlas?: boolean;
}

export type ParamDef = RangeParam | SelectParam | ToggleParam | ColorParam | TextParam;

export type CategoryId =
  | 'ascii'
  | 'pixel'
  | 'print'
  | 'geometric'
  | 'distort'
  | 'blur'
  | 'glitch'
  | 'light'
  | 'glass'
  | 'material';

export interface StyleDef {
  id: string;
  name: string;
  category: CategoryId;
  tags: string[];
  /** Small glyph shown as the style icon in the dock header. */
  icon: string;
  params: ParamDef[];
  /**
   * GLSL body. Must define `vec4 effect(vec2 uv)`.
   * Uniforms for every param are generated automatically as `u_<key>`.
   */
  glsl: string;
  /** Style draws on top of a backdrop (blurred image / black / original / transparent). */
  backdrop?: boolean;
  /** Style samples the glyph atlas (u_atlas). */
  glyphs?: boolean;
  /** Style supports the "Depth" tab (glyph-like cell styles). */
  depth?: boolean;
  /** Style reads the previous output frame (feedback effects). */
  feedback?: boolean;
  /** Style animates by itself even if global animation is off. */
  alwaysAnimated?: boolean;
  isNew?: boolean;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'softlight'
  | 'add'
  | 'difference'
  | 'colordodge'
  | 'lighten'
  | 'darken';

export const BLEND_MODES: { label: string; value: BlendMode }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Screen', value: 'screen' },
  { label: 'Overlay', value: 'overlay' },
  { label: 'Soft Light', value: 'softlight' },
  { label: 'Add', value: 'add' },
  { label: 'Difference', value: 'difference' },
  { label: 'Color Dodge', value: 'colordodge' },
  { label: 'Lighten', value: 'lighten' },
  { label: 'Darken', value: 'darken' },
];

export interface Layer {
  id: string;
  styleId: string;
  params: Record<string, ParamValue>;
  enabled: boolean;
  opacity: number; // 0..100
  blend: BlendMode;
}

export interface ColorSettings {
  filter: number; // photo filter preset index (0 = none)
  tint: string;
  tintOpacity: number; // 0..100
  tintBlend: number; // 0 multiply 1 screen 2 overlay 3 color
  saturation: number; // 0..200
  vibrance: number; // -100..100
  hue: number; // -180..180
  gradientMap: number; // 0 = none
  grayscale: number; // 0..100
  invert: boolean;
  brightness: number; // -100..100
  contrast: number; // 0..200
  exposure: number; // -100..100
  temperature: number; // -100..100
}

export interface BlurSettings {
  type: number; // 0 off, 1 gaussian, 2 lens, 3 tilt-shift, 4 directional, 5 radial, 6 zoom, 7 glassy, 8 perspective, 9 progressive
  amount: number; // px
  angle: number; // deg
  focus: number; // 0..100 (position of focus band / center)
  spread: number; // 0..100 (size of sharp area)
  centerX: number; // 0..100
  centerY: number; // 0..100
}

export interface PostSettings {
  levels: { on: boolean; inBlack: number; inWhite: number; gamma: number; outBlack: number; outWhite: number };
  curves: { on: boolean; preset: number; amount: number };
  vignette: { on: boolean; amount: number; softness: number };
  scanlines: { on: boolean; amount: number; density: number };
  crt: { on: boolean; amount: number };
  chromatic: { on: boolean; amount: number };
  bloom: { on: boolean; amount: number; threshold: number; radius: number };
  glow: { on: boolean; amount: number };
  tint: { on: boolean; color: string; amount: number };
  grain: { on: boolean; amount: number; colour: boolean };
  glitch: { on: boolean; amount: number; slice: number };
  rgbSplit: { on: boolean; amount: number; angle: number };
  pixelate: { on: boolean; size: number };
  halftone: { on: boolean; size: number; shape: number; mono: boolean };
  ascii: { on: boolean; size: number; charset: number; mono: boolean };
  sharpen: { on: boolean; amount: number };
  threshold: { on: boolean; level: number };
  noise: { on: boolean; amount: number };
}

export interface LightsSettings {
  enabled: boolean;
  mode: number; // 0 spotlight (cursor), 1 fixed points
  radius: number; // 0..100
  intensity: number; // 0..200
  ambient: number; // 0..100 (how dark the rest gets)
  color: string;
  points: { x: number; y: number; color: string }[];
  flicker: boolean;
}

export interface AnimationSettings {
  animated: boolean;
  speed: number; // 0..300 (%)
  matrix: boolean;
  matrixDir: number; // 0..7
  matrixSpeed: number;
  shimmer: number; // 0..100
  pulse: boolean;
}

export interface DepthSettings {
  wave: number; // 0..100
  splay: number; // 0..100
  colorSplit: number; // 0..100
  etch: number; // 0..100
}

export interface MaskSettings {
  enabled: boolean;
  tool: number; // 0 freehand, 1 rectangle, 2 ellipse, 3 eraser
  brushSize: number;
  feather: number;
  invert: boolean;
  showOverlay: boolean;
}

/** A "look" (a.k.a. recipe): everything that defines the output, minus the source. */
export interface Look {
  layers: Layer[];
  color: ColorSettings;
  blur: BlurSettings;
  post: PostSettings;
  lights: LightsSettings;
  animation: AnimationSettings;
  depth: DepthSettings;
  mask: MaskSettings;
}

export interface CropRect {
  x: number; // 0..1 (relative to source)
  y: number;
  w: number;
  h: number;
}

export interface TextItem {
  id: string;
  text: string;
  x: number; // 0..1 center
  y: number; // 0..1 center
  size: number; // relative to output height (0..1)
  color: string;
  font: number; // index into TEXT_FONTS
  weight: number;
  align: 'left' | 'center' | 'right';
  opacity: number; // 0..100
  letterSpacing: number;
}

export interface Transform {
  rotate: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
}
