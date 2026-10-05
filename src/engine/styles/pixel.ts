import type { StyleDef } from '../types';
import { paletteParams, range, toggle, select, color } from './shared';
import { PALETTE_ORIGINAL } from '../palettes';

const pixelArt: StyleDef = {
  id: 'pixel-art',
  name: 'Pixel Art',
  category: 'pixel',
  tags: ['retro', 'color'],
  icon: '◧',
  isNew: true,
  params: [
    range('pixelSize', 'Pixel Size', 2, 48, 8, { unit: 'px' }),
    ...paletteParams(7),
    range('levels', 'Levels', 2, 16, 5, { showIf: { palette: [PALETTE_ORIGINAL] } }),
    range('dither', 'Dither', 0, 100, 35, { unit: '%' }),
    range('contrast', 'Contrast', 50, 200, 110, { unit: '%' }),
    range('saturation', 'Saturation', 0, 200, 120, { unit: '%' }),
    range('outline', 'Outline', 0, 100, 0, { unit: '%' }),
    range('grid', 'Grid Lines', 0, 100, 0, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec3 prep(vec3 c){
  c = (c - 0.5) * u_contrast / 100.0 + 0.5;
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  return clamp(c, 0.0, 1.0);
}
vec3 quant(vec3 c, vec2 id){
  float b = (bayer4(id) - 0.47) * u_dither / 100.0;
  if (u_palN == 0){
    float L = max(u_levels - 1.0, 1.0);
    return floor(c * L + 0.5 + b) / L;
  }
  return nearestPal(c + b * 0.35);
}
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_pixelSize));
  vec2 p = tl(uv);
  vec2 id = floor(p / cs);
  vec3 c = prep(cellAvg(id, cs));
  vec3 q = quant(c, id);
  if (u_outline > 0.0){
    float l = luma(c);
    float e = 0.0;
    e = max(e, abs(l - luma(prep(cellAvg(id + vec2(1.0, 0.0), cs)))));
    e = max(e, abs(l - luma(prep(cellAvg(id + vec2(0.0, 1.0), cs)))));
    e = max(e, abs(l - luma(prep(cellAvg(id - vec2(1.0, 0.0), cs)))));
    e = max(e, abs(l - luma(prep(cellAvg(id - vec2(0.0, 1.0), cs)))));
    q = mix(q, q * 0.18, smoothstep(0.12, 0.28, e) * u_outline / 100.0);
  }
  if (u_grid > 0.0){
    vec2 f = fract(p / cs) * cs;
    float g = 1.0 - step(1.0, min(f.x, f.y));
    q *= 1.0 - g * 0.5 * u_grid / 100.0;
  }
  return vec4(q, 1.0);
}`,
};

const mosaic: StyleDef = {
  id: 'mosaic',
  name: 'Mosaic',
  category: 'pixel',
  tags: ['color', 'geometric'],
  icon: '▣',
  params: [
    range('size', 'Tile Size', 4, 64, 16, { unit: 'px' }),
    range('gap', 'Grout', 0, 30, 10, { unit: '%' }),
    color('grout', 'Grout Color', '#141416'),
    range('bevel', 'Bevel', 0, 100, 45, { unit: '%' }),
    range('variation', 'Variation', 0, 100, 20, { unit: '%' }),
    range('round', 'Roundness', 0, 100, 20, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id = floor(p / s);
  vec2 f = fract(p / s) - 0.5;
  vec3 c = cellAvg(id, vec2(s));
  c *= 1.0 + (hash12(id) - 0.5) * u_variation / 100.0 * 0.5;
  float half_ = 0.5 - u_gap / 200.0;
  float r = u_round / 100.0 * half_ * 0.8;
  float d = sdBox(f, vec2(half_ - r)) - r;
  float m = aa(d * s, 1.0);
  vec2 n = f / max(half_, 0.01);
  float edge = smoothstep(0.55, 1.0, max(abs(n.x), abs(n.y)));
  float light = dot(normalize(vec3(n * edge, 1.0)), normalize(vec3(-0.5, 0.6, 0.8)));
  c *= mix(1.0, 0.55 + light * 0.6, u_bevel / 100.0);
  return vec4(mix(u_grout, c, m), 1.0);
}`,
};

const lego: StyleDef = {
  id: 'lego',
  name: 'LEGO',
  category: 'pixel',
  tags: ['color', 'geometric'],
  icon: '▦',
  params: [
    range('size', 'Brick Size', 6, 64, 16, { unit: 'px' }),
    range('stud', 'Stud Size', 20, 90, 62, { unit: '%' }),
    range('shine', 'Shine', 0, 100, 60, { unit: '%' }),
    toggle('legoPalette', 'Brick Palette', true),
    range('saturation', 'Saturation', 0, 200, 115, { unit: '%' }),
  ],
  glsl: /* glsl */ `
const vec3 LP[12] = vec3[12](
  vec3(0.95,0.95,0.93), vec3(0.11,0.11,0.12), vec3(0.79,0.10,0.09), vec3(0.98,0.79,0.05),
  vec3(0.0,0.33,0.75), vec3(0.15,0.55,0.25), vec3(0.98,0.52,0.0), vec3(0.62,0.63,0.62),
  vec3(0.39,0.37,0.37), vec3(0.35,0.71,0.92), vec3(0.83,0.40,0.62), vec3(0.42,0.24,0.16));
vec3 nearestLego(vec3 c){ float bd = 9.0; vec3 b = c; for (int i = 0; i < 12; i++){ vec3 d = c - LP[i]; float dd = dot(d, d); if (dd < bd){ bd = dd; b = LP[i]; } } return b; }
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id = floor(p / s);
  vec2 f = fract(p / s) - 0.5;
  vec3 c = cellAvg(id, vec2(s));
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  if (u_legoPalette > 0.5) c = nearestLego(c);
  float edge = max(abs(f.x), abs(f.y));
  vec3 col = c * (1.0 - smoothstep(0.44, 0.5, edge) * 0.45);
  col *= 1.0 + (f.y < -0.44 ? 0.12 : 0.0) - (f.x > 0.44 ? 0.1 : 0.0);
  float r = u_stud / 200.0;
  vec2 so = f + vec2(0.04, 0.05);
  float shadow = aa((length(so) - r) * s, 1.5);
  col *= 1.0 - shadow * 0.35;
  float d = length(f) - r;
  float stud = aa(d * s, 1.0);
  vec2 n = f / max(r, 0.01);
  float hl = smoothstep(0.2, 1.0, 1.0 - length(n - vec2(-0.35, -0.35))) * u_shine / 100.0;
  float rim = smoothstep(0.75, 1.0, length(n));
  vec3 sc = c * (1.05 - rim * 0.25) + hl * 0.45;
  col = mix(col, sc, stud);
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
};

const voxel: StyleDef = {
  id: 'voxel',
  name: 'Voxel',
  category: 'pixel',
  tags: ['geometric', 'dense'],
  icon: '⬢',
  isNew: true,
  params: [
    range('size', 'Cube Size', 6, 64, 14, { unit: 'px' }),
    range('top', 'Top Light', 50, 160, 118, { unit: '%' }),
    range('left', 'Left Shade', 20, 120, 82, { unit: '%' }),
    range('right', 'Right Shade', 10, 110, 55, { unit: '%' }),
    range('edges', 'Edges', 0, 100, 35, { unit: '%' }),
    toggle('heightFade', 'Height Fade', false),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 hid; vec2 h = hexCell(p / s, hid);
  vec2 cp = (p / s - h) * s;
  vec3 c = Sc(fromTl(cp));
  float a = atan(-h.y, h.x);
  float deg = degrees(a);
  if (deg < 0.0) deg += 360.0;
  float shade;
  if (deg >= 30.0 && deg < 150.0) shade = u_top / 100.0;
  else if (deg >= 150.0 && deg < 270.0) shade = u_left / 100.0;
  else shade = u_right / 100.0;
  vec3 col = c * shade;
  if (u_heightFade > 0.5) col *= 0.4 + luma(c) * 0.9;
  float hx = sdHex(h.yx, 0.5);
  vec2 q = vec2(h.x, -h.y);
  float sp = 1.0;
  for (int i = 0; i < 3; i++){
    float th = radians(30.0 + 120.0 * float(i));
    vec2 dir = vec2(cos(th), sin(th));
    if (dot(q, dir) > 0.0) sp = min(sp, abs(q.x * dir.y - q.y * dir.x));
  }
  float w = 1.2 / s;
  float edge = max(1.0 - smoothstep(0.0, w, abs(hx)), 1.0 - smoothstep(0.0, w, sp));
  col *= 1.0 - edge * u_edges / 100.0;
  return vec4(col, 1.0);
}`,
};

const hexMosaic: StyleDef = {
  id: 'hex-mosaic',
  name: 'Hex Mosaic',
  category: 'pixel',
  tags: ['geometric', 'color'],
  icon: '⬡',
  params: [
    range('size', 'Hex Size', 4, 64, 14, { unit: 'px' }),
    range('gap', 'Gap', 0, 40, 10, { unit: '%' }),
    color('grout', 'Gap Color', '#0b0b0e'),
    range('bevel', 'Bevel', 0, 100, 30, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 hid; vec2 h = hexCell(p / s, hid);
  vec2 cp = (p / s - h) * s;
  vec3 c = (Sc(fromTl(cp)) * 2.0 + Sc(fromTl(cp + vec2(s * 0.2, 0.0))) + Sc(fromTl(cp - vec2(s * 0.2, 0.0)))) * 0.25;
  float d = sdHex(h.yx, 0.5 - u_gap / 200.0);
  float m = aa(d * s, 1.0);
  float edge = smoothstep(-0.12, 0.0, d);
  c *= 1.0 + (edge * (h.y < 0.0 ? 0.3 : -0.35)) * u_bevel / 100.0;
  return vec4(mix(u_grout, c, m), 1.0);
}`,
};

const ledMatrix: StyleDef = {
  id: 'led-matrix',
  name: 'LED Matrix',
  category: 'pixel',
  tags: ['retro', 'geometric'],
  icon: '⣿',
  params: [
    range('size', 'LED Pitch', 3, 40, 9, { unit: 'px' }),
    range('ledSize', 'LED Size', 20, 100, 70, { unit: '%' }),
    range('glow', 'Glow', 0, 100, 45, { unit: '%' }),
    range('levels', 'Brightness Levels', 2, 32, 8),
    select('ledColor', 'Color', ['Image', 'Red', 'Amber', 'Green', 'Blue', 'White']),
    range('offLevel', 'Off LEDs', 0, 40, 8, { unit: '%' }),
    toggle('square', 'Square LEDs'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id = floor(p / s);
  vec2 f = fract(p / s) - 0.5;
  vec3 c = cellAvg(id, vec2(s));
  float l = luma(c);
  float L = max(u_levels - 1.0, 1.0);
  float q = floor(l * L + 0.5) / L;
  int m = int(u_ledColor + 0.5);
  vec3 tint = m == 1 ? vec3(1.0, 0.12, 0.08) : m == 2 ? vec3(1.0, 0.62, 0.1) : m == 3 ? vec3(0.2, 1.0, 0.35) : m == 4 ? vec3(0.2, 0.55, 1.0) : vec3(1.0);
  vec3 lc = m == 0 ? floor(c * L + 0.5) / L : tint * q;
  float r = 0.5 * u_ledSize / 100.0;
  float d = u_square > 0.5 ? sdBox(f, vec2(r * 0.85)) : length(f) - r;
  float led = aa(d * s, 1.2);
  float glow = exp(-max(d, 0.0) * 9.0) * u_glow / 100.0;
  vec3 off = (m == 0 ? vec3(1.0) : tint) * u_offLevel / 100.0 * 0.25;
  vec3 col = mix(vec3(0.01), off + lc * (0.65 + 0.35 * smoothstep(r, 0.0, length(f))), led) + lc * glow * 0.6;
  return vec4(col, 1.0);
}`,
};

export const PIXEL_STYLES: StyleDef[] = [pixelArt, mosaic, lego, voxel, hexMosaic, ledMatrix];
