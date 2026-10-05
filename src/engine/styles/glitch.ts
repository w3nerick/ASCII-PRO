import type { StyleDef } from '../types';
import { range, toggle, select, color, center } from './shared';
import { THERMAL_OPTIONS } from '../palettes';

const crt: StyleDef = {
  id: 'crt-screen',
  name: 'CRT Screen',
  category: 'glitch',
  tags: ['retro', 'color'],
  icon: '▓',
  params: [
    range('curvature', 'Curvature', 0, 100, 45, { unit: '%' }),
    select('mask', 'Mask', ['Aperture Grille', 'Shadow Mask', 'Slot Mask', 'None']),
    range('maskSize', 'Dot Pitch', 1, 8, 2, { unit: 'px' }),
    range('scan', 'Scanlines', 0, 100, 55, { unit: '%' }),
    range('bleed', 'Color Bleed', 0, 100, 35, { unit: '%' }),
    range('glow', 'Phosphor Glow', 0, 100, 40, { unit: '%' }),
    range('noise', 'Noise', 0, 100, 15, { unit: '%' }),
    toggle('roll', 'Rolling Bar', true),
    toggle('flicker', 'Flicker'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float k = u_curvature / 100.0;
  c *= 1.0 + k * 0.18 * vec2(c.y * c.y, c.x * c.x);
  vec2 q = c * 0.5 + 0.5;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float b = PX(u_bleed / 100.0 * 3.0) / u_res.x;
  vec3 col = vec3(Sc(q + vec2(b, 0.0)).r, Sc(q).g, Sc(q - vec2(b, 0.0)).b);
  vec3 gl = (Sc(q + vec2(3.0, 0.0) / u_res) + Sc(q - vec2(3.0, 0.0) / u_res) + Sc(q + vec2(0.0, 3.0) / u_res) + Sc(q - vec2(0.0, 3.0) / u_res)) * 0.25;
  col += gl * u_glow / 100.0 * 0.45;
  vec2 px = tl(q);
  float lineH = PX(u_maskSize) * 1.5;
  float sl = 0.5 + 0.5 * cos(px.y / lineH * TAU);
  col *= 1.0 - u_scan / 100.0 * 0.55 * (1.0 - sl);
  int m = int(u_mask + 0.5);
  float ms = PX(u_maskSize);
  if (m < 3){
    float xi = floor(px.x / ms);
    float yi = floor(px.y / ms);
    float sel = mod(xi + (m == 1 ? mod(yi, 2.0) * 1.5 : 0.0), 3.0);
    vec3 msk = sel < 1.0 ? vec3(1.0, 0.35, 0.35) : sel < 2.0 ? vec3(0.35, 1.0, 0.35) : vec3(0.35, 0.35, 1.0);
    if (m == 2) msk *= mix(0.6, 1.0, step(0.5, fract((px.y + (mod(floor(xi / 3.0), 2.0)) * ms * 2.0) / (ms * 4.0)) ));
    col *= mix(vec3(1.0), msk * 1.5, 0.55);
  }
  if (u_roll > 0.5){ float ry = fract(q.y - u_time * 0.08); col *= 1.0 + 0.07 * smoothstep(0.0, 0.04, ry) * smoothstep(0.16, 0.04, ry); }
  if (u_flicker > 0.5) col *= 0.95 + 0.05 * hash11(floor(u_time * 30.0));
  col += (hash12(px + floor(u_time * 30.0)) - 0.5) * u_noise / 100.0 * 0.25;
  float vig = smoothstep(1.35, 0.6, length(c * vec2(0.9, 1.0)));
  col *= vig;
  float edge = max(abs(c.x), abs(c.y));
  col *= smoothstep(1.0, 0.985 - k * 0.01, edge);
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const pixelSort: StyleDef = {
  id: 'pixel-sort',
  name: 'Pixel Sort',
  category: 'glitch',
  tags: ['glitch', 'color'],
  icon: '▧',
  params: [
    select('dir', 'Direction', ['Down', 'Up', 'Right', 'Left']),
    range('low', 'Threshold Low', 0, 100, 25, { unit: '%' }),
    range('high', 'Threshold High', 0, 100, 90, { unit: '%' }),
    range('length', 'Max Length', 10, 400, 160, { unit: 'px' }),
    select('sortBy', 'Sort By', ['Brightness', 'Hue', 'Saturation']),
    toggle('reverse', 'Reverse Order'),
  ],
  glsl: /* glsl */ `
float key(vec3 c){
  int s = int(u_sortBy + 0.5);
  if (s == 1) return rgb2hsv(c).x;
  if (s == 2) return rgb2hsv(c).y;
  return luma(c);
}
bool inSpan(vec3 c){ float l = luma(c); return l >= u_low / 100.0 && l <= u_high / 100.0; }
vec4 effect(vec2 uv){
  int d = int(u_dir + 0.5);
  vec2 dir = d == 0 ? vec2(0.0, -1.0) : d == 1 ? vec2(0.0, 1.0) : d == 2 ? vec2(1.0, 0.0) : vec2(-1.0, 0.0);
  vec3 self = Sc(uv);
  if (!inSpan(self)) return vec4(self, 1.0);
  float stepPx = PX(u_length) / 32.0;
  vec2 st = dir * stepPx / u_res;
  float back = 0.0, fwd = 0.0;
  vec3 lo = self, hi = self; float klo = key(self), khi = klo;
  for (int i = 1; i <= 32; i++){
    vec2 q = uv - st * float(i);
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) break;
    vec3 c = Sc(q);
    if (!inSpan(c)) break;
    back += 1.0;
    float k = key(c); if (k < klo){ klo = k; lo = c; } if (k > khi){ khi = k; hi = c; }
  }
  for (int i = 1; i <= 32; i++){
    vec2 q = uv + st * float(i);
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) break;
    vec3 c = Sc(q);
    if (!inSpan(c)) break;
    fwd += 1.0;
    float k = key(c); if (k < klo){ klo = k; lo = c; } if (k > khi){ khi = k; hi = c; }
  }
  float t = back / max(back + fwd, 1.0);
  if (u_reverse > 0.5) t = 1.0 - t;
  vec3 col = mix(lo, hi, smoothstep(0.0, 1.0, t));
  return vec4(col, 1.0);
}`,
};

const forensics: StyleDef = {
  id: 'forensics',
  name: 'Forensics',
  category: 'glitch',
  tags: ['mono', 'color'],
  icon: '⊚',
  params: [
    select('mode', 'Analysis', ['Error Level', 'Edge Map', 'Noise Map', 'Luminance Gradient']),
    range('gain', 'Gain', 1, 100, 35),
    toggle('blocks', 'JPEG Grid', true),
    toggle('falseColor', 'False Color', true),
    range('mixImg', 'Image Mix', 0, 100, 10, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 px = 1.0 / u_res;
  vec3 c = Sc(uv);
  vec3 b = (Sc(uv + vec2(px.x, 0.0)) + Sc(uv - vec2(px.x, 0.0)) + Sc(uv + vec2(0.0, px.y)) + Sc(uv - vec2(0.0, px.y))) * 0.25;
  int m = int(u_mode + 0.5);
  float v;
  if (m == 0) v = length(c - b) * u_gain * 0.6;
  else if (m == 1) v = sobel(uv, 1.0).z * u_gain * 0.08;
  else if (m == 2) v = abs(luma(c) - luma(b)) * u_gain * 1.2 + hash12(uv * u_res) * 0.02;
  else { vec3 g = sobel(uv, 2.0); v = length(g.xy) * u_gain * 0.05; }
  v = clamp(v, 0.0, 1.0);
  vec3 col = u_falseColor > 0.5 ? (v < 0.33 ? mix(vec3(0.0, 0.0, 0.15), vec3(0.0, 0.4, 1.0), v * 3.0) : v < 0.66 ? mix(vec3(0.0, 0.4, 1.0), vec3(0.1, 1.0, 0.3), (v - 0.33) * 3.0) : mix(vec3(0.1, 1.0, 0.3), vec3(1.0, 0.95, 0.2), (v - 0.66) * 3.0)) : vec3(v);
  col = mix(col, c, u_mixImg / 100.0);
  if (u_blocks > 0.5){ vec2 f = mod(tl(uv), 8.0 * max(u_k, 0.5)); col += 0.05 * (1.0 - step(max(u_k, 0.75), min(f.x, f.y))); }
  return vec4(col, 1.0);
}`,
};

const digital: StyleDef = {
  id: 'digital-distortion',
  name: 'Digital Distortion',
  category: 'glitch',
  tags: ['glitch', 'color'],
  icon: '▒',
  alwaysAnimated: true,
  params: [
    range('amount', 'Amount', 0, 100, 50, { unit: '%' }),
    range('block', 'Block Size', 4, 120, 32, { unit: 'px' }),
    range('shift', 'Channel Shift', 0, 60, 10, { unit: 'px' }),
    range('speed', 'Speed', 0, 100, 50, { unit: '%' }),
    range('crush', 'Color Crush', 0, 100, 30, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float t = floor(u_time * (2.0 + u_speed / 100.0 * 18.0));
  vec2 p = tl(uv);
  float bs = PX(u_block);
  vec2 bid = floor(p / vec2(bs * 2.0, bs * 0.5));
  float r = hash12(bid + t * 1.3);
  float a = u_amount / 100.0;
  vec2 q = uv;
  if (r < a * 0.45) q.x += (hash12(bid * 2.1 + t) - 0.5) * a * 0.25;
  if (r < a * 0.12) q = (floor(q * u_res / bs) + 0.5) * bs / u_res;
  float sh = PX(u_shift) * (hash12(vec2(t, 7.0)) > 0.5 ? 1.0 : -1.0) * a / u_res.x;
  vec3 col = vec3(Sc(q + vec2(sh, 0.0)).r, Sc(q).g, Sc(q - vec2(sh, 0.0)).b);
  float lv = mix(256.0, 4.0, u_crush / 100.0 * step(r, a * 0.6));
  col = floor(col * lv) / lv;
  if (hash12(vec2(floor(p.y / (bs * 0.25)), t)) < a * 0.04) col = vec3(hash12(bid + t), hash12(bid + t + 1.0), hash12(bid + t + 2.0));
  return vec4(col, 1.0);
}`,
};

const datamosh: StyleDef = {
  id: 'datamosh',
  name: 'Datamosh',
  category: 'glitch',
  tags: ['glitch', 'color'],
  icon: '▞',
  feedback: true,
  alwaysAnimated: true,
  params: [
    range('melt', 'Melt', 0, 100, 70, { unit: '%' }),
    range('block', 'Macroblock', 4, 64, 16, { unit: 'px' }),
    range('motion', 'Motion', 0, 100, 40, { unit: '%' }),
    range('refresh', 'Keyframe Refresh', 0, 100, 4, { unit: '%' }),
    toggle('bleed', 'Color Bleed', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float bs = PX(u_block);
  vec2 bid = floor(p / bs);
  float t = floor(u_time * 6.0);
  vec2 mv = (vec2(vnoise(bid * 0.21 + t * 0.07), vnoise(bid * 0.21 + 9.0 + t * 0.05)) - 0.5) * u_motion / 100.0 * bs * 0.8;
  vec2 prevUv = uv - vec2(mv.x, -mv.y) / u_res;
  vec4 prev = texture(u_prev, prevUv);
  vec3 cur = Sc(uv);
  float key = step(hash12(bid + t * 0.37), u_refresh / 100.0);
  float keep = u_melt / 100.0 * (1.0 - key);
  if (prev.a < 0.01) keep = 0.0;
  vec3 col = mix(cur, prev.rgb, keep * 0.985);
  if (u_bleed > 0.5){ vec3 c2 = texture(u_prev, prevUv + vec2(mv.x, 0.0) / u_res).rgb; col = mix(col, vec3(col.r, c2.g, col.b), keep * 0.3); }
  return vec4(col, 1.0);
}`,
};

const lofi: StyleDef = {
  id: 'lofi',
  name: 'Lofi',
  category: 'glitch',
  tags: ['retro', 'color'],
  icon: '▒',
  params: [
    range('downsample', 'Downsample', 1, 12, 3, { unit: '×' }),
    range('chroma', 'Chroma Subsample', 1, 8, 3, { unit: '×' }),
    range('colors', 'Bit Depth', 2, 8, 5, { unit: 'bit' }),
    range('blocks', 'JPEG Blocks', 0, 100, 35, { unit: '%' }),
    range('noise', 'Noise', 0, 100, 25, { unit: '%' }),
    range('warmth', 'Warmth', -100, 100, 20, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec3 toYuv(vec3 c){ return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(-0.147, -0.289, 0.436)), dot(c, vec3(0.615, -0.515, -0.1))); }
vec3 toRgb(vec3 y){ return vec3(y.x + 1.14 * y.z, y.x - 0.395 * y.y - 0.581 * y.z, y.x + 2.032 * y.y); }
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float r = PX(u_downsample);
  vec2 lid = floor(p / r);
  vec3 lum = toYuv(Sc(fromTl((lid + 0.5) * r)));
  float cr = r * u_chroma;
  vec3 ch = toYuv(Sc(fromTl((floor(p / cr) + 0.5) * cr)));
  vec3 yuv = vec3(lum.x, ch.yz);
  float bs = r * 8.0;
  vec2 bid = floor(p / bs);
  vec3 bavg = toYuv(cellAvg(bid, vec2(bs)));
  yuv = mix(yuv, vec3(mix(yuv.x, bavg.x, 0.5), bavg.yz), u_blocks / 100.0 * 0.6);
  vec3 col = toRgb(yuv);
  float lv = pow(2.0, u_colors);
  col = floor(col * lv + 0.5) / lv;
  col += (hash12(lid + floor(u_time * 15.0)) - 0.5) * u_noise / 100.0 * 0.2;
  col += vec3(0.06, 0.02, -0.06) * u_warmth / 100.0;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const rgbSplit: StyleDef = {
  id: 'rgb-split',
  name: 'RGB Split',
  category: 'glitch',
  tags: ['glitch', 'color'],
  icon: '◐',
  params: [
    range('amount', 'Offset', 0, 80, 12, { unit: 'px' }),
    range('angle', 'Angle', 0, 360, 0, { unit: '°' }),
    select('mode', 'Mode', ['Linear', 'Radial', 'Jitter']),
    range('screenMix', 'Screen Blend', 0, 100, 0, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  int m = int(u_mode + 0.5);
  vec2 d = vec2(cos(radians(u_angle)), sin(radians(u_angle))) * PX(u_amount) / u_res;
  if (m == 1) d = (uv - 0.5) * PX(u_amount) / u_res.y * 2.0;
  if (m == 2) d *= (hash11(floor(u_time * 14.0)) - 0.5) * 3.0;
  vec3 col = vec3(Sc(uv + d).r, Sc(uv).g, Sc(uv - d).b);
  vec3 scr = 1.0 - (1.0 - Sc(uv + d) * vec3(1.0, 0.0, 0.0)) * (1.0 - Sc(uv) * vec3(0.0, 1.0, 0.0)) * (1.0 - Sc(uv - d) * vec3(0.0, 0.0, 1.0));
  return vec4(mix(col, scr, u_screenMix / 100.0), 1.0);
}`,
};

const scanline: StyleDef = {
  id: 'scanline',
  name: 'Scanline',
  category: 'glitch',
  tags: ['retro', 'glitch'],
  icon: '☰',
  params: [
    range('spacing', 'Line Spacing', 2, 20, 4, { unit: 'px' }),
    range('thickness', 'Thickness', 5, 95, 45, { unit: '%' }),
    range('darkness', 'Darkness', 0, 100, 70, { unit: '%' }),
    range('jitter', 'Horizontal Jitter', 0, 100, 15, { unit: '%' }),
    range('brightness', 'Brightness', 50, 200, 120, { unit: '%' }),
    toggle('vertical', 'Vertical Lines'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float s = PX(u_spacing);
  float coord = u_vertical > 0.5 ? p.x : p.y;
  float line = floor(coord / s);
  vec2 q = uv;
  float j = (hash12(vec2(line, floor(u_time * 20.0))) - 0.5) * u_jitter / 100.0 * 0.01;
  if (u_vertical > 0.5) q.y += j; else q.x += j;
  vec3 col = Sc(q) * u_brightness / 100.0;
  float f = fract(coord / s);
  float m = smoothstep(u_thickness / 100.0 - 0.1, u_thickness / 100.0 + 0.1, f);
  col *= 1.0 - m * u_darkness / 100.0;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const thermal: StyleDef = {
  id: 'thermal',
  name: 'Thermal',
  category: 'glitch',
  tags: ['color', 'glitch'],
  icon: '◉',
  params: [
    { key: 'thermal', label: 'Palette', type: 'select', options: THERMAL_OPTIONS, default: 0, noUniform: true },
    range('blur', 'Sensor Blur', 0, 20, 3, { unit: 'px' }),
    range('gain', 'Gain', 50, 250, 120, { unit: '%' }),
    range('offset', 'Level', -50, 50, 0, { unit: '%' }),
    range('noise', 'Sensor Noise', 0, 100, 20, { unit: '%' }),
    toggle('hud', 'HUD Overlay', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float r = PX(u_blur);
  float l = 0.0;
  float ga = 2.39996323;
  for (int i = 0; i < 16; i++){
    float fi = float(i) + 0.5;
    vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * sqrt(fi / 16.0) * r / u_res;
    l += Sl(uv + o);
  }
  l /= 16.0;
  l = clamp((l - 0.5) * u_gain / 100.0 + 0.5 + u_offset / 100.0, 0.0, 1.0);
  l += (hash12(tl(uv) + floor(u_time * 24.0)) - 0.5) * u_noise / 100.0 * 0.08;
  vec3 col = gradMap(l);
  if (u_hud > 0.5){
    vec2 p = tl(uv) - u_res * 0.5;
    float w = max(u_k, 1.0);
    float ch = (step(abs(p.x), w) * step(abs(p.y), 18.0 * w) * step(5.0 * w, abs(p.y))) + (step(abs(p.y), w) * step(abs(p.x), 18.0 * w) * step(5.0 * w, abs(p.x)));
    vec2 e = min(tl(uv), u_res - tl(uv));
    float corner = step(e.x, 24.0 * w) * step(e.y, 24.0 * w) * (1.0 - step(2.5 * w, min(e.x, e.y))) * step(10.0 * w, max(e.x, e.y));
    col = mix(col, vec3(1.0), clamp(ch + corner, 0.0, 1.0) * 0.85);
  }
  return vec4(col, 1.0);
}`,
};

const beacon: StyleDef = {
  id: 'beacon',
  name: 'Beacon',
  category: 'glitch',
  tags: ['color', 'dense'],
  icon: '✦',
  params: [
    range('intensity', 'Ray Intensity', 0, 200, 60, { unit: '%' }),
    range('threshold', 'Threshold', 0, 100, 72, { unit: '%' }),
    range('length', 'Ray Length', 5, 100, 45, { unit: '%' }),
    ...center(),
    toggle('follow', 'Follow Cursor'),
    color('tint', 'Tint', '#fff2d6'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = u_follow > 0.5 ? u_mouse : ctr();
  vec2 d = (uv - c) * u_length / 100.0 / 40.0;
  vec2 q = uv;
  vec3 acc = vec3(0.0);
  float decay = 1.0;
  for (int i = 0; i < 40; i++){
    q -= d;
    vec3 s = Sc(clamp(q, 0.0, 1.0));
    acc += s * smoothstep(u_threshold / 100.0, u_threshold / 100.0 + 0.2, luma(s)) * decay;
    decay *= 0.965;
  }
  acc /= 40.0;
  vec3 col = Sc(uv) + acc * u_tint * u_intensity / 100.0 * 2.5;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

export const GLITCH_STYLES: StyleDef[] = [crt, pixelSort, forensics, digital, datamosh, lofi, rgbSplit, scanline, thermal, beacon];
