import type { StyleDef } from '../types';
import { backdrop, range, toggle, select, color, center } from './shared';
import { GRADIENT_OPTIONS } from '../palettes';

const disco: StyleDef = {
  id: 'disco',
  name: 'Disco',
  category: 'light',
  tags: ['glitch', 'color'],
  icon: '◈',
  isNew: true,
  glyphs: true,
  depth: true,
  backdrop: true,
  alwaysAnimated: true,
  params: [
    ...backdrop(1, 8, 100, '#040406'),
    { key: 'fontSize', label: 'Glyph Size', type: 'range', min: 6, max: 64, step: 1, default: 14 },
    { key: 'chars', label: 'Glyphs', type: 'text', default: '◈◉◇◆○●✦', atlas: true },
    range('speed', 'Color Speed', 0, 300, 100, { unit: '%' }),
    range('spread', 'Hue Spread', 0, 200, 60, { unit: '%' }),
    range('saturation', 'Saturation', 0, 100, 85, { unit: '%' }),
    range('sparkle', 'Sparkle', 0, 100, 40, { unit: '%' }),
    range('coverage', 'Coverage', 0, 100, 90, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_fontSize));
  vec2 p = tl(uv);
  vec2 id = floor(p / cs);
  vec2 f = fract(p / cs);
  vec3 cc = cellAvg(id, cs);
  float l = luma(cc);
  float idx = floor((1.0 - l) * (u_glyphN - 0.001));
  idx = shimmerIdx(idx, id);
  vec3 m = glyph3(idx, f, cs, id, l);
  float h = fract((id.x + id.y) * 0.02 * u_spread / 100.0 + u_time * 0.15 * u_speed / 100.0 + l * 0.3);
  vec3 ink = hsv2rgb(vec3(h, u_saturation / 100.0, 0.55 + l * 0.6));
  float sp = step(1.0 - u_sparkle / 100.0 * 0.08, hash12(id + floor(u_time * 6.0)));
  ink += sp * 0.8;
  float vis = step(1.0 - u_coverage / 100.0, l);
  vec4 bd = backdrop(uv);
  vec3 k = m * vis;
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, ink, k) : ink;
  return vec4(col, max(bd.a, max(k.r, max(k.g, k.b))));
}`,
};

const anaglyph: StyleDef = {
  id: 'anaglyph-3d',
  name: 'Anaglyph 3D',
  category: 'light',
  tags: ['retro', 'color'],
  icon: '◑',
  params: [
    range('parallax', 'Depth', 0, 60, 14, { unit: 'px' }),
    select('mode', 'Glasses', ['Red / Cyan', 'Green / Magenta', 'Amber / Blue']),
    toggle('depthMap', 'Depth From Brightness', true),
    range('color', 'Color Retention', 0, 100, 40, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float d = PX(u_parallax) / u_res.x;
  float z = u_depthMap > 0.5 ? luma(Sc(uv)) : 1.0;
  vec3 L = Sc(uv + vec2(d * z, 0.0));
  vec3 R = Sc(uv - vec2(d * z, 0.0));
  float lL = luma(L), lR = luma(R);
  vec3 ll = mix(vec3(lL), L, u_color / 100.0);
  vec3 rr = mix(vec3(lR), R, u_color / 100.0);
  int m = int(u_mode + 0.5);
  vec3 col;
  if (m == 0) col = vec3(ll.r, rr.g, rr.b);
  else if (m == 1) col = vec3(rr.r, ll.g, rr.b);
  else col = vec3(ll.r, ll.g * 0.8 + rr.g * 0.2, rr.b);
  return vec4(col, 1.0);
}`,
};

const gradientMap: StyleDef = {
  id: 'gradient-map',
  name: 'Gradient Map',
  category: 'light',
  tags: ['color', 'retro'],
  icon: '⬒',
  params: [
    { key: 'gradient', label: 'Gradient', type: 'select', options: GRADIENT_OPTIONS, default: 2, noUniform: true },
    range('amount', 'Amount', 0, 100, 100, { unit: '%' }),
    range('contrast', 'Contrast', 50, 200, 110, { unit: '%' }),
    range('offset', 'Offset', -50, 50, 0, { unit: '%' }),
    toggle('reverse', 'Reverse'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  float l = clamp((luma(c) - 0.5) * u_contrast / 100.0 + 0.5 + u_offset / 100.0, 0.0, 1.0);
  if (u_reverse > 0.5) l = 1.0 - l;
  return vec4(mix(c, gradMap(l), u_amount / 100.0), 1.0);
}`,
};

const prism: StyleDef = {
  id: 'prism',
  name: 'Prism',
  category: 'light',
  tags: ['geometric', 'color'],
  icon: '✧',
  params: [
    range('dispersion', 'Dispersion', 0, 100, 40, { unit: '%' }),
    select('mode', 'Mode', ['Radial', 'Linear', 'Facets']),
    range('angle', 'Angle', 0, 360, 30, { unit: '°' }),
    range('facets', 'Facets', 2, 16, 6),
    range('rainbow', 'Rainbow Tint', 0, 100, 25, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  int m = int(u_mode + 0.5);
  vec2 d;
  if (m == 0) d = (uv - 0.5);
  else if (m == 1) d = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * 0.5;
  else { float a = atan(uv.y - 0.5, uv.x - 0.5); float k = floor(a / TAU * u_facets) / u_facets * TAU + radians(u_angle); d = vec2(cos(k), sin(k)) * 0.5; }
  d *= u_dispersion / 100.0 * 0.06;
  vec3 acc = vec3(0.0); vec3 ws = vec3(0.0);
  for (int i = 0; i < 9; i++){
    float t = float(i) / 8.0;
    vec3 w = clamp(vec3(1.0 - abs(t - 0.0) * 2.2, 1.0 - abs(t - 0.5) * 2.2, 1.0 - abs(t - 1.0) * 2.2), 0.0, 1.0);
    acc += Sc(clamp(uv + d * (t - 0.5) * 2.0, 0.0, 1.0)) * w; ws += w;
  }
  vec3 col = acc / ws;
  vec3 rb = hsv2rgb(vec3(fract(dot(uv, vec2(0.7, 0.4)) * 1.5), 0.6, 1.0));
  col = mix(col, col * rb * 1.3, u_rainbow / 100.0 * 0.5);
  return vec4(col, 1.0);
}`,
};

const dreamdust: StyleDef = {
  id: 'dreamdust',
  name: 'Dreamdust',
  category: 'light',
  tags: ['organic', 'color'],
  icon: '✵',
  params: [
    range('glow', 'Dream Glow', 0, 100, 55, { unit: '%' }),
    range('dust', 'Dust Amount', 0, 100, 50, { unit: '%' }),
    range('dustSize', 'Dust Size', 1, 8, 2.5, { step: 0.5, unit: 'px' }),
    color('tint', 'Pastel Tint', '#ffd6ef'),
    range('tintAmt', 'Tint', 0, 100, 30, { unit: '%' }),
    toggle('twinkle', 'Twinkle', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  vec3 bl = vec3(0.0);
  float ga = 2.39996323;
  for (int i = 0; i < 24; i++){
    float fi = float(i) + 0.5;
    vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * sqrt(fi / 24.0) * PX(26.0) / u_res;
    bl += Sc(uv + o);
  }
  bl /= 24.0;
  vec3 col = 1.0 - (1.0 - c) * (1.0 - bl * u_glow / 100.0 * 0.9);
  col = mix(col, col * u_tint + u_tint * 0.08, u_tintAmt / 100.0);
  float s = PX(u_dustSize) * 3.0;
  vec2 p = tl(uv) / s;
  vec2 id = floor(p);
  vec2 f = fract(p) - hash22(id);
  float on = step(1.0 - u_dust / 100.0 * 0.3, hash12(id * 1.7)) * smoothstep(0.25, 0.8, luma(c) + 0.2);
  float tw = u_twinkle > 0.5 ? 0.5 + 0.5 * sin(u_time * 3.0 + hash12(id) * 30.0) : 1.0;
  float star = on * tw * (aa(length(f) * s - PX(u_dustSize) * 0.5, 1.0) + 0.5 * aa(min(abs(f.x), abs(f.y)) * s - 0.4, 0.8) * aa(length(f) * s - PX(u_dustSize) * 2.0, 2.0));
  col += star * 0.9;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const lightWind: StyleDef = {
  id: 'light-wind',
  name: 'Light Wind',
  category: 'light',
  tags: ['color', 'organic'],
  icon: '༄',
  params: [
    range('length', 'Streak Length', 5, 300, 90, { unit: 'px' }),
    range('angle', 'Direction', 0, 360, 0, { unit: '°' }),
    range('threshold', 'Threshold', 0, 100, 55, { unit: '%' }),
    range('intensity', 'Intensity', 0, 200, 100, { unit: '%' }),
    toggle('turbulence', 'Turbulence', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  if (u_turbulence > 0.5) dir = rot2((vnoise(tl(uv) * 0.004 + u_time * 0.2) - 0.5) * 0.8) * dir;
  vec2 st = dir * PX(u_length) / 32.0 / u_res;
  vec3 acc = vec3(0.0);
  for (int i = 1; i <= 32; i++){
    vec3 s = Sc(clamp(uv - st * float(i), 0.0, 1.0));
    acc += s * smoothstep(u_threshold / 100.0, u_threshold / 100.0 + 0.25, luma(s)) * (1.0 - float(i) / 33.0);
  }
  vec3 col = Sc(uv) + acc / 16.0 * u_intensity / 100.0;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const kaleido: StyleDef = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  category: 'light',
  tags: ['color', 'organic'],
  icon: '✺',
  params: [
    range('segments', 'Segments', 2, 24, 8),
    range('rotation', 'Rotation', 0, 360, 0, { unit: '°' }),
    range('zoom', 'Zoom', 30, 300, 100, { unit: '%' }),
    ...center(),
    toggle('spin', 'Spin'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 d = (uv - 0.5) * vec2(aspect(), 1.0);
  float r = length(d) * 100.0 / u_zoom;
  float a = atan(d.y, d.x) + radians(u_rotation) + (u_spin > 0.5 ? u_time * 0.25 : 0.0);
  float seg = TAU / floor(u_segments);
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r / vec2(aspect(), 1.0) + ctr();
  q = 1.0 - abs(1.0 - mod(q, 2.0));
  return S(q);
}`,
};

const warpbloom: StyleDef = {
  id: 'warpbloom',
  name: 'Warpbloom',
  category: 'light',
  tags: ['organic', 'color'],
  icon: '❃',
  params: [
    range('warp', 'Warp', 0, 100, 45, { unit: '%' }),
    range('scale', 'Warp Scale', 1, 100, 25),
    range('bloom', 'Bloom', 0, 100, 55, { unit: '%' }),
    range('hue', 'Hue Drift', 0, 100, 20, { unit: '%' }),
    toggle('animate', 'Animate', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float t = u_animate > 0.5 ? u_time * 0.15 : 0.0;
  vec2 p = uv * u_scale * 0.08;
  vec2 w = vec2(fbm(p + t), fbm(p + 5.2 - t));
  vec2 q = uv + (w - 0.5) * u_warp / 100.0 * 0.12;
  vec3 c = Sc(clamp(q, 0.0, 1.0));
  vec3 bl = vec3(0.0);
  float ga = 2.39996323;
  for (int i = 0; i < 20; i++){
    float fi = float(i) + 0.5;
    vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * sqrt(fi / 20.0) * PX(30.0) / u_res;
    vec3 s = Sc(clamp(q + o, 0.0, 1.0));
    bl += s * smoothstep(0.45, 0.9, luma(s));
  }
  c += bl / 20.0 * u_bloom / 100.0 * 2.0;
  vec3 h = rgb2hsv(clamp(c, 0.0, 1.0)); h.x = fract(h.x + (w.x - 0.5) * u_hue / 100.0); c = hsv2rgb(h);
  return vec4(c, 1.0);
}`,
};

const duotone: StyleDef = {
  id: 'duotone',
  name: 'Duotone',
  category: 'light',
  tags: ['color', 'minimal'],
  icon: '◑',
  params: [
    color('shadow', 'Shadows', '#1d1145'),
    color('highlight', 'Highlights', '#ff6fa8'),
    range('contrast', 'Contrast', 50, 200, 115, { unit: '%' }),
    range('balance', 'Balance', -50, 50, 0, { unit: '%' }),
    range('grain', 'Grain', 0, 100, 0, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float l = luma(Sc(uv));
  l = clamp((l - 0.5) * u_contrast / 100.0 + 0.5 + u_balance / 100.0, 0.0, 1.0);
  l += (hash12(tl(uv)) - 0.5) * u_grain / 100.0 * 0.15;
  return vec4(mix(u_shadow, u_highlight, smoothstep(0.0, 1.0, l)), 1.0);
}`,
};

const edgeGlow: StyleDef = {
  id: 'edge-glow',
  name: 'Edge Glow',
  category: 'light',
  tags: ['glitch', 'color'],
  icon: '◇',
  params: [
    range('strength', 'Edge Strength', 0, 200, 100, { unit: '%' }),
    range('width', 'Edge Width', 0.5, 6, 1.5, { step: 0.5, unit: 'px' }),
    select('colorMode', 'Color', ['Image', 'Neon Hue', 'Mono']),
    color('ink', 'Glow Color', '#38f9ff', { showIf: { colorMode: [2] } }),
    range('dim', 'Dim Image', 0, 100, 85, { unit: '%' }),
    range('glow', 'Glow', 0, 100, 50, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  float e = sobel(uv, PX(u_width)).z * u_strength / 100.0;
  float g = 0.0;
  for (int i = 0; i < 8; i++){
    float a = float(i) * 0.785398;
    g += sobel(uv + vec2(cos(a), sin(a)) * PX(4.0) / u_res, PX(u_width)).z;
  }
  g = g / 8.0 * u_glow / 100.0;
  int m = int(u_colorMode + 0.5);
  vec3 ec = m == 0 ? c / max(max(c.r, max(c.g, c.b)), 0.15) : m == 1 ? hsv2rgb(vec3(fract(atan(uv.y - 0.5, uv.x - 0.5) / TAU + u_time * 0.05), 0.85, 1.0)) : u_ink;
  vec3 col = c * (1.0 - u_dim / 100.0) + ec * clamp(e + g, 0.0, 1.5);
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const aberration: StyleDef = {
  id: 'aberration',
  name: 'Aberration',
  category: 'light',
  tags: ['color', 'organic'],
  icon: '◉',
  params: [
    range('amount', 'Amount', 0, 100, 35, { unit: '%' }),
    range('falloff', 'Edge Falloff', 0, 100, 60, { unit: '%' }),
    range('blur', 'Edge Blur', 0, 100, 25, { unit: '%' }),
    ...center(),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 d = uv - ctr();
  float r = length(d * vec2(aspect(), 1.0));
  float k = mix(1.0, smoothstep(0.0, 0.7, r), u_falloff / 100.0);
  vec2 o = d * u_amount / 100.0 * 0.06 * k;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 6; i++){
    float t = 1.0 + float(i) / 5.0 * u_blur / 100.0;
    acc += vec3(Sc(uv - o * t).r, Sc(uv - o * 0.1 * t).g, Sc(uv + o * t).b);
  }
  return vec4(acc / 6.0, 1.0);
}`,
};

export const LIGHT_STYLES: StyleDef[] = [disco, anaglyph, gradientMap, prism, dreamdust, lightWind, kaleido, warpbloom, duotone, edgeGlow, aberration];
