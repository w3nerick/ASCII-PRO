import type { StyleDef, ParamDef } from '../types';
import { range, toggle, color, center } from './shared';

const GLASS_FN = /* glsl */ `
vec3 glassColor(vec2 uv, vec2 n, float edge){
  vec2 off = n * PX(u_strength) / u_res * vec2(1.0, -1.0);
  float disp = u_dispersion / 100.0;
  vec3 c;
  float fr = PX(u_frost);
  if (fr > 0.6){
    c = vec3(0.0);
    float ga = 2.39996323;
    for (int i = 0; i < 16; i++){
      float fi = float(i) + 0.5;
      vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * sqrt(fi / 16.0) * fr / u_res;
      vec2 q = clamp(uv + off + o, 0.0, 1.0);
      c += vec3(Sc(q + off * disp * 0.15).r, Sc(q).g, Sc(q - off * disp * 0.15).b);
    }
    c /= 16.0;
  } else {
    vec2 q = clamp(uv + off, 0.0, 1.0);
    c = vec3(Sc(clamp(q + off * disp * 0.15, 0.0, 1.0)).r, Sc(q).g, Sc(clamp(q - off * disp * 0.15, 0.0, 1.0)).b);
  }
  c = mix(c, c * u_tint * 1.15, u_tintAmt / 100.0);
  vec3 N = normalize(vec3(n * 1.2, 1.0));
  float hl = pow(clamp(dot(N, normalize(vec3(-0.45, 0.55, 0.7))), 0.0, 1.0), 28.0);
  c += hl * u_specular / 100.0 * 0.8;
  c += edge * u_specular / 100.0 * 0.25;
  return clamp(c, 0.0, 1.0);
}`;

const COMMON_PARAMS = (strength: number, frost: number, tint = '#ffffff', tintAmt = 0): ParamDef[] => [
  range('strength', 'Refraction', 0, 120, strength, { unit: 'px', section: 'Glass' }),
  range('frost', 'Frost', 0, 30, frost, { unit: 'px', section: 'Glass' }),
  range('dispersion', 'Dispersion', 0, 100, 30, { unit: '%', section: 'Glass' }),
  range('specular', 'Specular', 0, 100, 45, { unit: '%', section: 'Glass' }),
  color('tint', 'Tint', tint, { section: 'Glass' }),
  range('tintAmt', 'Tint Amount', 0, 100, tintAmt, { unit: '%', section: 'Glass' }),
];

function glass(id: string, name: string, icon: string, tags: string[], params: ParamDef[], normalGlsl: string, extra: { animated?: boolean } = {}): StyleDef {
  return {
    id, name, icon, tags, category: 'glass', params,
    alwaysAnimated: extra.animated,
    glsl: `${GLASS_FN}\n${normalGlsl}\nvec4 effect(vec2 uv){ float e = 0.0; vec2 n = glassN(uv, e); return vec4(glassColor(uv, n, e), 1.0); }`,
  };
}

const frosted = glass('frosted-glass', 'Frosted Glass', '▩', ['minimal', 'organic'], [
  range('grain', 'Grain Size', 1, 20, 3, { unit: 'px' }),
  ...COMMON_PARAMS(10, 10, '#eef4ff', 8),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 p = tl(uv) / PX(u_grain);
  e = 0.0;
  return (hash22(floor(p)) - 0.5) * 2.0;
}`);

const tinted = glass('tinted-glass', 'Tinted Glass', '◈', ['color', 'geometric'], [
  range('size', 'Pane Size', 20, 400, 120, { unit: 'px' }),
  range('bevel', 'Bevel', 1, 50, 18, { unit: '%' }),
  range('hueVar', 'Hue Variation', 0, 100, 60, { unit: '%' }),
  ...COMMON_PARAMS(18, 2, '#7fd4ff', 55),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  float s = PX(u_size);
  vec2 p = tl(uv) / s;
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  float b = u_bevel / 100.0 * 0.5;
  vec2 n = vec2(smoothstep(0.5 - b, 0.5, abs(f.x)) * sign(f.x), smoothstep(0.5 - b, 0.5, abs(f.y)) * sign(f.y));
  e = smoothstep(0.47, 0.5, max(abs(f.x), abs(f.y)));
  return n * 1.5 + (hash22(id) - 0.5) * 0.3;
}`);
tinted.glsl = tinted.glsl.replace('c = mix(c, c * u_tint * 1.15, u_tintAmt / 100.0);', `{
    vec2 pid = floor(tl(uv) / PX(u_size));
    vec3 h = rgb2hsv(u_tint); h.x = fract(h.x + (hash12(pid) - 0.5) * u_hueVar / 100.0);
    c = mix(c, c * hsv2rgb(h) * 1.2, u_tintAmt / 100.0);
  }`);

const shatter = glass('shatter', 'Shatter', '❖', ['geometric', 'glitch'], [
  range('size', 'Shard Size', 10, 300, 90, { unit: 'px' }),
  range('crack', 'Crack Lines', 0, 100, 60, { unit: '%' }),
  ...COMMON_PARAMS(28, 0),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 p = tl(uv) / PX(u_size);
  vec2 cid; float edge;
  voronoi(p, cid, edge);
  e = (1.0 - smoothstep(0.0, 0.04, edge)) * u_crack / 100.0 * 3.0;
  return (hash22(cid * 1.3) - 0.5) * 2.0;
}`);

const vitrine: StyleDef = {
  id: 'vitrine',
  name: 'Vitrine',
  category: 'glass',
  tags: ['organic', 'color'],
  icon: '▦',
  params: [
    range('size', 'Cell Size', 10, 200, 46, { unit: 'px' }),
    range('lead', 'Lead Width', 0, 30, 9, { unit: '%' }),
    color('leadC', 'Lead Color', '#121212'),
    range('saturation', 'Saturation', 0, 250, 160, { unit: '%' }),
    range('light', 'Back Light', 0, 100, 55, { unit: '%' }),
    range('texture', 'Glass Texture', 0, 100, 40, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv) / s;
  vec2 cid; float edge;
  vec2 r = voronoi(p, cid, edge);
  vec3 c = Sc(fromTl((cid + hash22(cid)) * s));
  c = clamp(mix(vec3(luma(c)), c, u_saturation / 100.0), 0.0, 1.0);
  float L = 4.0; c = floor(c * L + 0.5) / L;
  c *= 0.7 + u_light / 100.0 * (0.6 - length(r) * 0.5);
  c *= 1.0 - u_texture / 100.0 * 0.25 * (vnoise(p * 9.0) - 0.5) * 2.0;
  float lead = smoothstep(u_lead / 100.0, u_lead / 100.0 + 1.5 / s, edge);
  return vec4(mix(u_leadC, c, lead), 1.0);
}`,
};

const orb = glass('glass-orb', 'Glass Orb', '⬤', ['color', 'organic'], [
  range('radius', 'Radius', 5, 100, 38, { unit: '%' }),
  ...center(),
  range('dim', 'Dim Outside', 0, 100, 35, { unit: '%' }),
  toggle('follow', 'Follow Cursor'),
  ...COMMON_PARAMS(110, 0),
], /* glsl */ `
vec2 orbC(){ return u_follow > 0.5 ? u_mouse : ctr(); }
vec2 glassN(vec2 uv, out float e){
  vec2 d = (uv - orbC()) * vec2(aspect(), 1.0);
  float R = u_radius / 100.0 * 0.5;
  float r = length(d) / R;
  e = 0.0;
  if (r >= 1.0) return vec2(0.0);
  float z = sqrt(1.0 - r * r);
  e = smoothstep(0.9, 1.0, r) * 2.0;
  return -normalize(d + 1e-5) * r * (1.0 + (1.0 - z) * 3.0) * vec2(1.0, -1.0) * 0.5;
}`);
orb.glsl = orb.glsl.replace('return vec4(glassColor(uv, n, e), 1.0); }', `vec3 c = glassColor(uv, n, e);
  vec2 d = (uv - orbC()) * vec2(aspect(), 1.0);
  float R = u_radius / 100.0 * 0.5;
  float r = length(d) / R;
  if (r >= 1.0){ c = Sc(uv) * (1.0 - u_dim / 100.0); float sh = exp(-(r - 1.0) * 12.0); c *= 1.0 - sh * 0.35; }
  return vec4(c, 1.0); }`);

const fluted = glass('fluted-glass', 'Fluted Glass', '⦀', ['color', 'organic'], [
  range('width', 'Flute Width', 4, 120, 22, { unit: 'px' }),
  range('angle', 'Angle', -90, 90, 0, { unit: '°' }),
  range('profile', 'Profile', 0, 100, 50, { unit: '%' }),
  ...COMMON_PARAMS(26, 1.5),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 p = rot2(radians(u_angle)) * tl(uv);
  float x = fract(p.x / PX(u_width)) * 2.0 - 1.0;
  float k = mix(x, sin(x * PI * 0.5), u_profile / 100.0);
  e = smoothstep(0.85, 1.0, abs(x)) * 0.6;
  vec2 n = vec2(k, 0.0);
  return rot2(-radians(u_angle)) * n * 1.4;
}`);

const crossReeded = glass('cross-reeded', 'Cross Reeded', '▦', ['geometric', 'dense'], [
  range('width', 'Reed Size', 4, 120, 18, { unit: 'px' }),
  ...COMMON_PARAMS(18, 1),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 f = fract(tl(uv) / PX(u_width)) * 2.0 - 1.0;
  e = smoothstep(0.85, 1.0, max(abs(f.x), abs(f.y))) * 0.5;
  return vec2(sin(f.x * PI * 0.5), -sin(f.y * PI * 0.5)) * 1.2;
}`);

const hammered = glass('hammered', 'Hammered', '▨', ['organic', 'dense'], [
  range('scale', 'Dent Size', 4, 120, 30, { unit: 'px' }),
  ...COMMON_PARAMS(22, 0),
], /* glsl */ `
float hh(vec2 p){ vec2 cid; float ed; vec2 r = voronoi(p, cid, ed); return 1.0 - dot(r, r) * 1.6; }
vec2 glassN(vec2 uv, out float e){
  vec2 p = tl(uv) / PX(u_scale);
  float eps = 0.02;
  float h = hh(p);
  e = 0.0;
  return vec2(hh(p + vec2(eps, 0.0)) - h, -(hh(p + vec2(0.0, eps)) - h)) / eps * 0.12;
}`);

const diamondGlass = glass('diamond-glass', 'Diamond Glass', '◆', ['geometric', 'color'], [
  range('size', 'Facet Size', 6, 160, 36, { unit: 'px' }),
  ...COMMON_PARAMS(24, 0),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 p = rot2(0.785398) * tl(uv) / PX(u_size);
  vec2 f = fract(p) - 0.5;
  vec2 n = abs(f.x) > abs(f.y) ? vec2(sign(f.x), 0.0) : vec2(0.0, sign(f.y));
  e = (1.0 - smoothstep(0.0, 0.03, abs(abs(f.x) - abs(f.y)))) * 0.8 + smoothstep(0.47, 0.5, max(abs(f.x), abs(f.y)));
  n = rot2(-0.785398) * n;
  return vec2(n.x, -n.y) * 0.9;
}`);

const hexGlass = glass('hexagon-glass', 'Hexagon', '⬡', ['geometric', 'minimal'], [
  range('size', 'Hex Size', 6, 160, 30, { unit: 'px' }),
  ...COMMON_PARAMS(20, 0),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 hid; vec2 h = hexCell(tl(uv) / PX(u_size), hid);
  float d = sdHex(h.yx, 0.5);
  e = smoothstep(-0.04, 0.0, d) * 1.2;
  return vec2(h.x, -h.y) * 2.0 * smoothstep(-0.5, 0.0, d);
}`);

const rippleGlass = glass('ripple-glass', 'Ripple', '◎', ['organic', 'minimal'], [
  range('freq', 'Frequency', 2, 80, 24),
  ...center(),
  toggle('animate', 'Animate', true),
  ...COMMON_PARAMS(16, 0),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 d = (uv - ctr()) * vec2(aspect(), 1.0);
  float r = length(d);
  float t = u_animate > 0.5 ? u_time * 3.0 : 0.0;
  float w = cos(r * u_freq * 6.0 - t) * exp(-r * 1.5);
  e = 0.0;
  return normalize(d + 1e-5) * w * vec2(1.0, -1.0);
}`);

const ice = glass('ice-crackle', 'Ice Crackle', '❄', ['organic', 'dense'], [
  range('size', 'Crack Size', 10, 300, 70, { unit: 'px' }),
  range('crack', 'Crack Brightness', 0, 100, 70, { unit: '%' }),
  ...COMMON_PARAMS(8, 4, '#d8f0ff', 25),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 p = tl(uv) / PX(u_size);
  vec2 cid; float edge;
  voronoi(p + fbm(p * 2.0) * 0.4, cid, edge);
  vec2 cid2; float edge2;
  voronoi(p * 2.7 + 3.0, cid2, edge2);
  e = ((1.0 - smoothstep(0.0, 0.03, edge)) + (1.0 - smoothstep(0.0, 0.02, edge2)) * 0.4) * u_crack / 100.0 * 3.0;
  return (hash22(cid) - 0.5) * 1.2;
}`);

const chevron = glass('chevron-prism', 'Chevron Prism', '∧', ['geometric', 'color'], [
  range('width', 'Stripe Width', 4, 120, 24, { unit: 'px' }),
  range('zig', 'Zig Size', 10, 400, 80, { unit: 'px' }),
  ...COMMON_PARAMS(20, 0),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 p = tl(uv);
  float z = abs(fract(p.x / PX(u_zig)) - 0.5) * PX(u_zig);
  float y = fract((p.y + z) / PX(u_width)) * 2.0 - 1.0;
  e = smoothstep(0.8, 1.0, abs(y)) * 0.6;
  return vec2(0.0, -y) * 1.3;
}`);
chevron.params = chevron.params.map((p) => (p.key === 'dispersion' ? { ...p, default: 90 } : p)) as ParamDef[];

const bubbles = glass('seedy-bubbles', 'Seedy Bubbles', '⁙', ['organic', 'minimal'], [
  range('size', 'Bubble Size', 4, 80, 18, { unit: 'px' }),
  range('density', 'Density', 0, 100, 55, { unit: '%' }),
  ...COMMON_PARAMS(30, 0),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  float s = PX(u_size) * 2.5;
  vec2 p = tl(uv) / s;
  vec2 ip = floor(p);
  e = 0.0;
  vec2 n = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = ip + vec2(float(i), float(j));
    if (hash12(id * 2.3) > u_density / 100.0) continue;
    vec2 c = id + hash22(id);
    float r = 0.12 + 0.3 * hash12(id + 5.0);
    vec2 d = p - c;
    float k = length(d) / r;
    if (k < 1.0){ n = -d / r * 1.5; e = smoothstep(0.8, 1.0, k) * 1.5; }
  }
  return n * vec2(1.0, -1.0);
}`);

const glassPixel = glass('glass-pixel', 'Glass Pixel', '▩', ['geometric', 'retro'], [
  range('size', 'Block Size', 6, 120, 28, { unit: 'px' }),
  range('bevel', 'Bevel', 1, 50, 20, { unit: '%' }),
  ...COMMON_PARAMS(0, 0),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 f = fract(tl(uv) / PX(u_size)) - 0.5;
  float b = u_bevel / 100.0 * 0.5;
  e = smoothstep(0.5 - b, 0.5, max(abs(f.x), abs(f.y)));
  return vec2(f.x, -f.y) * 2.0 * e;
}`);
glassPixel.glsl = glassPixel.glsl.replace('vec2 off = n * PX(u_strength) / u_res * vec2(1.0, -1.0);', `vec2 bs = vec2(PX(u_size));
  vec2 bid = floor(tl(uv) / bs);
  vec2 bf = fract(tl(uv) / bs) - 0.5;
  vec2 target = fromTl((bid + 0.5 - bf * 0.6) * bs);
  vec2 off = target - uv + n * PX(u_strength) / u_res * vec2(1.0, -1.0);`);

const jello = glass('jello', 'Jello', '◍', ['organic', 'color'], [
  range('wobble', 'Wobble', 0, 100, 50, { unit: '%' }),
  range('scale', 'Scale', 1, 100, 20),
  ...COMMON_PARAMS(30, 0, '#ff5fa2', 20),
], /* glsl */ `
vec2 glassN(vec2 uv, out float e){
  vec2 p = uv * u_scale * 0.25;
  float t = u_time * (0.5 + u_wobble / 100.0);
  vec2 n = vec2(sin(p.y * 3.0 + t * 2.0) + sin(p.x * 1.7 + p.y * 2.3 - t), cos(p.x * 2.6 - t * 1.6) + sin(p.x * 1.1 - p.y * 2.9 + t)) * 0.5;
  e = 0.0;
  return n * u_wobble / 100.0 * 1.5;
}`, { animated: true });

export const GLASS_STYLES: StyleDef[] = [
  frosted, tinted, shatter, vitrine, orb, fluted, crossReeded, hammered, diamondGlass, hexGlass, rippleGlass, ice, chevron, bubbles, glassPixel, jello,
];
