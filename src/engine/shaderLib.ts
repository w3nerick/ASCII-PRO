// GLSL shared by every style program. Each style provides `vec4 effect(vec2 uv)`.
import type { StyleDef } from './types';

export const COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
float aa(float d, float w){ return clamp(0.5 - d / max(w, 1e-4), 0.0, 1.0); }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
// Pointy-top hex grid. Returns local offset; id receives the hex id.
vec2 hexCell(vec2 p, out vec2 id){
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
  if (dot(h.xy, h.xy) < dot(h.zw, h.zw)){ id = hC.xy; return h.xy; }
  id = hC.zw + 0.5; return h.zw;
}
vec2 voronoi(vec2 p, out vec2 cellId, out float edge){
  vec2 n = floor(p), f = fract(p);
  float md = 8.0, md2 = 8.0; vec2 mr = vec2(0), mid = vec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md){ md2 = md; md = d; mr = r; mid = n + g; } else if (d < md2){ md2 = d; }
  }
  cellId = mid; edge = sqrt(md2) - sqrt(md);
  return mr;
}
vec3 blendRGB(vec3 b, vec3 s, int m){
  if (m == 1) return b * s;
  if (m == 2) return 1.0 - (1.0 - b) * (1.0 - s);
  if (m == 3) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
  if (m == 4) return mix(2.0 * b * s + b * b * (1.0 - 2.0 * s), sqrt(b) * (2.0 * s - 1.0) + 2.0 * b * (1.0 - s), step(0.5, s));
  if (m == 5) return min(b + s, 1.0);
  if (m == 6) return abs(b - s);
  if (m == 7) return min(b / max(1.0 - s, 1e-3), 1.0);
  if (m == 8) return max(b, s);
  if (m == 9) return min(b, s);
  return s;
}
`;

export const STYLE_HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 o_col;
uniform sampler2D u_src;
uniform sampler2D u_back;
uniform sampler2D u_prev;
uniform sampler2D u_atlas;
uniform vec2 u_res;
uniform float u_k;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_seed;
uniform float u_glyphN;
uniform vec2 u_atlasGrid;
uniform int u_bdMode;
uniform float u_bdOpacity;
uniform vec3 u_bdColor;
uniform vec4 u_depth;
uniform float u_matrix;
uniform vec2 u_matrixDir;
uniform float u_matrixSpeed;
uniform float u_shimmer;
uniform float u_opacity;
uniform int u_blend;
uniform vec3 u_pal[16];
uniform int u_palN;
uniform vec3 u_grad[8];
uniform int u_gradN;
${COMMON}
vec4 S(vec2 uv){ return texture(u_src, uv); }
vec3 Sc(vec2 uv){ return texture(u_src, uv).rgb; }
float Sl(vec2 uv){ return luma(texture(u_src, uv).rgb); }
// Pixel helpers. "tl" = top-left origin pixel coordinates.
vec2 tl(vec2 uv){ return vec2(uv.x, 1.0 - uv.y) * u_res; }
vec2 fromTl(vec2 p){ return vec2(p.x, u_res.y - p.y) / u_res; }
float aspect(){ return u_res.x / u_res.y; }
// Design pixels -> render pixels.
float PX(float v){ return max(v * u_k, 0.5); }
vec4 backdrop(vec2 uv){
  if (u_bdMode == 0) return vec4(texture(u_back, uv).rgb * u_bdOpacity, 1.0);
  if (u_bdMode == 1) return vec4(u_bdColor, 1.0);
  if (u_bdMode == 2) return vec4(Sc(uv) * u_bdOpacity, 1.0);
  return vec4(0.0);
}
vec3 gradMap(float t){
  t = clamp(t, 0.0, 1.0) * float(u_gradN - 1);
  int i = int(floor(t));
  vec3 a = u_grad[0], b = u_grad[0];
  for (int k = 0; k < 8; k++){ if (k == i) a = u_grad[k]; if (k == min(i + 1, u_gradN - 1)) b = u_grad[k]; }
  return mix(a, b, fract(t));
}
vec3 nearestPal(vec3 c){
  float bd = 1e9; vec3 best = c;
  for (int i = 0; i < 16; i++){
    if (i >= u_palN) break;
    vec3 d = c - u_pal[i];
    float dd = dot(d * vec3(0.30, 0.59, 0.11), d) ;
    if (dd < bd){ bd = dd; best = u_pal[i]; }
  }
  return best;
}
// Average color of a cell (4 taps). cs in render px, id = cell index from top-left.
vec3 cellAvg(vec2 id, vec2 cs){
  vec2 c = (id + 0.5) * cs;
  vec2 o = cs * 0.25;
  return (Sc(fromTl(c + vec2(-o.x, -o.y))) + Sc(fromTl(c + vec2(o.x, -o.y))) + Sc(fromTl(c + vec2(-o.x, o.y))) + Sc(fromTl(c + vec2(o.x, o.y)))) * 0.25;
}
vec3 cellCenter(vec2 id, vec2 cs){ return Sc(fromTl((id + 0.5) * cs)); }
// Matrix rain multiplier for a cell.
float matrixMod(vec2 id){
  if (u_matrix < 0.5) return 1.0;
  vec2 d = u_matrixDir;
  float along = dot(id, d);
  float lane = floor(dot(id, vec2(-d.y, d.x)) + 0.5);
  float sp = 0.6 + hash11(lane * 1.7) * 0.8;
  float t = fract(along * 0.035 - u_time * u_matrixSpeed * 0.18 * sp + hash11(lane));
  return 0.12 + 1.6 * pow(t, 5.0) + 0.25 * smoothstep(0.6, 1.0, t);
}
float shimmerIdx(float idx, vec2 id){
  if (u_shimmer <= 0.0) return idx;
  float r = hash12(id + floor(u_time * 9.0) * 0.731);
  return (r < u_shimmer) ? floor(hash12(id * 1.37 + floor(u_time * 9.0)) * u_glyphN) : idx;
}
float atlasA(float idx, vec2 f, vec2 cs){
  idx = clamp(floor(idx), 0.0, u_glyphN - 1.0);
  vec2 g = vec2(mod(idx, u_atlasGrid.x), floor(idx / u_atlasGrid.x));
  vec2 a = vec2(0.5 + (f.x - 0.5) * cs.x / cs.y, f.y);
  if (a.x < 0.0 || a.x > 1.0 || a.y < 0.0 || a.y > 1.0) return 0.0;
  vec2 auv = (g + a) / u_atlasGrid;
  vec2 gx = vec2(1.0 / (cs.y * u_atlasGrid.x), 0.0);
  vec2 gy = vec2(0.0, 1.0 / (cs.y * u_atlasGrid.y));
  return textureGrad(u_atlas, auv, gx, gy).a;
}
// Glyph coverage with Depth tab effects. Returns per-channel coverage (color split).
vec3 glyph3(float idx, vec2 f, vec2 cs, vec2 id, float lum){
  float wave = u_depth.x, splay = u_depth.y, split = u_depth.z, etch = u_depth.w;
  if (wave > 0.0) f.y += sin(id.x * 0.45 + id.y * 0.12 + u_time * 2.0) * wave * 0.35;
  if (splay > 0.0){ float s = mix(1.0, 0.35 + lum * 1.1, splay); f = (f - 0.5) / max(s, 0.05) + 0.5; }
  float a;
  vec3 m;
  if (split > 0.0){
    float o = split * 0.18;
    m = vec3(atlasA(idx, f + vec2(o, 0.0), cs), atlasA(idx, f, cs), atlasA(idx, f - vec2(o, 0.0), cs));
    a = m.g;
  } else { a = atlasA(idx, f, cs); m = vec3(a); }
  if (etch > 0.0){
    float b = atlasA(idx, f + vec2(0.06, 0.06), cs);
    m = mix(m, vec3(clamp(0.55 + (a - b) * 2.5, 0.0, 1.0)) * max(a, b), etch);
  }
  return m;
}
float glyph(float idx, vec2 f, vec2 cs){ return atlasA(idx, f, cs); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdCircle(vec2 p, float r){ return length(p) - r; }
float sdHex(vec2 p, float r){ const vec3 k = vec3(-0.866025404, 0.5, 0.577350269); p = abs(p); p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy; p -= vec2(clamp(p.x, -k.z * r, k.z * r), r); return length(p) * sign(p.y); }
float sdTri(vec2 p, float r){ const float k = sqrt(3.0); p.x = abs(p.x) - r; p.y = p.y + r / k; if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0; p.x -= clamp(p.x, -2.0 * r, 0.0); return -length(p) * sign(p.y); }
vec3 sobel(vec2 uv, float s){
  vec2 e = vec2(s) / u_res;
  float tl_ = Sl(uv + vec2(-e.x, e.y)), t = Sl(uv + vec2(0.0, e.y)), tr = Sl(uv + e);
  float l = Sl(uv - vec2(e.x, 0.0)), r = Sl(uv + vec2(e.x, 0.0));
  float bl = Sl(uv - e), b = Sl(uv - vec2(0.0, e.y)), br = Sl(uv + vec2(e.x, -e.y));
  float gx = -tl_ - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -bl - 2.0 * b - br + tl_ + 2.0 * t + tr;
  return vec3(gx, gy, length(vec2(gx, gy)));
}
`;

export const RESERVED_KEYS = new Set([
  'src', 'back', 'prev', 'atlas', 'res', 'k', 'time', 'mouse', 'seed', 'glyphN', 'atlasGrid', 'bdMode', 'bdOpacity', 'bdColor',
  'depth', 'matrix', 'matrixDir', 'matrixSpeed', 'shimmer', 'opacity', 'blend', 'pal', 'palN', 'grad', 'gradN',
]);

function uniformDecls(style: StyleDef): string {
  const out: string[] = [];
  for (const p of style.params) {
    if (p.type === 'text' || p.noUniform) continue;
    if (RESERVED_KEYS.has(p.key)) console.error(`[engine] style "${style.id}" uses reserved param key "${p.key}"`);
    if (p.type === 'color') out.push(`uniform vec3 u_${p.key};`);
    else out.push(`uniform float u_${p.key};`);
  }
  return out.join('\n');
}

export function buildStyleFrag(style: StyleDef): string {
  return `${STYLE_HEADER}
${uniformDecls(style)}
${style.params.some((p) => p.key === 'cx') ? 'vec2 ctr(){ return vec2(u_cx / 100.0, 1.0 - u_cy / 100.0); }' : ''}
#line 1
${style.glsl}
void main(){
  vec4 base = texture(u_src, v_uv);
  vec4 fx = effect(v_uv);
  vec4 res = vec4(blendRGB(base.rgb, fx.rgb, u_blend), fx.a);
  o_col = mix(base, res, u_opacity);
}`;
}
