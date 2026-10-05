import type { StyleDef } from '../types';
import { range, toggle, select, color } from './shared';
import { GRADIENT_OPTIONS } from '../palettes';

const waves: StyleDef = {
  id: 'waves',
  name: 'Waves',
  category: 'material',
  tags: ['organic', 'color'],
  icon: '≈',
  params: [
    range('amp', 'Amplitude', 0, 60, 12, { unit: 'px' }),
    range('freq', 'Frequency', 1, 60, 10),
    range('angle', 'Direction', 0, 360, 20, { unit: '°' }),
    range('shading', 'Shading', 0, 100, 45, { unit: '%' }),
    toggle('animate', 'Animate', true),
  ],
  glsl: /* glsl */ `
float wv(vec2 p, float t){
  vec2 d = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  return sin(dot(p, d) * u_freq * TAU + t) * 0.6 + sin(dot(p, vec2(-d.y, d.x)) * u_freq * 1.7 * TAU - t * 0.7) * 0.4;
}
vec4 effect(vec2 uv){
  float t = u_animate > 0.5 ? u_time * 1.8 : 0.0;
  vec2 p = uv * vec2(aspect(), 1.0);
  float h = wv(p, t);
  float e = 0.002;
  vec2 g = vec2(wv(p + vec2(e, 0.0), t) - h, wv(p + vec2(0.0, e), t) - h) / e;
  vec2 off = g * PX(u_amp) / u_res / max(u_freq * TAU, 1.0);
  vec3 c = Sc(clamp(uv + off, 0.0, 1.0));
  float sh = dot(normalize(vec3(-g / max(u_freq * TAU, 1.0) * 3.0, 1.0)), normalize(vec3(-0.4, 0.6, 0.7)));
  c *= mix(1.0, 0.6 + sh * 0.6, u_shading / 100.0);
  return vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

const oilPaint: StyleDef = {
  id: 'oil-paint',
  name: 'Oil Paint',
  category: 'material',
  tags: ['organic', 'color'],
  icon: '❋',
  params: [
    range('radius', 'Brush Size', 1, 12, 5, { unit: 'px' }),
    range('texture', 'Canvas Texture', 0, 100, 40, { unit: '%' }),
    range('saturation', 'Saturation', 0, 200, 120, { unit: '%' }),
    range('relief', 'Impasto', 0, 100, 35, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float rr = PX(u_radius);
  float stp = max(rr / 4.0, 1.0);
  int n = int(min(ceil(rr / stp), 6.0));
  vec3 m[4]; vec3 s[4];
  for (int k = 0; k < 4; k++){ m[k] = vec3(0.0); s[k] = vec3(0.0); }
  float cnt = float((n + 1) * (n + 1));
  for (int j = 0; j <= 6; j++){
    if (j > n) break;
    for (int i = 0; i <= 6; i++){
      if (i > n) break;
      vec2 o = vec2(float(i), float(j)) * stp / u_res;
      vec3 c0 = Sc(uv + vec2(-o.x, o.y)); m[0] += c0; s[0] += c0 * c0;
      vec3 c1 = Sc(uv + vec2(o.x, o.y)); m[1] += c1; s[1] += c1 * c1;
      vec3 c2 = Sc(uv + vec2(o.x, -o.y)); m[2] += c2; s[2] += c2 * c2;
      vec3 c3 = Sc(uv + vec2(-o.x, -o.y)); m[3] += c3; s[3] += c3 * c3;
    }
  }
  float best = 1e9; vec3 col = vec3(0.0);
  for (int k = 0; k < 4; k++){
    vec3 mu = m[k] / cnt;
    vec3 v = abs(s[k] / cnt - mu * mu);
    float sig = v.r + v.g + v.b;
    if (sig < best){ best = sig; col = mu; }
  }
  col = mix(vec3(luma(col)), col, u_saturation / 100.0);
  vec2 p = tl(uv) / max(u_k, 0.5);
  float weave = (sin(p.x * 1.4) * sin(p.y * 1.4)) * 0.5 + 0.5;
  col *= 1.0 - u_texture / 100.0 * 0.12 * weave;
  float h = luma(col);
  float hx = luma(Sc(uv + vec2(rr, 0.0) / u_res)) - h;
  col += hx * u_relief / 100.0 * 0.6;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const watercolor: StyleDef = {
  id: 'watercolor',
  name: 'Watercolor',
  category: 'material',
  tags: ['organic', 'color'],
  icon: '❍',
  params: [
    range('bleed', 'Bleed', 0, 30, 8, { unit: 'px' }),
    range('edges', 'Edge Darkening', 0, 100, 55, { unit: '%' }),
    range('granulation', 'Granulation', 0, 100, 45, { unit: '%' }),
    range('levels', 'Pigment Levels', 2, 16, 7),
    color('paperC', 'Paper', '#faf6ee'),
    range('wash', 'Paper Show-through', 0, 100, 30, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv) / max(u_k, 0.5);
  vec2 w = (vec2(fbm(p * 0.01), fbm(p * 0.01 + 7.0)) - 0.5) * PX(u_bleed) * 2.0 / u_res;
  vec3 c = vec3(0.0);
  float ga = 2.39996323;
  for (int i = 0; i < 16; i++){
    float fi = float(i) + 0.5;
    vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * sqrt(fi / 16.0) * PX(u_bleed) * 0.6 / u_res;
    c += Sc(clamp(uv + w + o, 0.0, 1.0));
  }
  c /= 16.0;
  float L = u_levels;
  c = floor(c * L + 0.5) / L;
  float e = sobel(uv + w, PX(2.0)).z;
  c *= 1.0 - smoothstep(0.05, 0.4, e) * u_edges / 100.0 * 0.45;
  float gr = vnoise(p * 0.8) * 0.5 + fbm(p * 0.05) * 0.5;
  c *= 1.0 - u_granulation / 100.0 * 0.2 * gr;
  c = mix(c, u_paperC, u_wash / 100.0 * (1.0 - luma(1.0 - c)) * 0.6);
  c *= u_paperC;
  return vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

const chrome: StyleDef = {
  id: 'chrome',
  name: 'Chrome',
  category: 'material',
  tags: ['color', 'geometric'],
  icon: '◐',
  params: [
    range('relief', 'Relief', 0, 100, 40, { unit: '%' }),
    range('smooth', 'Smoothness', 1, 20, 6, { unit: 'px' }),
    { key: 'gradient', label: 'Environment', type: 'select', options: GRADIENT_OPTIONS, default: 9, noUniform: true },
    range('colorKeep', 'Keep Color', 0, 100, 0, { unit: '%' }),
    range('contrast', 'Contrast', 50, 250, 120, { unit: '%' }),
  ],
  glsl: /* glsl */ `
float hgt(vec2 uv){ float r = PX(u_smooth); vec2 e = vec2(r) / u_res; return (Sl(uv) * 2.0 + Sl(uv + vec2(e.x, 0.0)) + Sl(uv - vec2(e.x, 0.0)) + Sl(uv + vec2(0.0, e.y)) + Sl(uv - vec2(0.0, e.y))) / 6.0; }
vec4 effect(vec2 uv){
  vec2 e = vec2(PX(u_smooth)) / u_res;
  float h = hgt(uv);
  vec2 g = vec2(hgt(uv + vec2(e.x, 0.0)) - hgt(uv - vec2(e.x, 0.0)), hgt(uv + vec2(0.0, e.y)) - hgt(uv - vec2(0.0, e.y)));
  vec3 n = normalize(vec3(-g * u_relief / 100.0 * 12.0, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float env = mix(h, 0.5 + 0.45 * r.y + 0.12 * sin(r.x * 4.0 + h * 3.0), 0.55);
  env = clamp((env - 0.5) * u_contrast / 100.0 + 0.5, 0.0, 1.0);
  vec3 col = gradMap(env);
  col = mix(col, col * Sc(uv) * 1.6, u_colorKeep / 100.0);
  float spec = pow(max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0), 40.0);
  return vec4(clamp(col + spec * 0.6, 0.0, 1.0), 1.0);
}`,
};

const thinFilm: StyleDef = {
  id: 'thin-film',
  name: 'Thin-Film',
  category: 'material',
  tags: ['color', 'organic'],
  icon: '◍',
  params: [
    range('thickness', 'Film Thickness', 10, 300, 90, { unit: '%' }),
    range('amount', 'Iridescence', 0, 100, 45, { unit: '%' }),
    range('swirl', 'Swirl', 0, 100, 40, { unit: '%' }),
    toggle('animate', 'Flow', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  float t = u_animate > 0.5 ? u_time * 0.1 : 0.0;
  float th = luma(c) * u_thickness / 100.0 * 3.0 + fbm(uv * 4.0 + t) * u_swirl / 100.0 * 2.0;
  vec3 film = 0.5 + 0.5 * cos(TAU * (th + vec3(0.0, 0.33, 0.67)));
  vec3 col = mix(c, 1.0 - (1.0 - c) * (1.0 - film * 0.9), u_amount / 100.0);
  col = mix(col, col * film * 1.4, u_amount / 100.0 * 0.35);
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const marble: StyleDef = {
  id: 'marble',
  name: 'Marble',
  category: 'material',
  tags: ['organic', 'color'],
  icon: '❖',
  params: [
    range('veins', 'Vein Frequency', 1, 40, 8),
    range('turbulence', 'Turbulence', 0, 100, 60, { unit: '%' }),
    range('amount', 'Vein Amount', 0, 100, 55, { unit: '%' }),
    color('veinC', 'Vein Color', '#2b2b30'),
    range('polish', 'Polish', 0, 100, 40, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec3 c = Sc(uv);
  vec2 p = uv * vec2(aspect(), 1.0) * 3.0;
  float n = fbm(p * 1.5) * u_turbulence / 100.0 * 6.0 + luma(c) * 2.0;
  float v = abs(sin(p.x * u_veins * 0.6 + p.y * u_veins * 0.3 + n));
  float vein = pow(1.0 - v, 6.0);
  vec3 col = mix(c * 0.85 + 0.12, u_veinC, vein * u_amount / 100.0);
  col += pow(vnoise(p * 20.0), 8.0) * u_polish / 100.0 * 0.4;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const molten: StyleDef = {
  id: 'molten-metal',
  name: 'Molten Metal',
  category: 'material',
  tags: ['organic', 'color'],
  icon: '◈',
  params: [
    { key: 'gradient', label: 'Metal', type: 'select', options: GRADIENT_OPTIONS, default: 8, noUniform: true },
    range('flow', 'Flow', 0, 100, 45, { unit: '%' }),
    range('relief', 'Relief', 0, 100, 60, { unit: '%' }),
    range('glow', 'Heat Glow', 0, 100, 40, { unit: '%' }),
    toggle('animate', 'Animate', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float t = u_animate > 0.5 ? u_time * 0.25 : 0.0;
  vec2 w = (vec2(fbm(uv * 5.0 + t), fbm(uv * 5.0 - t + 3.0)) - 0.5) * u_flow / 100.0 * 0.06;
  vec2 q = clamp(uv + w, 0.0, 1.0);
  float h = Sl(q);
  vec2 e = vec2(2.0) / u_res;
  vec2 g = vec2(Sl(q + vec2(e.x, 0.0)) - Sl(q - vec2(e.x, 0.0)), Sl(q + vec2(0.0, e.y)) - Sl(q - vec2(0.0, e.y)));
  vec3 n = normalize(vec3(-g * u_relief / 100.0 * 10.0, 1.0));
  float env = clamp(h * 0.7 + 0.3 * (0.5 + 0.5 * reflect(vec3(0.0, 0.0, -1.0), n).y), 0.0, 1.0);
  vec3 col = gradMap(env);
  col += pow(max(dot(n, normalize(vec3(-0.3, 0.5, 0.8))), 0.0), 30.0) * 0.7;
  col += gradMap(1.0) * smoothstep(0.7, 1.0, h) * u_glow / 100.0 * 0.4;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const crystallize: StyleDef = {
  id: 'crystallize',
  name: 'Crystallize',
  category: 'material',
  tags: ['geometric', 'color'],
  icon: '◈',
  params: [
    range('size', 'Cell Size', 4, 120, 22, { unit: 'px' }),
    range('edges', 'Facet Edges', 0, 100, 25, { unit: '%' }),
    range('facet', 'Facet Shading', 0, 100, 30, { unit: '%' }),
    select('sample', 'Color Sample', ['Site', 'Average']),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv) / s;
  vec2 cid; float edge;
  vec2 r = voronoi(p, cid, edge);
  vec2 site = cid + hash22(cid);
  vec3 c = Sc(fromTl(site * s));
  if (u_sample > 0.5) c = (c + Sc(fromTl((site + vec2(0.25, 0.0)) * s)) + Sc(fromTl((site - vec2(0.25, 0.0)) * s)) + Sc(fromTl((site + vec2(0.0, 0.25)) * s)) + Sc(fromTl((site - vec2(0.0, 0.25)) * s))) / 5.0;
  c *= 1.0 + dot(normalize(r + 1e-4), vec2(-0.6, -0.6)) * length(r) * u_facet / 100.0 * 0.5;
  c = mix(c * 0.55, c, smoothstep(0.0, 0.06, edge) * u_edges / 100.0 + (1.0 - u_edges / 100.0));
  return vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

const emboss: StyleDef = {
  id: 'emboss',
  name: 'Emboss',
  category: 'material',
  tags: ['mono', 'geometric'],
  icon: '◪',
  params: [
    range('strength', 'Strength', 0, 300, 120, { unit: '%' }),
    range('angle', 'Light Angle', 0, 360, 135, { unit: '°' }),
    range('distance', 'Distance', 0.5, 8, 2, { step: 0.5, unit: 'px' }),
    range('colorKeep', 'Keep Color', 0, 100, 0, { unit: '%' }),
    color('base', 'Base', '#8a8a8a'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 d = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * PX(u_distance) / u_res;
  float v = (Sl(uv - d) - Sl(uv + d)) * u_strength / 100.0 * 2.0;
  vec3 col = u_base + v;
  col = mix(col, Sc(uv) * (1.0 + v * 2.0), u_colorKeep / 100.0);
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

export const MATERIAL_STYLES: StyleDef[] = [waves, oilPaint, watercolor, chrome, thinFilm, marble, molten, crystallize, emboss];
