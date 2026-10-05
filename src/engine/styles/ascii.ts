import type { StyleDef } from '../types';
import { backdrop, charsetParams, inkParams, INK_FN, range, toggle, select, color } from './shared';
import { CHARSET_RAMPS } from '../palettes';

const CHAR_BLEND = /* glsl */ `
vec3 charBlend(vec3 b, vec3 s, int m){
  if (m == 1) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
  if (m == 2) return min(b / max(1.0 - s, 1e-3), 1.0);
  if (m == 3) return 1.0 - (1.0 - b) * (1.0 - s);
  if (m == 4) return min(b + s, 1.0);
  return s;
}`;

const characters: StyleDef = {
  id: 'characters',
  name: 'Characters',
  category: 'ascii',
  tags: ['dense', 'mono'],
  icon: 'A',
  backdrop: true,
  glyphs: true,
  depth: true,
  params: [
    ...backdrop(0, 8, 100),
    ...charsetParams(0, 11),
    select('charBlend', 'Blend Mode', ['Normal', 'Overlay', 'Color Dodge', 'Screen', 'Lighter']),
    range('charOpacity', 'Char Opacity', 0, 100, 100, { unit: '%' }),
    ...inkParams(0, '#ffffff'),
    range('boost', 'Char Brightness', 50, 250, 150, { unit: '%' }),
    range('spacing', 'Line Spacing', 70, 200, 100, { unit: '%' }),
    toggle('invert', 'Invert Mapping'),
    toggle('dotGrid', 'Dot Grid Overlay'),
    toggle('randomize', 'Randomize Characters'),
    range('coverage', 'Coverage', 0, 100, 100, { unit: '%', section: 'Intensity' }),
  ],
  glsl: /* glsl */ `
${INK_FN}
${CHAR_BLEND}
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_fontSize) * 0.62, PX(u_fontSize) * u_spacing / 100.0);
  vec2 p = tl(uv);
  vec2 id = floor(p / cs);
  vec2 f = fract(p / cs);
  f.y = f.y * u_spacing / 100.0 - (u_spacing / 100.0 - 1.0) * 0.5;
  vec3 cc = cellAvg(id, cs);
  float mm = matrixMod(id);
  float l = clamp(luma(cc) * mm, 0.0, 1.0);
  float t = u_invert > 0.5 ? l : 1.0 - l;
  float idx = floor(t * (u_glyphN - 0.001));
  if (u_randomize > 0.5) idx = floor(hash12(id + 0.37) * u_glyphN);
  idx = shimmerIdx(idx, id);
  vec2 gcs = vec2(cs.x, PX(u_fontSize));
  vec3 m = glyph3(idx, f, gcs, id, l);
  float vis = step(1.0 - u_coverage / 100.0 - 0.0001, u_invert > 0.5 ? 1.0 - l : l);
  if (u_coverage >= 100.0) vis = 1.0;
  vec4 bd = backdrop(uv);
  vec3 ink = clamp(inkColor(cc, l) * u_boost / 100.0, 0.0, 1.0) * min(mm, 1.8);
  vec3 mixed = charBlend(bd.rgb, ink, int(u_charBlend + 0.5));
  vec3 k = m * (u_charOpacity / 100.0) * vis;
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, mixed, k) : ink;
  float a = max(bd.a, max(k.r, max(k.g, k.b)));
  if (u_dotGrid > 0.5){
    vec2 d = (fract(p / cs) - 0.5) * cs;
    float dotm = aa(length(d) - PX(0.7), 1.0) * 0.35;
    col = mix(col, vec3(1.0), dotm * (1.0 - max(k.r, max(k.g, k.b))));
    a = max(a, dotm);
  }
  return vec4(col, a);
}`,
};

const asciiStudio: StyleDef = {
  id: 'ascii-studio',
  name: 'ASCII Studio',
  category: 'ascii',
  tags: ['color', 'geometric'],
  icon: '◉',
  glyphs: true,
  depth: true,
  params: [
    ...charsetParams(1, 12),
    ...inkParams(1, '#e8e8e8', 2),
    color('bg', 'Background', '#060608'),
    range('cellFill', 'Cell Fill', 0, 100, 18, { unit: '%' }),
    range('gamma', 'Gamma', 30, 300, 100, { unit: '%' }),
    range('glow', 'Glow', 0, 100, 25, { unit: '%' }),
    toggle('invert', 'Invert Mapping'),
    toggle('grid', 'Cell Grid'),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_fontSize) * 0.62, PX(u_fontSize));
  vec2 p = tl(uv);
  vec2 id = floor(p / cs);
  vec2 f = fract(p / cs);
  vec3 cc = cellAvg(id, cs);
  float mm = matrixMod(id);
  float l = clamp(pow(luma(cc), 100.0 / u_gamma) * mm, 0.0, 1.0);
  float t = u_invert > 0.5 ? l : 1.0 - l;
  float idx = shimmerIdx(floor(t * (u_glyphN - 0.001)), id);
  vec3 m = glyph3(idx, f, cs, id, l);
  vec3 ink = inkColor(cc, l) * min(mm, 1.8);
  vec3 col = u_bg + cc * (u_cellFill / 100.0) * 0.6;
  float halo = glyph(idx, (f - 0.5) * 0.8 + 0.5, cs) * u_glow / 100.0 * 0.35;
  col += ink * halo;
  col = mix(col, ink, m);
  if (u_grid > 0.5){ vec2 g = step(fract(p / cs), vec2(1.0) / cs); col = mix(col, col + 0.06, max(g.x, g.y)); }
  return vec4(col, 1.0);
}`,
};

const block: StyleDef = {
  id: 'block',
  name: 'Block',
  category: 'ascii',
  tags: ['minimal', 'mono'],
  icon: '▛',
  glyphs: true,
  depth: true,
  backdrop: true,
  params: [
    ...backdrop(1, 8, 100, '#050507'),
    { key: 'fontSize', label: 'Block Size', type: 'range', min: 4, max: 64, step: 1, default: 14 },
    { key: 'charset', label: 'Blocks', type: 'select', options: [{ label: 'Shades', value: 5 }, { label: 'Bars', value: 6 }, { label: 'Quadrants', value: 7 }], default: 5, sets: { chars: [CHARSET_RAMPS[5], CHARSET_RAMPS[6], CHARSET_RAMPS[7]] } },
    { key: 'chars', label: 'Chars', type: 'text', default: CHARSET_RAMPS[5], atlas: true },
    ...inkParams(0, '#f2f2f2'),
    range('levels', 'Levels', 2, 16, 5),
    toggle('invert', 'Invert Mapping'),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_fontSize) * 0.62, PX(u_fontSize));
  vec2 p = tl(uv);
  vec2 id = floor(p / cs);
  vec2 f = fract(p / cs);
  vec3 cc = cellAvg(id, cs);
  float l = clamp(luma(cc) * matrixMod(id), 0.0, 1.0);
  l = floor(l * u_levels) / max(u_levels - 1.0, 1.0);
  float t = u_invert > 0.5 ? l : 1.0 - l;
  float idx = shimmerIdx(floor(t * (u_glyphN - 0.001)), id);
  vec3 m = glyph3(idx, f, cs, id, l);
  vec4 bd = backdrop(uv);
  vec3 ink = inkColor(cc, l);
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, ink, m) : ink;
  return vec4(col, max(bd.a, m.g));
}`,
};

const dots: StyleDef = {
  id: 'dots',
  name: 'Dots',
  category: 'ascii',
  tags: ['minimal', 'organic'],
  icon: '●',
  backdrop: true,
  depth: false,
  params: [
    ...backdrop(1, 8, 100, '#050507'),
    range('size', 'Cell Size', 3, 48, 10, { unit: 'px' }),
    range('scale', 'Dot Scale', 10, 160, 100, { unit: '%' }),
    select('shape', 'Shape', ['Circle', 'Ring', 'Square', 'Diamond']),
    select('grid', 'Grid', ['Square', 'Hex']),
    range('jitter', 'Jitter', 0, 100, 0, { unit: '%' }),
    ...inkParams(0, '#ffffff'),
    toggle('invert', 'Invert Mapping'),
    range('coverage', 'Coverage', 0, 100, 100, { unit: '%', section: 'Intensity' }),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id, f;
  if (u_grid > 0.5){
    vec2 hid; vec2 h = hexCell(p / s, hid); id = hid; f = h;
  } else { id = floor(p / s); f = fract(p / s) - 0.5; }
  vec2 cpos = u_grid > 0.5 ? (p / s - f) * s : (id + 0.5) * s;
  vec2 j = (hash22(id) - 0.5) * u_jitter / 100.0 * 0.5;
  f -= j;
  vec3 cc = Sc(fromTl(cpos));
  float l = clamp(luma(cc) * matrixMod(id), 0.0, 1.0);
  float t = u_invert > 0.5 ? 1.0 - l : l;
  float r = sqrt(t) * 0.5 * u_scale / 100.0;
  float d;
  int sh = int(u_shape + 0.5);
  if (sh == 0) d = length(f) - r;
  else if (sh == 1) d = abs(length(f) - r * 0.75) - r * 0.25;
  else if (sh == 2) d = max(abs(f.x), abs(f.y)) - r * 0.9;
  else d = (abs(f.x) + abs(f.y)) - r * 1.2;
  float m = aa(d * s, 1.2);
  if (u_coverage < 100.0) m *= step(1.0 - u_coverage / 100.0, t);
  vec4 bd = backdrop(uv);
  vec3 ink = inkColor(cc, l);
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, ink, m) : ink;
  return vec4(col, max(bd.a, m));
}`,
};

const mixed: StyleDef = {
  id: 'mixed',
  name: 'Mixed',
  category: 'ascii',
  tags: ['dense', 'mono'],
  icon: '◐',
  glyphs: true,
  depth: true,
  backdrop: true,
  params: [
    ...backdrop(1, 8, 100, '#050507'),
    ...charsetParams(2, 12),
    ...inkParams(1, '#ffffff'),
    range('dotBand', 'Dot Band', 0, 100, 30, { unit: '%' }),
    range('blockBand', 'Block Band', 0, 100, 85, { unit: '%' }),
    toggle('invert', 'Invert Mapping'),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_fontSize) * 0.62, PX(u_fontSize));
  vec2 p = tl(uv);
  vec2 id = floor(p / cs);
  vec2 f = fract(p / cs);
  vec3 cc = cellAvg(id, cs);
  float l = clamp(luma(cc) * matrixMod(id), 0.0, 1.0);
  float t = u_invert > 0.5 ? 1.0 - l : l;
  float m;
  vec2 q = (f - 0.5) * cs;
  if (t < u_dotBand / 100.0){
    m = aa(length(q) - t / max(u_dotBand / 100.0, 0.01) * cs.x * 0.32, 1.0);
  } else if (t > u_blockBand / 100.0){
    m = aa(sdBox(q, cs * 0.42), 1.0);
  } else {
    float k = (t - u_dotBand / 100.0) / max(u_blockBand / 100.0 - u_dotBand / 100.0, 0.01);
    float idx = shimmerIdx(floor((1.0 - k) * (u_glyphN - 0.001)), id);
    m = glyph3(idx, f, cs, id, l).g;
  }
  vec4 bd = backdrop(uv);
  vec3 ink = inkColor(cc, l);
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, ink, m) : ink;
  return vec4(col, max(bd.a, m));
}`,
};

const braille: StyleDef = {
  id: 'braille',
  name: 'Braille',
  category: 'ascii',
  tags: ['dense', 'mono'],
  icon: '⣷',
  backdrop: true,
  params: [
    ...backdrop(1, 8, 100, '#050507'),
    range('size', 'Cell Size', 4, 40, 10, { unit: 'px' }),
    range('threshold', 'Threshold', 0, 100, 45, { unit: '%' }),
    range('dotSize', 'Dot Size', 20, 100, 70, { unit: '%' }),
    toggle('dither', 'Dither', true),
    ...inkParams(1, '#ffffff'),
    toggle('invert', 'Invert'),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec4 effect(vec2 uv){
  vec2 cs = vec2(PX(u_size) * 0.55, PX(u_size));
  vec2 p = tl(uv);
  vec2 id = floor(p / cs);
  vec2 f = fract(p / cs);
  vec2 sub = floor(f * vec2(2.0, 4.0));
  vec2 sf = fract(f * vec2(2.0, 4.0)) - 0.5;
  vec2 dc = (id * vec2(2.0, 4.0) + sub + 0.5);
  vec3 c = Sc(fromTl(dc * cs / vec2(2.0, 4.0)));
  float l = clamp(luma(c) * matrixMod(id), 0.0, 1.0);
  if (u_invert > 0.5) l = 1.0 - l;
  float th = u_threshold / 100.0;
  if (u_dither > 0.5) th += (bayer4(dc) - 0.5) * 0.5;
  float on = step(th, l);
  vec2 dpx = sf * cs / vec2(2.0, 4.0);
  float r = min(cs.x / 2.0, cs.y / 4.0) * 0.5 * u_dotSize / 100.0;
  float m = aa(length(dpx) - r, 1.0) * on;
  vec4 bd = backdrop(uv);
  vec3 ink = inkColor(c, l);
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, ink, m) : ink;
  return vec4(col, max(bd.a, m));
}`,
};

export const ASCII_STYLES: StyleDef[] = [characters, asciiStudio, block, dots, mixed, braille];
