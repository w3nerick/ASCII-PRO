import type { StyleDef } from '../types';
import { backdrop, inkParams, INK_FN, range, toggle, select, color, center } from './shared';
import { GRADIENT_OPTIONS } from '../palettes';

function shapeStyle(id: string, name: string, icon: string, tags: string[], shapeGlsl: string, extra: StyleDef['params'] = []): StyleDef {
  return {
    id, name, icon, tags, category: 'geometric', backdrop: true,
    params: [
      ...backdrop(1, 8, 100, '#050507'),
      range('size', 'Cell Size', 4, 48, 11, { unit: 'px' }),
      range('scale', 'Scale', 10, 200, 100, { unit: '%' }),
      range('thick', 'Thickness', 5, 100, 28, { unit: '%' }),
      ...extra,
      ...inkParams(1, '#ffffff'),
      toggle('invert', 'Invert Mapping'),
    ],
    glsl: /* glsl */ `
${INK_FN}
float shapeD(vec2 f, float t, float th);
${shapeGlsl}
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id = floor(p / s);
  vec2 f = fract(p / s) - 0.5;
  vec3 c = cellAvg(id, vec2(s));
  float l = clamp(luma(c) * matrixMod(id), 0.0, 1.0);
  float t = (u_invert > 0.5 ? 1.0 - l : l) * u_scale / 100.0;
  float d = shapeD(f, t, u_thick / 100.0);
  float m = aa(d * s, 1.2) * step(0.02, t);
  vec4 bd = backdrop(uv);
  vec3 ink = inkColor(c, l);
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, ink, m) : ink;
  return vec4(col, max(bd.a, m));
}`,
  };
}

const cross = shapeStyle('cross', 'Cross', '✚', ['geometric', 'mono'], /* glsl */ `
float shapeD(vec2 f, float t, float th){
  float r = t * 0.5; float w = th * 0.25 * max(t, 0.25);
  return min(sdBox(f, vec2(r, w)), sdBox(f, vec2(w, r)));
}`, [toggle('rotated', 'Rotate 45°')]);
cross.params = cross.params.map((p) => (p.key === 'scale' ? { ...p, default: 135 } : p.key === 'thick' ? { ...p, default: 40 } : p)) as StyleDef['params'];
cross.glsl = cross.glsl.replace('float d = shapeD(f, t, u_thick / 100.0);', 'if (u_rotated > 0.5) f = rot2(0.785398) * f;\n  float d = shapeD(f, t, u_thick / 100.0);');

const diamond = shapeStyle('diamond', 'Diamond', '◆', ['geometric', 'mono'], /* glsl */ `
float shapeD(vec2 f, float t, float th){
  float outer = (abs(f.x) + abs(f.y)) - t * 0.6;
  return th >= 0.99 ? outer : max(outer, -((abs(f.x) + abs(f.y)) - t * 0.6 * (1.0 - th)));
}`);
diamond.params = diamond.params.map((p) => (p.key === 'thick' ? { ...p, default: 100 } : p.key === 'scale' ? { ...p, default: 125 } : p)) as StyleDef['params'];

const lines = shapeStyle('lines', 'Lines', '☰', ['minimal', 'geometric'], /* glsl */ `
float shapeD(vec2 f, float t, float th){ return abs(f.y) - t * 0.5 * (0.3 + th); }`, [range('angle', 'Angle', 0, 180, 0, { unit: '°' })]);
lines.params = lines.params.map((p) => (p.key === 'thick' ? { ...p, default: 70 } : p.key === 'scale' ? { ...p, default: 130 } : p.key === 'size' ? { ...p, default: 7 } : p)) as StyleDef['params'];
lines.glsl = lines.glsl.replace('vec2 p = tl(uv);', 'vec2 p = rot2(radians(u_angle)) * tl(uv);').replace('vec3 c = cellAvg(id, vec2(s));', 'vec3 c = Sc(fromTl(rot2(-radians(u_angle)) * ((id + 0.5) * s)));');

const diagonal = shapeStyle('diagonal', 'Diagonal', '╱', ['geometric', 'minimal'], /* glsl */ `
float shapeD(vec2 f, float t, float th){ vec2 q = rot2(0.785398) * f; return abs(q.y) - t * 0.42 * (0.3 + th); }`, [toggle('flipDir', 'Flip Direction')]);
diagonal.params = diagonal.params.map((p) => (p.key === 'thick' ? { ...p, default: 70 } : p.key === 'scale' ? { ...p, default: 130 } : p.key === 'size' ? { ...p, default: 8 } : p)) as StyleDef['params'];
diagonal.glsl = diagonal.glsl.replace('float d = shapeD(f, t, u_thick / 100.0);', 'if (u_flipDir > 0.5) f.x = -f.x;\n  float d = shapeD(f, t, u_thick / 100.0);');

const specimen: StyleDef = {
  id: 'specimen',
  name: 'Specimen',
  category: 'geometric',
  tags: ['geometric', 'color'],
  icon: '⊞',
  params: [
    range('size', 'Cell Size', 8, 80, 22, { unit: 'px' }),
    color('bg', 'Sheet', '#f3f1ec'),
    color('lineC', 'Rule Lines', '#d6d2c8'),
    range('fill', 'Shape Fill', 30, 100, 82, { unit: '%' }),
    select('palette', 'Shapes', ['Mixed', 'Circles', 'Squares', 'Triangles']),
    range('saturation', 'Saturation', 0, 200, 115, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id = floor(p / s);
  vec2 f = fract(p / s) - 0.5;
  vec3 c = cellAvg(id, vec2(s));
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  float l = luma(c);
  int k = int(u_palette + 0.5);
  int shape = k == 0 ? int(floor(l * 4.0 - 0.001)) : k - 1;
  if (k == 0) shape = int(mod(float(shape) + floor(hash12(id) * 1.4), 4.0));
  float r = 0.5 * u_fill / 100.0;
  float d;
  if (shape == 0) d = length(f) - r;
  else if (shape == 1) d = sdBox(f, vec2(r * 0.88));
  else if (shape == 2) d = sdTri(vec2(f.x, -f.y) * 1.05, r * 0.95);
  else d = abs(length(f) - r * 0.7) - r * 0.28;
  vec3 col = u_bg;
  vec2 g = fract(p / s) * s;
  if (min(g.x, g.y) < max(u_k, 1.0)) col = u_lineC;
  col = mix(col, clamp(c, 0.0, 1.0), aa(d * s, 1.0));
  return vec4(col, 1.0);
}`,
};

const lowPoly: StyleDef = {
  id: 'low-poly',
  name: 'Low Poly',
  category: 'geometric',
  tags: ['geometric', 'minimal'],
  icon: '◺',
  params: [
    range('size', 'Triangle Size', 6, 120, 34, { unit: 'px' }),
    range('facet', 'Facet Light', 0, 100, 35, { unit: '%' }),
    range('edges', 'Edges', 0, 100, 0, { unit: '%' }),
    range('saturation', 'Saturation', 0, 200, 110, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv) / s;
  const float F2 = 0.36602540378, G2 = 0.2113248654;
  vec2 i = floor(p + (p.x + p.y) * F2);
  vec2 x0 = p - (i - (i.x + i.y) * G2);
  vec2 o = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 v0 = i, v1 = i + o, v2 = i + 1.0;
  vec2 c0 = v0 - (v0.x + v0.y) * G2, c1 = v1 - (v1.x + v1.y) * G2, c2 = v2 - (v2.x + v2.y) * G2;
  vec2 cen = (c0 + c1 + c2) / 3.0;
  vec3 c = (Sc(fromTl(cen * s)) * 2.0 + Sc(fromTl(mix(cen, c0, 0.5) * s)) + Sc(fromTl(mix(cen, c1, 0.5) * s)) + Sc(fromTl(mix(cen, c2, 0.5) * s))) / 5.0;
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  float h = hash12(v0 * 3.1 + o * 7.7);
  c *= 1.0 + (h - 0.5) * u_facet / 100.0 * 0.5;
  if (u_edges > 0.0){
    vec2 fs = fract(p + (p.x + p.y) * F2);
    float e = min(min(fs.x, 1.0 - fs.x), min(fs.y, 1.0 - fs.y));
    e = min(e, abs(fs.x - fs.y) * 0.7071);
    c = mix(c, c * 0.6, (1.0 - smoothstep(0.0, 1.5 / s, e)) * u_edges / 100.0);
  }
  return vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

const droste: StyleDef = {
  id: 'droste',
  name: 'Droste',
  category: 'geometric',
  tags: ['geometric', 'glitch'],
  icon: '⟳',
  params: [
    range('ratio', 'Inner Scale', 15, 80, 45, { unit: '%' }),
    range('twist', 'Spiral Twist', -100, 100, 25, { unit: '%' }),
    range('speed', 'Zoom Speed', 0, 100, 30, { unit: '%' }),
    ...center(),
  ],
  alwaysAnimated: false,
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 c = ctr();
  vec2 z = (uv - c) * vec2(aspect(), 1.0);
  float r = length(z);
  float a = atan(z.y, z.x);
  float R = 0.5 * max(aspect(), 1.0);
  float period = log(1.0 / (u_ratio / 100.0));
  float lr = log(max(r, 1e-5) / R);
  float tw = u_twist / 100.0;
  lr += a / TAU * period * tw;
  lr = mod(lr - u_time * u_speed / 100.0 * 0.5, period) - period;
  float ang = a;
  float rr = R * exp(lr - a / TAU * period * tw);
  vec2 q = vec2(cos(ang), sin(ang)) * rr;
  vec2 suv = c + q / vec2(aspect(), 1.0);
  suv = 1.0 - abs(1.0 - mod(suv, 2.0));
  return S(suv);
}`,
};

const truchet: StyleDef = {
  id: 'truchet',
  name: 'Truchet',
  category: 'geometric',
  tags: ['geometric', 'mono'],
  icon: '▚',
  backdrop: true,
  params: [
    ...backdrop(1, 8, 100, '#070708'),
    range('size', 'Tile Size', 6, 80, 18, { unit: 'px' }),
    range('thick', 'Max Thickness', 5, 60, 30, { unit: '%' }),
    select('tile', 'Tile', ['Arcs', 'Diagonals', 'Triangles']),
    ...inkParams(0, '#ffffff'),
    toggle('invert', 'Invert Mapping'),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id = floor(p / s);
  vec2 f = fract(p / s);
  vec3 c = cellAvg(id, vec2(s));
  float l = luma(c);
  float t = u_invert > 0.5 ? 1.0 - l : l;
  if (hash12(id) > 0.5) f.x = 1.0 - f.x;
  int k = int(u_tile + 0.5);
  float w = t * u_thick / 100.0;
  float d;
  if (k == 0) d = min(abs(length(f) - 0.5), abs(length(f - 1.0) - 0.5)) - w * 0.5;
  else if (k == 1) d = abs(f.x - f.y) * 0.7071 - w * 0.5;
  else d = (f.x + f.y - 1.0) * 0.7071 - (t - 0.5) * 0.7;
  float m = aa(d * s, 1.2);
  vec4 bd = backdrop(uv);
  vec3 ink = inkColor(c, l);
  vec3 col = bd.a > 0.5 ? mix(bd.rgb, ink, m) : ink;
  return vec4(col, max(bd.a, m));
}`,
};

const isoExtrude: StyleDef = {
  id: 'iso-extrude',
  name: 'Iso Extrude',
  category: 'geometric',
  tags: ['geometric', 'retro'],
  icon: '⬢',
  params: [
    range('size', 'Cell Size', 6, 64, 16, { unit: 'px' }),
    range('height', 'Extrusion', 0, 150, 70, { unit: '%' }),
    range('angle', 'Light Angle', 0, 360, 225, { unit: '°' }),
    color('bg', 'Background', '#0c0c0f'),
    range('shade', 'Side Shade', 10, 90, 45, { unit: '%' }),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv) / s;
  vec2 dir = vec2(cos(radians(u_angle)), sin(radians(u_angle)));
  vec3 col = u_bg;
  float best = -1.0;
  for (int j = -2; j <= 1; j++) for (int i = -2; i <= 1; i++){
    vec2 id = floor(p) + vec2(float(i), float(j));
    vec3 c = cellAvg(id, vec2(s));
    float h = luma(c) * u_height / 100.0 * 1.6;
    vec2 base = id + 0.5;
    vec2 top = base - dir * h;
    vec2 q = p - top;
    if (sdBox(q, vec2(0.38)) < 0.0 && h > best){ best = h; col = c * 1.1; continue; }
    for (int k = 0; k < 8; k++){
      float t = float(k) / 7.0;
      vec2 b = base - dir * h * t;
      if (sdBox(p - b, vec2(0.38)) < 0.0 && h * t > best - 0.001 && h > best){ best = h * t; col = c * (u_shade / 100.0) * (0.7 + 0.3 * t); }
    }
  }
  return vec4(col, 1.0);
}`,
};

const flowField: StyleDef = {
  id: 'flow-field',
  name: 'Flow Field',
  category: 'geometric',
  tags: ['organic', 'mono'],
  icon: '≋',
  params: [
    range('scale', 'Field Scale', 1, 100, 30),
    range('length', 'Stroke Length', 2, 40, 16, { unit: 'px' }),
    range('detail', 'Stroke Detail', 1, 8, 2.5, { step: 0.5, unit: 'px' }),
    range('follow', 'Follow Image', 0, 100, 60, { unit: '%' }),
    ...inkParams(0, '#e8e8e8'),
    color('bg', 'Background', '#060607'),
    range('contrast', 'Contrast', 50, 300, 160, { unit: '%' }),
  ],
  glsl: /* glsl */ `
${INK_FN}
vec2 field(vec2 p){
  float n = fbm(p * u_scale * 0.0008 + u_time * 0.05) * TAU * 2.0;
  vec3 g = sobel(fromTl(p), 2.0 * u_k);
  vec2 ig = length(g.xy) > 0.01 ? normalize(vec2(-g.y, g.x)) : vec2(cos(n), sin(n));
  return normalize(mix(vec2(cos(n), sin(n)), ig, u_follow / 100.0));
}
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float step_ = PX(u_length) / 8.0;
  float g = PX(u_detail);
  float acc = 0.0; vec2 q = p; vec2 q2 = p;
  for (int i = 0; i < 8; i++){
    acc += hash12(floor(q / g)); q += field(q) * step_;
    acc += hash12(floor(q2 / g)); q2 -= field(q2) * step_;
  }
  acc /= 16.0;
  vec3 c = Sc(uv);
  float l = luma(c);
  float v = clamp((acc - 0.5) * u_contrast / 100.0 * 2.0 + l - 0.2, 0.0, 1.0) * smoothstep(0.02, 0.4, l);
  return vec4(mix(u_bg, inkColor(c, l), v), 1.0);
}`,
};

const lattice: StyleDef = {
  id: 'lattice',
  name: 'Lattice',
  category: 'geometric',
  tags: ['organic', 'color'],
  icon: '▦',
  params: [
    range('size', 'Cell Size', 6, 120, 28, { unit: 'px' }),
    range('line', 'Line Width', 0, 40, 8, { unit: '%' }),
    color('lineC', 'Line Color', '#0a0a0c'),
    range('shade', 'Cell Shading', 0, 100, 40, { unit: '%' }),
    toggle('animate', 'Drift'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv) / s + (u_animate > 0.5 ? vec2(u_time * 0.05, 0.0) : vec2(0.0));
  vec2 cid; float edge;
  vec2 r = voronoi(p, cid, edge);
  vec2 site = cid + hash22(cid) - (u_animate > 0.5 ? vec2(u_time * 0.05, 0.0) : vec2(0.0));
  vec3 c = Sc(fromTl(site * s));
  c *= 1.0 - length(r) * u_shade / 100.0 * 0.6;
  float m = smoothstep(u_line / 100.0, u_line / 100.0 + 1.5 / s, edge);
  return vec4(mix(u_lineC, c, m), 1.0);
}`,
};

const topography: StyleDef = {
  id: 'topography',
  name: 'Topography',
  category: 'geometric',
  tags: ['organic', 'geometric'],
  icon: '∿',
  params: [
    range('levels', 'Contours', 4, 60, 18),
    range('width', 'Line Width', 0.5, 4, 1.2, { step: 0.1, unit: 'px' }),
    range('smooth', 'Smoothing', 0, 20, 4, { unit: 'px' }),
    select('lineColor', 'Line Color', ['Image', 'Mono', 'Gradient']),
    color('ink', 'Ink', '#e9e4d8', { showIf: { lineColor: [1] } }),
    { key: 'gradient', label: 'Gradient', type: 'select', options: GRADIENT_OPTIONS, default: 2, showIf: { lineColor: [2] }, noUniform: true },
    color('bg', 'Background', '#0a0b0d'),
    range('fill', 'Elevation Fill', 0, 100, 12, { unit: '%' }),
    toggle('animate', 'Flow'),
  ],
  glsl: /* glsl */ `
float height(vec2 uv){
  float r = PX(u_smooth);
  vec2 e = vec2(r) / u_res;
  float h = Sl(uv) * 0.4 + (Sl(uv + vec2(e.x, 0.0)) + Sl(uv - vec2(e.x, 0.0)) + Sl(uv + vec2(0.0, e.y)) + Sl(uv - vec2(0.0, e.y))) * 0.15;
  return h;
}
vec4 effect(vec2 uv){
  float h = height(uv) * u_levels + (u_animate > 0.5 ? u_time * 0.4 : 0.0);
  float d = abs(fract(h) - 0.5);
  float w = fwidth(h);
  float line = 1.0 - smoothstep(w * PX(u_width) * 0.5, w * PX(u_width) * 0.5 + w, 0.5 - d);
  vec3 c = Sc(uv);
  int m = int(u_lineColor + 0.5);
  vec3 lc = m == 0 ? c / max(max(c.r, max(c.g, c.b)), 0.25) : m == 1 ? u_ink : gradMap(fract(h / u_levels));
  vec3 col = u_bg + c * u_fill / 100.0;
  bool major = mod(floor(h + 0.5), 5.0) < 0.5;
  return vec4(mix(col, lc * (major ? 1.0 : 0.7), line), 1.0);
}`,
};

const forms: StyleDef = {
  id: 'forms',
  name: 'Forms',
  category: 'geometric',
  tags: ['color', 'organic'],
  icon: '✽',
  params: [
    range('radius', 'Softness', 2, 30, 10, { unit: 'px' }),
    range('levels', 'Tones', 2, 8, 4),
    range('saturation', 'Saturation', 0, 250, 140, { unit: '%' }),
    range('outline', 'Outline', 0, 100, 0, { unit: '%' }),
    color('lineC', 'Outline Color', '#111111'),
  ],
  glsl: /* glsl */ `
vec3 soft(vec2 uv){
  float r = PX(u_radius);
  vec3 acc = vec3(0.0);
  float ga = 2.39996323;
  for (int i = 0; i < 24; i++){
    float fi = float(i) + 0.5;
    vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * sqrt(fi / 24.0) * r / u_res;
    acc += Sc(uv + o);
  }
  return acc / 24.0;
}
vec4 effect(vec2 uv){
  vec3 c = soft(uv);
  c = mix(vec3(luma(c)), c, u_saturation / 100.0);
  float L = u_levels - 1.0;
  vec3 x = clamp(c, 0.0, 1.0) * L;
  vec3 w = fwidth(x) * 0.75 + 0.001;
  vec3 q = (floor(x) + smoothstep(0.5 - w, 0.5 + w, fract(x))) / L;
  float e = length(fwidth(floor(x + 0.5)));
  q = mix(q, u_lineC, clamp(e, 0.0, 1.0) * u_outline / 100.0);
  return vec4(clamp(q, 0.0, 1.0), 1.0);
}`,
};

const schematic: StyleDef = {
  id: 'schematic',
  name: 'Schematic',
  category: 'geometric',
  tags: ['geometric', 'minimal'],
  icon: '✛',
  params: [
    color('bg', 'Blueprint', '#0b3a7e'),
    color('lineC', 'Lines', '#e8f3ff'),
    range('grid', 'Grid Size', 8, 80, 24, { unit: 'px' }),
    range('edge', 'Edge Sensitivity', 0, 100, 55, { unit: '%' }),
    range('lineW', 'Line Width', 0.5, 4, 1, { step: 0.5, unit: 'px' }),
    range('fill', 'Shade Fill', 0, 100, 40, { unit: '%' }),
    toggle('marks', 'Registration Marks', true),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  vec2 p = tl(uv);
  float g = PX(u_grid);
  vec2 gf = fract(p / g) * g;
  float minor = 1.0 - step(max(u_k, 0.75), min(gf.x, gf.y));
  vec2 gf5 = fract(p / (g * 5.0)) * g * 5.0;
  float major = 1.0 - step(max(u_k, 0.75) * 1.8, min(gf5.x, gf5.y));
  vec3 col = mix(u_bg, u_bg * 0.35, (1.0 - luma(Sc(uv))) * u_fill / 100.0) + u_lineC * (minor * 0.08 + major * 0.14) + u_lineC * luma(Sc(uv)) * u_fill / 100.0 * 0.25;
  float e = sobel(uv, max(PX(u_lineW), 1.0)).z;
  float th = mix(0.6, 0.03, u_edge / 100.0);
  col = mix(col, u_lineC, smoothstep(th, th + 0.15, e));
  if (u_marks > 0.5){
    vec2 cid = floor(p / (g * 5.0));
    vec2 cf = gf5 - g * 2.5;
    float cr = step(abs(cf.x), max(u_k, 0.75)) * step(abs(cf.y), g * 0.5) + step(abs(cf.y), max(u_k, 0.75)) * step(abs(cf.x), g * 0.5);
    col = mix(col, u_lineC, clamp(cr, 0.0, 1.0) * 0.5 * step(0.7, hash12(cid)));
  }
  return vec4(col, 1.0);
}`,
};

const neonGrid: StyleDef = {
  id: 'neon-grid',
  name: 'Neon Grid',
  category: 'geometric',
  tags: ['color', 'geometric'],
  icon: '▦',
  params: [
    range('size', 'Grid Size', 4, 60, 12, { unit: 'px' }),
    range('lineW', 'Line Width', 5, 60, 18, { unit: '%' }),
    range('glow', 'Glow', 0, 100, 60, { unit: '%' }),
    range('saturation', 'Saturation', 0, 300, 180, { unit: '%' }),
    color('bg', 'Background', '#030306'),
    toggle('pulse', 'Pulse'),
  ],
  glsl: /* glsl */ `
vec4 effect(vec2 uv){
  float s = PX(u_size);
  vec2 p = tl(uv);
  vec2 id = floor(p / s);
  vec2 f = fract(p / s) - 0.5;
  vec3 c = cellAvg(id, vec2(s));
  c = clamp(mix(vec3(luma(c)), c, u_saturation / 100.0), 0.0, 1.0);
  float l = luma(c);
  if (u_pulse > 0.5) l *= 0.7 + 0.3 * sin(u_time * 3.0 + (id.x + id.y) * 0.3);
  float d = 0.5 - max(abs(f.x), abs(f.y));
  float w = u_lineW / 200.0;
  float line = 1.0 - smoothstep(w, w + 1.5 / s, d);
  float glow = exp(-d * 10.0) * u_glow / 100.0;
  vec3 col = u_bg + c * (line * (0.4 + l * 1.4) + glow * l * 0.9) + c * 0.06;
  return vec4(col, 1.0);
}`,
};

export const GEOMETRIC_STYLES: StyleDef[] = [
  cross, diamond, lines, diagonal, specimen, lowPoly, droste, truchet, isoExtrude, flowField, lattice, topography, forms, schematic, neonGrid,
];
