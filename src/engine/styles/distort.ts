import type { StyleDef } from '../types';
import { range, toggle, select, center } from './shared';

const MIRROR = /* glsl */ `vec2 mirror(vec2 uv){ return 1.0 - abs(1.0 - mod(uv, 2.0)); }`;

function distort(id: string, name: string, icon: string, tags: string[], params: StyleDef['params'], body: string): StyleDef {
  return {
    id, name, icon, tags, category: 'distort', params,
    glsl: `${MIRROR}\n${body}`,
  };
}

const smudge = distort('smudge', 'Smudge', '〰', ['organic', 'color'], [
  range('amount', 'Amount', 0, 100, 45, { unit: '%' }),
  range('scale', 'Scale', 1, 100, 30),
  range('angle', 'Direction', 0, 360, 0, { unit: '°' }),
  range('length', 'Smear Length', 1, 100, 40, { unit: 'px' }),
  toggle('animate', 'Animate', false),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv) / u_res.y;
  float t = u_animate > 0.5 ? u_time * 0.2 : 0.0;
  float n = fbm(p * u_scale * 0.15 + t);
  vec2 dir = rot2(radians(u_angle) + (n - 0.5) * 3.0) * vec2(1.0, 0.0);
  float len = PX(u_length) * u_amount / 100.0 * smoothstep(0.3, 0.7, n + 0.2);
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 16; i++){
    float k = float(i) / 15.0;
    float w = 1.0 - k * 0.7;
    acc += Sc(mirror(uv + dir * len * k / u_res * vec2(1.0, -1.0))) * w; ws += w;
  }
  return vec4(acc / ws, 1.0);
}`);

const pinch = distort('pinch', 'Pinch', '⊙', ['geometric', 'minimal'], [
  range('amount', 'Amount', -100, 100, 60, { unit: '%' }),
  range('radius', 'Radius', 5, 150, 70, { unit: '%' }),
  ...center(),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = ctr();
  vec2 d = (uv - c) * vec2(aspect(), 1.0);
  float R = u_radius / 100.0 * 0.6;
  float r = length(d);
  if (r < R){
    float k = r / R;
    float f = pow(k, 1.0 + u_amount / 100.0 * 0.9);
    d *= f / max(k, 1e-4);
  }
  return S(mirror(c + d / vec2(aspect(), 1.0)));
}`);

const spherize = distort('spherize', 'Spherize', '◍', ['geometric', 'minimal'], [
  range('amount', 'Amount', -100, 100, 70, { unit: '%' }),
  range('radius', 'Radius', 5, 150, 60, { unit: '%' }),
  ...center(),
  toggle('edge', 'Lens Edge', true),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = ctr();
  vec2 d = (uv - c) * vec2(aspect(), 1.0);
  float R = u_radius / 100.0 * 0.6;
  float r = length(d);
  vec3 col;
  if (r < R){
    float k = r / R;
    float z = sqrt(max(1.0 - k * k, 0.0));
    float amt = u_amount / 100.0;
    float nk = amt >= 0.0 ? mix(k, asin(k) / (PI * 0.5), amt) : mix(k, k * k, -amt);
    vec2 nd = d * nk / max(k, 1e-4);
    col = Sc(mirror(c + nd / vec2(aspect(), 1.0)));
    if (u_edge > 0.5) col *= 0.75 + 0.25 * z + 0.25 * pow(1.0 - z, 6.0);
  } else col = Sc(uv);
  return vec4(col, 1.0);
}`);

const twirl = distort('twirl', 'Twirl', '◉', ['geometric', 'organic'], [
  range('amount', 'Angle', -720, 720, 240, { unit: '°' }),
  range('radius', 'Radius', 5, 150, 70, { unit: '%' }),
  ...center(),
  toggle('animate', 'Animate'),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = ctr();
  vec2 d = (uv - c) * vec2(aspect(), 1.0);
  float R = u_radius / 100.0 * 0.7;
  float r = length(d);
  float k = clamp(1.0 - r / R, 0.0, 1.0);
  float a = radians(u_amount) * k * k * (u_animate > 0.5 ? sin(u_time * 0.8) : 1.0);
  d = rot2(a) * d;
  return S(mirror(c + d / vec2(aspect(), 1.0)));
}`);

const zigzag = distort('zigzag', 'ZigZag', '⌇', ['geometric', 'organic'], [
  range('amount', 'Amount', 0, 100, 40, { unit: '%' }),
  range('ridges', 'Ridges', 1, 30, 8),
  select('style', 'Style', ['Pond Ripples', 'Around Center', 'Out From Center']),
  ...center(),
  toggle('animate', 'Animate'),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = ctr();
  vec2 d = (uv - c) * vec2(aspect(), 1.0);
  float r = length(d);
  float t = u_animate > 0.5 ? u_time * 2.0 : 0.0;
  float w = sin(r * u_ridges * TAU - t) * u_amount / 100.0 * (1.0 - smoothstep(0.0, 0.8, r));
  int s = int(u_style + 0.5);
  if (s == 0) d = rot2(w * 0.25) * d * (1.0 + w * 0.05);
  else if (s == 1) d = rot2(w * 0.35) * d;
  else d *= 1.0 + w * 0.12;
  return S(mirror(c + d / vec2(aspect(), 1.0)));
}`);

const ripple = distort('ripple', 'Ripple', '≈', ['geometric', 'organic'], [
  range('amount', 'Amplitude', 0, 100, 10, { unit: 'px' }),
  range('freq', 'Frequency', 1, 60, 8),
  select('dir', 'Direction', ['Horizontal', 'Vertical', 'Both']),
  toggle('animate', 'Animate', true),
], /* glsl */ `
vec4 effect(vec2 uv){
  float t = u_animate > 0.5 ? u_time * 2.5 : 0.0;
  vec2 o = vec2(0.0);
  float a = PX(u_amount);
  int d = int(u_dir + 0.5);
  if (d != 1) o.x = sin(uv.y * u_freq * TAU + t) * a;
  if (d != 0) o.y = sin(uv.x * u_freq * TAU * aspect() + t * 1.1) * a;
  return S(mirror(uv + o / u_res));
}`);

const polar = distort('polar', 'Polar', '◎', ['geometric', 'minimal'], [
  select('mode', 'Mode', ['Rect → Polar', 'Polar → Rect']),
  range('rotation', 'Rotation', 0, 360, 0, { unit: '°' }),
  range('zoom', 'Zoom', 50, 200, 100, { unit: '%' }),
  toggle('animate', 'Spin'),
], /* glsl */ `
vec4 effect(vec2 uv){
  float rotA = radians(u_rotation) + (u_animate > 0.5 ? u_time * 0.3 : 0.0);
  if (u_mode < 0.5){
    vec2 d = (uv - 0.5) * vec2(aspect(), 1.0);
    float r = length(d) / 0.5 * 100.0 / u_zoom;
    float a = fract((atan(d.y, d.x) + rotA) / TAU);
    return S(vec2(a, 1.0 - clamp(r, 0.0, 1.0)));
  }
  float a = uv.x * TAU - rotA;
  float r = (1.0 - uv.y) * 0.5 * u_zoom / 100.0;
  vec2 q = vec2(cos(a), sin(a)) * r / vec2(aspect(), 1.0) + 0.5;
  return S(mirror(q));
}`);

const shear = distort('shear', 'Shear', '⇔', ['geometric', 'minimal'], [
  range('amount', 'Amount', -100, 100, 35, { unit: '%' }),
  select('curve', 'Curve', ['Linear', 'Sine', 'S-Curve', 'Wave']),
  select('axis', 'Axis', ['Horizontal', 'Vertical']),
  toggle('wrap', 'Wrap Around', true),
], /* glsl */ `
vec4 effect(vec2 uv){
  float y = u_axis > 0.5 ? uv.x : uv.y;
  int c = int(u_curve + 0.5);
  float s;
  if (c == 0) s = y - 0.5;
  else if (c == 1) s = sin(y * PI) * 0.5;
  else if (c == 2) s = smoothstep(0.0, 1.0, y) - 0.5;
  else s = sin(y * TAU * 2.0) * 0.25;
  vec2 q = uv;
  if (u_axis > 0.5) q.y += s * u_amount / 100.0; else q.x += s * u_amount / 100.0;
  q = u_wrap > 0.5 ? fract(q) : clamp(q, 0.0, 1.0);
  return S(q);
}`);

export const DISTORT_STYLES: StyleDef[] = [smudge, pinch, spherize, twirl, zigzag, ripple, polar, shear];

/* ───────────── Blur & Focus ───────────── */

function blurStyle(id: string, name: string, icon: string, tags: string[], params: StyleDef['params'], body: string): StyleDef {
  return { id, name, icon, tags, category: 'blur', params, glsl: `${body}` };
}

const motionBlur = blurStyle('motion-blur', 'Motion Blur', '⇉', ['minimal', 'organic'], [
  range('distance', 'Distance', 0, 200, 40, { unit: 'px' }),
  range('angle', 'Angle', 0, 360, 0, { unit: '°' }),
  toggle('oneSide', 'Trail Only'),
  range('ghost', 'Ghosting', 0, 100, 0, { unit: '%' }),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * PX(u_distance) / u_res;
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 40; i++){
    float t = float(i) / 39.0;
    float k = u_oneSide > 0.5 ? t : t - 0.5;
    float w = 1.0 + u_ghost / 100.0 * 3.0 * step(0.97, fract(t * 4.0));
    acc += Sc(clamp(uv + dir * k, 0.0, 1.0)) * w; ws += w;
  }
  return vec4(acc / ws, 1.0);
}`);

const tiltShift = blurStyle('tilt-shift', 'Tilt-Shift', '⊙', ['minimal', 'color'], [
  range('blur', 'Blur', 0, 60, 18, { unit: 'px' }),
  range('focus', 'Focus Position', 0, 100, 55, { unit: '%' }),
  range('band', 'Focus Band', 0, 100, 25, { unit: '%' }),
  range('angle', 'Angle', -90, 90, 0, { unit: '°' }),
  range('saturation', 'Saturation', 0, 250, 135, { unit: '%' }),
  range('contrast', 'Contrast', 50, 200, 112, { unit: '%' }),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 n = rot2(radians(u_angle)) * vec2(0.0, 1.0);
  float d = abs(dot(uv - vec2(0.5, 1.0 - u_focus / 100.0), n));
  float band = u_band / 200.0;
  float r = PX(u_blur) * smoothstep(band, band + 0.25, d);
  vec3 acc = vec3(0.0);
  float ga = 2.39996323;
  for (int i = 0; i < 40; i++){
    float fi = float(i) + 0.5;
    vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * sqrt(fi / 40.0) * r / u_res;
    acc += Sc(uv + o);
  }
  vec3 c = acc / 40.0;
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  c = (c - 0.5) * u_contrast / 100.0 + 0.5;
  return vec4(clamp(c, 0.0, 1.0), 1.0);
}`);

const gaussian = blurStyle('gaussian-blur', 'Gaussian Blur', '◍', ['minimal', 'organic'], [
  range('radius', 'Radius', 0, 80, 12, { unit: 'px' }),
  range('glow', 'Soft Glow', 0, 100, 0, { unit: '%' }),
], /* glsl */ `
vec4 effect(vec2 uv){
  float r = PX(u_radius);
  vec3 acc = vec3(0.0); float ws = 0.0;
  float ga = 2.39996323;
  for (int i = 0; i < 64; i++){
    float fi = float(i) + 0.5;
    float k = sqrt(fi / 64.0);
    float w = exp(-k * k * 2.0);
    vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * k * r / u_res;
    acc += Sc(uv + o) * w; ws += w;
  }
  vec3 b = acc / ws;
  vec3 c = mix(b, 1.0 - (1.0 - b) * (1.0 - Sc(uv)), u_glow / 100.0);
  return vec4(c, 1.0);
}`);

const radialBlur = blurStyle('radial-blur', 'Radial Blur', '◎', ['minimal', 'organic'], [
  select('mode', 'Mode', ['Zoom', 'Spin']),
  range('amount', 'Amount', 0, 100, 30, { unit: '%' }),
  ...center(),
  range('clear', 'Clear Center', 0, 100, 20, { unit: '%' }),
], /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = ctr();
  vec2 d = uv - c;
  float k = smoothstep(u_clear / 200.0, u_clear / 200.0 + 0.3, length(d * vec2(aspect(), 1.0)));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 40; i++){
    float t = float(i) / 39.0 - 0.5;
    vec2 q;
    if (u_mode < 0.5) q = c + d * (1.0 + t * u_amount / 100.0 * 0.4 * k);
    else { vec2 dd = d * vec2(aspect(), 1.0); dd = rot2(t * u_amount / 100.0 * 0.6 * k) * dd; q = c + dd / vec2(aspect(), 1.0); }
    acc += Sc(clamp(q, 0.0, 1.0));
  }
  return vec4(acc / 40.0, 1.0);
}`);

export const BLUR_STYLES: StyleDef[] = [motionBlur, tiltShift, gaussian, radialBlur];
