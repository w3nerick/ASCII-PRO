import type { StyleDef } from '../types';
import { paletteParams, range, toggle, select, color, inkParams, INK_FN } from './shared';
import { GRADIENT_OPTIONS, PALETTE_ORIGINAL } from '../palettes';

const PAPER_FN = /* glsl */ `
vec3 paper(vec2 uv, vec3 base, float amt){
  vec2 p = tl(uv) / max(u_k, 0.5);
  float n = fbm(p * 0.02) * 0.6 + vnoise(p * 0.6) * 0.4;
  return base * (1.0 - amt * 0.12 * (n - 0.5) * 2.0) - amt * 0.03 * hash12(floor(p));
}`;

const dither: StyleDef = {
  id: 'dither',
  name: 'Dither',
  category: 'print',
  tags: ['retro', 'dense'],
  icon: '▚',
  params: [
    select('algorithm', 'Algorithm', ['Bayer 2×2', 'Bayer 4×4', 'Bayer 8×8', 'Blue Noise', 'White Noise', 'Cluster Dot', 'Lines', 'Crosshatch'], 1),
    ...paletteParams(3),
    select('chroma', 'Chroma', ['Luminance', 'Per-channel R/G/B'], 1),
    range('levels', 'Levels', 2, 8, 2, { showIf: { palette: [PALETTE_ORIGINAL] } }),
    range('pixelSize', 'Pixel Size', 1, 16, 2, { unit: 'px' }),
    range('strength', 'Effect Strength', 0, 100, 100),
    range('contrast', 'Contrast', 50, 200, 110),
    range('threshold', 'Threshold', 0, 100, 50),
  ],
  glsl: /* glsl */ `
float thr(vec2 id){
  int a = int(u_algorithm + 0.5);
  if (a == 0) return bayer2(id);
  if (a == 1) return bayer4(id);
  if (a == 2) return bayer8(id);
  if (a == 3) return ign(id);
  if (a == 4) return hash12(id + floor(u_time * 12.0));
  if (a == 5){ vec2 f = mod(id, 6.0) - 2.5; return clamp(length(f) / 3.6, 0.0, 1.0); }
  if (a == 6) return fract(id.y / 4.0) * 0.9 + 0.05;
  return min(fract((id.x + id.y) / 5.0), fract((id.x - id.y) / 5.0)) * 1.3;
}
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_pixelSize));
  vec2 id = floor(tl(uv) / cs);
  vec3 c = cellCenter(id, cs);
  c = (c - 0.5) * u_contrast / 100.0 + 0.5 + (u_threshold - 50.0) / -100.0;
  float k = u_strength / 100.0;
  vec3 t = vec3(thr(id)) - 0.5;
  if (u_chroma > 0.5) t = vec3(thr(id), thr(id + vec2(2.0, 1.0)), thr(id + vec2(1.0, 3.0))) - 0.5;
  vec3 q;
  if (u_palN == 0){
    float L = max(u_levels - 1.0, 1.0);
    q = floor(clamp(c, 0.0, 1.0) * L + 0.5 + t * k) / L;
  } else {
    float n = float(u_palN);
    vec3 cc = u_chroma > 0.5 ? c + t * k / max(pow(n, 1.0 / 3.0) - 1.0, 1.0) : vec3(luma(c)) + t * k / max(n - 1.0, 1.0);
    q = nearestPal(clamp(cc, 0.0, 1.0));
  }
  return vec4(clamp(q, 0.0, 1.0), 1.0);
}`,
};

const stippling: StyleDef = {
  id: 'stippling',
  name: 'Stippling',
  category: 'print',
  tags: ['organic', 'mono'],
  icon: '⣠',
  params: [
    range('size', 'Density', 3, 30, 7, { unit: 'px' }),
    range('dot', 'Dot Size', 20, 200, 100, { unit: '%' }),
    range('gamma', 'Gamma', 40, 250, 120, { unit: '%' }),
    color('ink', 'Ink', '#121212'),
    color('paperC', 'Paper', '#f1ece0'),
    toggle('colorDots', 'Colored Dots'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv) / s;
  vec2 ip = floor(p);
  float m = 0.0; vec3 dc = u_ink;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = ip + vec2(float(i), float(j));
    vec2 o = hash22(id);
    vec2 cp = id + o;
    vec3 c = Sc(fromTl(cp * s));
    float dark = pow(1.0 - luma(c), u_gamma / 100.0);
    float keep = step(hash12(id * 1.91 + 3.0), dark * 1.05);
    float r = (0.14 + 0.14 * dark) * u_dot / 100.0;
    float d = length(p - cp) - r;
    float a = aa(d * s, 1.0) * keep;
    if (a > m){ m = a; dc = u_colorDots > 0.5 ? c * 0.85 : u_ink; }
  }
  return vec4(mix(u_paperC, dc, m), 1.0);
}`,
};

const risograph: StyleDef = {
  id: 'risograph',
  name: 'Risograph',
  category: 'print',
  tags: ['retro', 'color'],
  icon: '▚',
  params: [
    color('ink1', 'Ink 1', '#ff48b0'),
    color('ink2', 'Ink 2', '#0078bf'),
    color('paperC', 'Paper', '#f4efe4'),
    range('size', 'Dot Size', 2, 24, 5, { unit: 'px' }),
    range('misreg', 'Misregistration', 0, 20, 3, { unit: 'px' }),
    range('grain', 'Grain', 0, 100, 45, { unit: '%' }),
    range('contrast', 'Contrast', 50, 200, 115, { unit: '%' }),
    select('split', 'Separation', ['Warm / Cool', 'Shadows / Light', 'Red / Blue']),
  ],
  glsl: /* glsl */ `
${PAPER_FN}
float halftone(vec2 p, float ang, float val, float s){
  vec2 q = rot2(ang) * p;
  vec2 f = fract(q / s) - 0.5;
  float r = sqrt(clamp(val, 0.0, 1.0)) * 0.62;
  return aa((length(f) - r) * s, 1.0);
}
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 off = vec2(PX(u_misreg), PX(u_misreg) * 0.6);
  vec3 c1 = Sc(fromTl(p + off));
  vec3 c2 = Sc(fromTl(p - off));
  c1 = (c1 - 0.5) * u_contrast / 100.0 + 0.5; c2 = (c2 - 0.5) * u_contrast / 100.0 + 0.5;
  float a1, a2;
  int m = int(u_split + 0.5);
  if (m == 0){ a1 = clamp(1.0 - (c1.g + c1.b) * 0.5, 0.0, 1.0); a2 = clamp(1.0 - (c2.r + c2.g) * 0.5, 0.0, 1.0); }
  else if (m == 1){ a1 = clamp(0.8 - luma(c1), 0.0, 1.0) * 1.3; a2 = clamp(1.0 - luma(c2), 0.0, 1.0) * 0.7; }
  else { a1 = 1.0 - c1.r; a2 = 1.0 - c2.b; }
  float g = (hash12(floor(p / max(u_k, 0.5))) - 0.5) * u_grain / 100.0;
  float h1 = halftone(p, 0.26, (a1 + g) * 0.8, s);
  float h2 = halftone(p, 1.31, (a2 + g) * 0.75, s);
  vec3 col = paper(uv, u_paperC, u_grain / 100.0);
  col *= mix(vec3(1.0), u_ink1, h1 * 0.85);
  col *= mix(vec3(1.0), u_ink2, h2 * 0.8);
  return vec4(col, 1.0);
}`,
};

const comic: StyleDef = {
  id: 'comic',
  name: 'Comic',
  category: 'print',
  tags: ['retro', 'color'],
  icon: '◗',
  params: [
    range('levels', 'Color Levels', 2, 8, 4),
    range('outline', 'Ink Lines', 0, 100, 70, { unit: '%' }),
    range('lineW', 'Line Width', 1, 6, 1.5, { step: 0.5, unit: 'px' }),
    range('dots', 'Ben-Day Dots', 0, 100, 60, { unit: '%' }),
    range('dotSize', 'Dot Size', 3, 20, 6, { unit: 'px' }),
    range('saturation', 'Saturation', 0, 250, 150, { unit: '%' }),
    color('paperC', 'Paper', '#fbf6e9'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  float L = u_levels - 1.0;
  vec3 q = floor(clamp(c, 0.0, 1.0) * L + 0.5) / L;
  float l = luma(c);
  float s = PX(u_dotSize);
  vec2 p = rot2(0.785) * tl(uv);
  vec2 f = fract(p / s) - 0.5;
  float r = sqrt(clamp(1.0 - l, 0.0, 1.0)) * 0.55;
  float dotm = aa((length(f) - r) * s, 1.0) * u_dots / 100.0 * step(l, 0.75);
  vec3 col = mix(q, q * q * 0.45, dotm * 0.6);
  col = mix(u_paperC * q * 1.05, col, 0.85);
  float e = sobel(uv, PX(u_lineW)).z;
  col *= 1.0 - smoothstep(0.25, 0.6, e) * u_outline / 100.0;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const sketch: StyleDef = {
  id: 'sketch',
  name: 'Sketch',
  category: 'print',
  tags: ['mono', 'minimal'],
  icon: '✎',
  params: [
    range('strokes', 'Stroke Density', 2, 16, 6, { unit: 'px' }),
    range('edges', 'Contour', 0, 100, 80, { unit: '%' }),
    range('hatch', 'Hatching', 0, 100, 70, { unit: '%' }),
    range('angle', 'Angle', 0, 180, 35, { unit: '°' }),
    color('ink', 'Graphite', '#2b2b2e'),
    color('paperC', 'Paper', '#f3f0e8'),
    toggle('tinted', 'Color Wash'),
  ],
  glsl: /* glsl */ `
${PAPER_FN}
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  float l = luma(c);
  vec2 p = tl(uv);
  float s = PX(u_strokes);
  float jit = vnoise(p / s * vec2(0.3, 3.0)) * 0.6;
  vec2 q = rot2(radians(u_angle)) * p;
  float h1 = abs(fract(q.y / s + jit) - 0.5) * 2.0;
  vec2 q2 = rot2(radians(u_angle + 70.0)) * p;
  float h2 = abs(fract(q2.y / s + jit) - 0.5) * 2.0;
  float dark = 1.0 - l;
  float hatch = (1.0 - smoothstep(0.0, dark * 0.9, h1)) * smoothstep(0.25, 0.6, dark)
              + (1.0 - smoothstep(0.0, dark * 0.7, h2)) * smoothstep(0.55, 0.85, dark);
  float e = sobel(uv, PX(1.2)).z;
  float edge = smoothstep(0.12, 0.5, e + (vnoise(p * 0.3) - 0.5) * 0.1);
  float ink = clamp(hatch * u_hatch / 100.0 + edge * u_edges / 100.0, 0.0, 1.0);
  ink *= 0.75 + 0.25 * vnoise(p * 0.8);
  vec3 base = paper(uv, u_paperC, 1.0);
  if (u_tinted > 0.5) base = mix(base, base * (0.6 + c * 0.6), 0.45);
  return vec4(mix(base, u_ink, ink), 1.0);
}`,
};

const engraving: StyleDef = {
  id: 'engraving',
  name: 'Engraving',
  category: 'print',
  tags: ['mono', 'retro'],
  icon: '≣',
  params: [
    range('spacing', 'Line Spacing', 2, 20, 5, { unit: 'px' }),
    range('angle', 'Angle', 0, 180, 20, { unit: '°' }),
    range('warp', 'Contour Warp', 0, 100, 45, { unit: '%' }),
    range('gamma', 'Gamma', 40, 250, 110, { unit: '%' }),
    color('ink', 'Ink', '#141210'),
    color('paperC', 'Paper', '#efe6d2'),
    toggle('cross', 'Cross Lines', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float s = PX(u_spacing);
  vec3 c = Sc(uv);
  float l = pow(luma(c), u_gamma / 100.0);
  float warp = (luma(Sc(uv + vec2(0.0, 0.01))) - 0.5) * u_warp / 100.0 * 3.0;
  vec2 q = rot2(radians(u_angle)) * p;
  float v = abs(fract(q.y / s + warp) - 0.5) * 2.0;
  float w = clamp(1.0 - l, 0.0, 1.0);
  float ink = 1.0 - smoothstep(w - 0.15, w + 0.05, v);
  if (u_cross > 0.5 && w > 0.62){
    vec2 q2 = rot2(radians(u_angle + 90.0)) * p;
    float v2 = abs(fract(q2.y / s) - 0.5) * 2.0;
    ink = max(ink, 1.0 - smoothstep((w - 0.62) * 2.0 - 0.1, (w - 0.62) * 2.0 + 0.05, v2));
  }
  return vec4(mix(u_paperC, u_ink, ink), 1.0);
}`,
};

const warhol: StyleDef = {
  id: 'warhol',
  name: 'Warhol',
  category: 'print',
  tags: ['color', 'retro'],
  icon: '⊞',
  params: [
    select('grid', 'Grid', ['2 × 2', '3 × 3', '1 × 3', '1 × 2']),
    range('levels', 'Levels', 2, 5, 3),
    range('gap', 'Gap', 0, 40, 6, { unit: 'px' }),
    color('gapC', 'Gap Color', '#0d0d0d'),
    range('shift', 'Palette Shift', 0, 100, 0, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec3 swatch(float panel, float k){
  vec3 a[9] = vec3[9](vec3(1.0,0.2,0.55), vec3(0.98,0.85,0.1), vec3(0.15,0.75,0.95), vec3(0.95,0.45,0.1), vec3(0.45,0.9,0.35), vec3(0.6,0.25,0.9), vec3(0.1,0.25,0.75), vec3(0.95,0.95,0.92), vec3(0.85,0.1,0.15));
  int i = int(mod(panel * 3.0 + k * 2.0 + floor(u_shift / 12.0), 9.0));
  vec3 r = a[0];
  for (int j = 0; j < 9; j++) if (j == i) r = a[j];
  return r;
}
vec4 effect(vec2 uv){
  int g = int(u_grid + 0.5);
  vec2 n = g == 0 ? vec2(2.0) : g == 1 ? vec2(3.0) : g == 2 ? vec2(3.0, 1.0) : vec2(2.0, 1.0);
  vec2 q = vec2(uv.x, 1.0 - uv.y) * n;
  vec2 pid = floor(q);
  vec2 f = fract(q);
  vec2 gapUv = vec2(PX(u_gap)) / u_res * n;
  if (f.x < gapUv.x * 0.5 || f.x > 1.0 - gapUv.x * 0.5 || f.y < gapUv.y * 0.5 || f.y > 1.0 - gapUv.y * 0.5) return vec4(u_gapC, 1.0);
  vec2 suv = vec2(f.x, 1.0 - f.y);
  float l = luma(Sc(suv));
  float L = u_levels - 1.0;
  float k = floor(l * L + 0.5);
  float panel = pid.x + pid.y * n.x;
  vec3 col = k <= 0.0 ? vec3(0.05) : swatch(panel, k);
  if (k >= L) col = mix(col, vec3(1.0), 0.35);
  return vec4(col, 1.0);
}`,
};

const cyanotype: StyleDef = {
  id: 'cyanotype',
  name: 'Cyanotype',
  category: 'print',
  tags: ['retro', 'color'],
  icon: '◫',
  params: [
    color('blue', 'Prussian Blue', '#0b2e6b'),
    color('paperC', 'Paper', '#f2efe6'),
    range('exposure', 'Exposure', 0, 200, 100, { unit: '%' }),
    range('uneven', 'Uneven Coating', 0, 100, 40, { unit: '%' }),
    range('grain', 'Grain', 0, 100, 35, { unit: '%' }),
    toggle('border', 'Brush Border', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv) / max(u_k, 0.5);
  float l = luma(Sc(uv));
  l = clamp(pow(l, 100.0 / max(u_exposure, 1.0)), 0.0, 1.0);
  float coat = 1.0 - u_uneven / 100.0 * 0.35 * fbm(p * 0.006);
  vec3 col = mix(u_blue * coat, u_paperC, l);
  col += (hash12(floor(p)) - 0.5) * u_grain / 100.0 * 0.12;
  if (u_border > 0.5){
    vec2 e = min(uv, 1.0 - uv) * vec2(aspect(), 1.0);
    float b = smoothstep(0.015, 0.045, min(e.x, e.y) + (fbm(p * 0.03) - 0.5) * 0.04);
    col = mix(u_paperC, col, b);
  }
  return vec4(col, 1.0);
}`,
};

const halftone: StyleDef = {
  id: 'halftone',
  name: 'Halftone',
  category: 'print',
  tags: ['retro', 'mono'],
  icon: '◉',
  params: [
    range('size', 'Dot Size', 3, 48, 9, { unit: 'px' }),
    range('angle', 'Angle', 0, 90, 45, { unit: '°' }),
    select('shape', 'Shape', ['Round', 'Square', 'Line', 'Diamond', 'Ring']),
    select('mode', 'Mode', ['Mono', 'Color', 'CMYK']),
    color('ink', 'Ink', '#101010', { showIf: { mode: [0] } }),
    color('paperC', 'Paper', '#f5f2ea'),
    range('scale', 'Dot Scale', 50, 150, 100, { unit: '%' }),
    range('contrast', 'Contrast', 50, 200, 110, { unit: '%' }),
  ],
  glsl: /* glsl */ `
float shapeD(vec2 f, float v){
  int s = int(u_shape + 0.5);
  float r = sqrt(clamp(v, 0.0, 1.0)) * 0.62 * u_scale / 100.0;
  if (s == 1) return max(abs(f.x), abs(f.y)) - r * 0.82;
  if (s == 2) return abs(f.y) - v * 0.5 * u_scale / 100.0;
  if (s == 3) return abs(f.x) + abs(f.y) - r * 1.15;
  if (s == 4) return abs(length(f) - r * 0.7) - r * 0.3;
  return length(f) - r;
}
float screen(vec2 p, float ang, float s, vec3 cin, int ch){
  vec2 q = rot2(ang) * p;
  vec2 id = floor(q / s);
  vec2 f = fract(q / s) - 0.5;
  vec2 cp = rot2(-ang) * ((id + 0.5) * s);
  vec3 c = Sc(fromTl(cp));
  c = (c - 0.5) * u_contrast / 100.0 + 0.5;
  float v;
  if (ch == 0) v = 1.0 - luma(c);
  else {
    float k = 1.0 - max(c.r, max(c.g, c.b));
    vec3 cmy = (1.0 - c - k) / max(1.0 - k, 1e-3);
    v = ch == 1 ? cmy.x : ch == 2 ? cmy.y : ch == 3 ? cmy.z : k;
  }
  return aa(shapeD(f, v) * s, 1.0);
}
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float s = PX(u_size);
  float a = radians(u_angle);
  int m = int(u_mode + 0.5);
  if (m == 0){ float d = screen(p, a, s, vec3(0.0), 0); return vec4(mix(u_paperC, u_ink, d), 1.0); }
  if (m == 1){
    vec2 q = rot2(a) * p; vec2 id = floor(q / s); vec2 f = fract(q / s) - 0.5;
    vec3 c = Sc(fromTl(rot2(-a) * ((id + 0.5) * s)));
    float v = luma(c);
    float d = aa(shapeD(f, 1.0 - v * 0.85) * s, 1.0);
    return vec4(mix(u_paperC, c * 0.9, d), 1.0);
  }
  float cy = screen(p, radians(15.0), s, vec3(0.0), 1);
  float mg = screen(p, radians(75.0), s, vec3(0.0), 2);
  float ye = screen(p, radians(0.0), s, vec3(0.0), 3);
  float kk = screen(p, radians(45.0), s, vec3(0.0), 4);
  vec3 col = u_paperC;
  col *= mix(vec3(1.0), vec3(0.0, 0.68, 0.94), cy);
  col *= mix(vec3(1.0), vec3(0.93, 0.0, 0.55), mg);
  col *= mix(vec3(1.0), vec3(1.0, 0.95, 0.0), ye);
  col *= mix(vec3(1.0), vec3(0.08), kk);
  return vec4(col, 1.0);
}`,
};

const woodblock: StyleDef = {
  id: 'woodblock',
  name: 'Woodblock',
  category: 'print',
  tags: ['retro', 'color'],
  icon: '❀',
  params: [
    range('levels', 'Ink Layers', 2, 6, 4),
    range('grain', 'Wood Grain', 0, 100, 55, { unit: '%' }),
    range('rough', 'Rough Edges', 0, 100, 50, { unit: '%' }),
    { key: 'gradient', label: 'Inks', type: 'select', options: GRADIENT_OPTIONS, default: 5, noUniform: true },
    color('paperC', 'Paper', '#efe4cc'),
    range('outline', 'Key Block', 0, 100, 55, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv) / max(u_k, 0.5);
  float l = luma(Sc(uv));
  float n = (fbm(p * 0.05) - 0.5) * u_rough / 100.0 * 0.25;
  float L = u_levels - 1.0;
  float k = floor(clamp(l + n, 0.0, 1.0) * L + 0.5) / L;
  vec3 ink = gradMap(k);
  float grain = sin(p.y * 0.35 + fbm(p * vec2(0.004, 0.03)) * 18.0) * 0.5 + 0.5;
  ink *= 1.0 - u_grain / 100.0 * 0.22 * grain;
  vec3 col = mix(ink, u_paperC, smoothstep(0.92, 1.0, k) * 0.6);
  float e = sobel(uv, PX(1.5)).z;
  col *= 1.0 - smoothstep(0.3, 0.7, e + n) * u_outline / 100.0 * 0.85;
  return vec4(col, 1.0);
}`,
};

const posterize: StyleDef = {
  id: 'posterize',
  name: 'Posterize',
  category: 'print',
  tags: ['color', 'retro'],
  icon: '◱',
  params: [
    range('levels', 'Levels', 2, 12, 4),
    range('smooth', 'Smoothness', 0, 100, 10, { unit: '%' }),
    toggle('mapGrad', 'Gradient Colors'),
    { key: 'gradient', label: 'Gradient', type: 'select', options: GRADIENT_OPTIONS, default: 3, showIf: { mapGrad: [true] }, noUniform: true },
    range('saturation', 'Saturation', 0, 200, 120, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  float L = u_levels - 1.0;
  vec3 x = clamp(c, 0.0, 1.0) * L;
  vec3 f = fract(x);
  float w = u_smooth / 200.0 + 0.001;
  vec3 q = (floor(x) + smoothstep(0.5 - w, 0.5 + w, f)) / L;
  if (u_mapGrad > 0.5) q = gradMap(luma(q));
  return vec4(clamp(q, 0.0, 1.0), 1.0);
}`,
};

const mezzotint: StyleDef = {
  id: 'mezzotint',
  name: 'Mezzotint',
  category: 'print',
  tags: ['retro', 'mono'],
  icon: '▚',
  params: [
    select('pattern', 'Pattern', ['Fine Dots', 'Grainy', 'Short Strokes', 'Long Strokes']),
    range('grain', 'Grain Size', 1, 8, 1.5, { step: 0.5, unit: 'px' }),
    range('contrast', 'Contrast', 50, 250, 120, { unit: '%' }),
    toggle('colored', 'Keep Color'),
    color('ink', 'Ink', '#111111'),
    color('paperC', 'Paper', '#f0ebe0'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv) / PX(u_grain);
  int m = int(u_pattern + 0.5);
  float t;
  if (m == 0) t = hash12(floor(p));
  else if (m == 1) t = vnoise(p * 0.9) * 0.6 + hash12(floor(p)) * 0.4;
  else if (m == 2) t = hash12(floor(p * vec2(0.25, 1.0)));
  else t = hash12(floor(p * vec2(0.06, 1.0)));
  vec3 c = Sc(uv);
  c = (c - 0.5) * u_contrast / 100.0 + 0.5;
  if (u_colored > 0.5){ vec3 q = step(vec3(t), c); return vec4(q, 1.0); }
  float on = step(t, luma(c));
  return vec4(mix(u_ink, u_paperC, on), 1.0);
}`,
};

const pointillize: StyleDef = {
  id: 'pointillize',
  name: 'Pointillize',
  category: 'print',
  tags: ['color', 'retro'],
  icon: '⣿',
  params: [
    range('size', 'Cell Size', 3, 40, 9, { unit: 'px' }),
    range('dot', 'Dot Size', 40, 140, 95, { unit: '%' }),
    color('paperC', 'Background', '#f4f0e6'),
    range('vivid', 'Vividness', 0, 200, 125, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv) / s;
  vec2 ip = floor(p);
  vec3 top = u_paperC; float topA = 0.0; float topPr = -1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = ip + vec2(float(i), float(j));
    vec2 cp = id + hash22(id);
    float r = (0.5 + 0.18 * hash12(id * 3.1)) * u_dot / 100.0;
    float a = aa((length(p - cp) - r) * s, 1.0);
    float pr = hash12(id + 0.5);
    if (a > 0.02 && pr > topPr){
      topPr = pr;
      vec3 c = Sc(fromTl(cp * s));
      top = clamp(mix(vec3(luma(c)), c, u_vivid / 100.0), 0.0, 1.0);
      topA = a;
    }
  }
  vec3 col = mix(u_paperC, top, topA);
  return vec4(col, 1.0);
}`,
};

const crosshatch: StyleDef = {
  id: 'crosshatch',
  name: 'Crosshatch',
  category: 'print',
  tags: ['mono', 'geometric'],
  icon: '✕',
  params: [
    range('spacing', 'Spacing', 3, 24, 7, { unit: 'px' }),
    range('width', 'Line Width', 5, 60, 22, { unit: '%' }),
    range('layers', 'Layers', 1, 4, 4),
    ...inkParams(2, '#141414'),
    color('paperC', 'Paper', '#f4f1e9'),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float s = PX(u_spacing);
  vec3 c = Sc(uv);
  float l = luma(c);
  float ink = 0.0;
  float w = u_width / 100.0;
  float angs[4] = float[4](0.785, -0.785, 0.0, 1.571);
  float ths[4] = float[4](0.8, 0.6, 0.4, 0.22);
  for (int i = 0; i < 4; i++){
    if (float(i) >= u_layers) break;
    vec2 q = rot2(angs[i]) * p;
    float v = abs(fract(q.y / s) - 0.5) * 2.0;
    ink = max(ink, (1.0 - smoothstep(w, w + 2.0 / s, v)) * step(l, ths[i]));
  }
  return vec4(mix(u_paperC, inkColor(c, l) * 0.8, ink), 1.0);
}`,
};

const cmykDrops: StyleDef = {
  id: 'cmyk-drops',
  name: 'CMYK Drops',
  category: 'print',
  tags: ['color', 'retro'],
  icon: '⣿',
  params: [
    range('size', 'Drop Size', 3, 40, 11, { unit: 'px' }),
    range('offset', 'Plate Offset', 0, 30, 4, { unit: 'px' }),
    range('blob', 'Blobbiness', 0, 100, 55, { unit: '%' }),
    color('paperC', 'Paper', '#f7f3ea'),
  ],
  glsl: /* glsl */ `
float plate(vec2 p, float ang, float s, int ch, vec2 off){
  vec2 q = rot2(ang) * (p + off);
  vec2 id = floor(q / s);
  vec2 f = fract(q / s) - 0.5;
  vec3 c = Sc(fromTl(rot2(-ang) * ((id + 0.5) * s) - off));
  float k = 1.0 - max(c.r, max(c.g, c.b));
  vec3 cmy = (1.0 - c - k) / max(1.0 - k, 1e-3);
  float v = ch == 0 ? cmy.x : ch == 1 ? cmy.y : ch == 2 ? cmy.z : k;
  float wob = (vnoise(q / s * 2.3 + float(ch) * 7.0) - 0.5) * u_blob / 100.0 * 0.3;
  return aa((length(f) - sqrt(clamp(v, 0.0, 1.0)) * 0.6 - wob) * s, 1.4);
}
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float s = PX(u_size);
  float o = PX(u_offset);
  vec3 col = u_paperC;
  col *= mix(vec3(1.0), vec3(0.0, 0.68, 0.94), plate(p, 0.26, s, 0, vec2(o, 0.0)));
  col *= mix(vec3(1.0), vec3(0.93, 0.0, 0.55), plate(p, 1.31, s, 1, vec2(-o, o * 0.5)));
  col *= mix(vec3(1.0), vec3(1.0, 0.93, 0.0), plate(p, 0.0, s, 2, vec2(0.0, -o)));
  col *= mix(vec3(1.0), vec3(0.1), plate(p, 0.785, s, 3, vec2(0.0)));
  return vec4(col, 1.0);
}`,
};

export const PRINT_STYLES: StyleDef[] = [
  dither, stippling, risograph, comic, sketch, engraving, warhol, cyanotype, halftone, woodblock, posterize, mezzotint, pointillize, crosshatch, cmykDrops,
];
