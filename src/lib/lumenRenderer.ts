/**
 * Lumen Shader Renderer — WebGL2 procedural image generator.
 * Ported from lumenshaders (MIT) for use as demo images in ASCII PRO.
 *
 * Renders 9 shader modes as static images on an OffscreenCanvas,
 * then converts to HTMLImageElement for the ASCII conversion pipeline.
 */

/* ─── GLSL Source ─────────────────────────────────────────────── */

const VERT_SRC = `#version 300 es
layout(location=0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `#version 300 es
precision highp float;
precision highp int;

uniform vec2  u_res;
uniform float u_phase;
uniform float u_seed;
uniform int   u_mode;

uniform vec3  u_c1, u_c2, u_c3, u_c4, u_bg;
uniform float u_hue, u_sat, u_exposure, u_contrast;

uniform float u_scale;
uniform float u_complex;
uniform float u_warp;
uniform float u_flow;
uniform float u_stretch;

uniform float u_light, u_gloss, u_lightAngle, u_irid, u_glow;

uniform float u_grain, u_cell, u_lines, u_ca, u_vig, u_soft;
uniform float u_travel;

out vec4 fragColor;

#define TAU 6.28318530718
#define PI  3.14159265359

float hash11(float n){
  n = fract(n * 0.1031);
  n *= n + 33.33;
  n *= n + n;
  return fract(n);
}
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p){
  float n = hash21(p);
  return vec2(n, hash21(p+n+17.13));
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash21(i);
  float b = hash21(i+vec2(1,0));
  float c = hash21(i+vec2(0,1));
  float d = hash21(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float fbm(vec2 p){
  float v = 0.0, a = 0.5, tot = 0.0;
  mat2 R = rot(0.62);
  for (int i = 0; i < 8; i++){
    float w = clamp(u_complex - float(i), 0.0, 1.0);
    if (w <= 0.0) break;
    v += a*w*vnoise(p);
    tot += a*w;
    a *= 0.55;
    p = R*p*2.03 + 11.7;
  }
  return v/max(tot, 1e-4);
}

vec2 LT(){ return vec2(cos(TAU*u_phase), sin(TAU*u_phase)) * u_travel; }
vec2 SO(){ return vec2(hash11(u_seed*0.137 + 0.731)*61.7, hash11(u_seed*0.213 + 7.0)*47.3); }

vec3 palette(float t){
  t = clamp(t, 0.0, 1.0);
  float x = t*3.0;
  vec3 c = mix(u_c1, u_c2, smoothstep(0.0,1.0,x));
  c = mix(c, u_c3, smoothstep(1.0,2.0,x));
  c = mix(c, u_c4, smoothstep(2.0,3.0,x));
  return c;
}
vec3 paletteCyc(float t){
  t = fract(t);
  float x = t*4.0;
  vec3 c = mix(u_c1, u_c2, smoothstep(0.0,1.0,x));
  c = mix(c, u_c3, smoothstep(1.0,2.0,x));
  c = mix(c, u_c4, smoothstep(2.0,3.0,x));
  c = mix(c, u_c1, smoothstep(3.0,4.0,x));
  return c;
}

vec3 hueRotate(vec3 c, float deg){
  float a = deg*PI/180.0;
  float cs = cos(a), sn = sin(a);
  mat3 m = mat3(
    0.299+0.701*cs+0.168*sn, 0.587-0.587*cs+0.330*sn, 0.114-0.114*cs-0.497*sn,
    0.299-0.299*cs-0.328*sn, 0.587+0.413*cs+0.035*sn, 0.114-0.114*cs+0.292*sn,
    0.299-0.300*cs+1.250*sn, 0.587-0.588*cs-1.050*sn, 0.114+0.886*cs-0.203*sn);
  return c*m;
}

vec2 toP(vec2 uv){
  float asp = u_res.x/u_res.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * (3.0/max(u_scale, 0.15));
  p.x *= mix(1.0, 0.38, clamp(u_stretch, 0.0, 1.0));
  p.y *= mix(1.0, 0.38, clamp(-u_stretch, 0.0, 1.0));
  return p;
}

/* Mode 0 — Liquid Chrome */
float chromeH(vec2 p, vec2 w){
  vec2 so = SO(), lt = LT();
  return fbm((p + w)*0.85 + so*0.5 + u_flow*0.6*lt);
}
vec3 sceneChrome(vec2 uv){
  vec2 p = toP(uv); p.x *= 0.48;
  vec2 so = SO(), lt = LT();
  vec2 w = u_warp*0.9*vec2(fbm(p*0.5+so+lt)-0.5, fbm(p*0.5+so+7.31-lt)-0.5)*2.4;
  float e = 0.06;
  float h = chromeH(p, w), hx = chromeH(p+vec2(e,0), w), hy = chromeH(p+vec2(0,e), w);
  float relief = 3.4 + u_warp*1.6;
  vec3 n = normalize(vec3(-(hx-h)/e*relief, -(hy-h)/e*relief, 1.0));
  float la = u_lightAngle*PI/180.0;
  vec3 L = normalize(vec3(cos(la), sin(la), 0.55));
  float diff = max(dot(n, L), 0.0);
  vec3 Hv = normalize(L + vec3(0,0,1));
  float spec = pow(max(dot(n, Hv), 0.0), u_gloss);
  float spec2 = pow(max(dot(n, normalize(vec3(-L.xy, 0.9))), 0.0), u_gloss*0.45);
  float fres = pow(1.0 - max(n.z, 0.0), 2.4);
  vec3 alb = palette(clamp(h*1.1 + u_irid*n.x*0.7, 0.0, 1.0));
  vec3 alb2 = palette(clamp(0.55 - n.x*0.7 + h*0.25, 0.0, 1.0));
  vec3 col = u_bg*(0.55 + 0.45*diff);
  col += alb*pow(diff, 2.4)*0.30;
  col += alb*spec*u_light*3.0;
  col += alb2*spec2*u_light*1.35;
  col += palette(clamp(fres*0.85 + u_irid*n.y*0.4, 0.0, 1.0))*fres*u_light*0.55;
  col += vec3(1.0)*pow(spec, 3.0)*u_light*0.5;
  return col;
}

/* Mode 1 — Silk Ribbons */
vec3 sceneSilk(vec2 uv){
  vec2 p = toP(uv);
  vec2 so = SO(), lt = LT();
  p = rot(-0.30 + 0.6*(hash11(u_seed*0.31+3.0)-0.5)) * p;
  vec2 wq = p*vec2(0.42, 0.50) + so + lt*0.55;
  float wave = vnoise(wq)*0.70 + vnoise(wq*2.13+5.0)*0.30;
  float freq = u_lines*0.16;
  float tt = p.y*freq + (wave-0.5)*(4.5+u_warp*3.5) + p.x*0.30;
  float ft = fract(tt)-0.5;
  float band = abs(ft)*2.0;
  float prof = sqrt(max(1.0-band*band, 0.0));
  vec3 n = normalize(vec3(0.35*(wave-0.5), ft*2.0, max(prof, 0.05)));
  float la = u_lightAngle*PI/180.0;
  vec3 L = normalize(vec3(cos(la), sin(la), 0.62));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, normalize(L+vec3(0,0,1))), 0.0), u_gloss);
  float id = hash11(floor(tt)*7.77 + hash11(u_seed*0.171)*43.0);
  vec3 alb = paletteCyc(id*0.97 + wave*0.22 + u_irid*0.25*n.y);
  vec3 col = alb*(0.05 + 0.95*pow(diff, 1.7));
  col += alb*spec*u_light*1.9;
  col += vec3(1.0)*pow(spec, 2.5)*u_light*0.6;
  col *= 0.45 + 0.55*prof;
  float env = smoothstep(1.8, 0.55, abs(p.y*0.7 + (wave-0.5)*3.4));
  return mix(u_bg, col, env);
}

/* Mode 2 — Soft Bloom */
vec3 blobField(vec2 p, float warpAmt){
  vec2 so = SO();
  p += warpAmt*0.55*vec2(fbm(p*0.8+so)-0.5, fbm(p*0.8-so)-0.5)*2.0;
  vec3 col = u_bg;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    vec2 hc = hash22(vec2(fi*3.17, u_seed*0.731 + fi));
    vec2 base = (hc - 0.5)*vec2(2.2, 1.6);
    float orbR = 0.18 + 0.4*hash11(u_seed*0.117 + fi*9.1);
    float ph = u_phase + hash11(fi + u_seed*0.291);
    float dir = hash11(fi*5.0 + u_seed*0.49) > 0.5 ? 1.0 : -1.0;
    vec2 pos = base + orbR*u_travel*vec2(cos(TAU*ph*dir), sin(TAU*ph*dir));
    float rad = (0.45 + 0.6*hash11(fi*2.3 + u_seed*0.371 + 4.0)) * u_soft;
    float d = length(p - pos);
    float g = exp(-(d*d)/(rad*rad));
    vec3 bc = palette(fract(fi*0.249 + hash11(fi + u_seed*0.523)*0.18));
    col = mix(col, bc, g*0.92);
  }
  return col;
}
vec3 sceneBloom(vec2 uv){ return blobField(toP(uv), u_warp); }

/* Mode 3 — Aura Rings */
vec3 sceneAura(vec2 uv){
  vec2 p = toP(uv);
  vec2 so = SO();
  vec2 c = (hash22(vec2(u_seed*0.37, 8.8)) - 0.5)*vec2(0.5, 0.6);
  vec2 d2 = p - c;
  float d = length(d2);
  float ang = atan(d2.y, d2.x);
  d += (0.06 + 0.08*u_warp)*fbm(vec2(ang*1.2, d*1.4) + so + LT()*0.5)*smoothstep(0.0, 0.3, d) - 0.05;
  d += 0.045*u_travel*sin(TAU*u_phase);
  float t = pow(max(d*0.66, 0.0), mix(1.55, 0.8, clamp(u_soft*0.65, 0.0, 1.0)));
  vec3 col = palette(smoothstep(0.04, 0.96, t));
  col = mix(col, u_bg, smoothstep(0.68, 1.18, t));
  col = mix(col, mix(u_bg, vec3(1.0), 0.5), smoothstep(0.26, 0.0, t)*0.45);
  float ring = exp(-pow((t - 0.46)*4.6, 2.0));
  col = mix(col, col*1.18 + 0.06, ring*0.5);
  return col;
}

/* Mode 4 — Light Rays */
vec3 sceneRays(vec2 uv){
  vec2 p = toP(uv);
  vec2 so = SO();
  vec2 O = vec2((hash11(u_seed+1.7)-0.5)*0.8, 1.9);
  vec2 dir = p - O;
  float ang = atan(dir.x, -dir.y);
  float r = length(dir);
  float beams = fbm(vec2(ang*(2.0+u_lines*0.12), 0.0) + so + LT()*0.5);
  beams = pow(clamp(beams*1.25, 0.0, 1.0), 2.0+u_warp*2.0);
  float fall = smoothstep(3.4, 0.7, r);
  float glowB = beams*fall;
  vec3 col = u_bg;
  vec3 beamCol = palette(clamp(0.85 - glowB*0.9, 0.0, 1.0));
  col = mix(col, beamCol, clamp(glowB*1.7, 0.0, 1.0));
  col = mix(col, palette(0.92), smoothstep(1.2, 3.2, r)*0.85);
  return col;
}

/* Mode 5 — Halftone */
vec3 sceneHalftone(vec2 uv){
  float asp = u_res.x/u_res.y;
  vec2 so = SO(), lt = LT();
  vec2 guv = uv*vec2(asp,1.0)*u_cell*0.55;
  vec2 gp = floor(guv);
  vec2 gf = fract(guv)-0.5;
  vec2 cuv = (gp+0.5)/(u_cell*0.55)/vec2(asp,1.0);
  vec2 cp = toP(cuv);
  vec2 q = cp + u_warp*0.9*vec2(fbm(cp*0.7+so+lt)-0.5, fbm(cp*0.7-so-lt)-0.5)*2.0;
  float f = fbm(q + so);
  f = smoothstep(0.30, 0.80, f);
  float radius = sqrt(f)*0.62;
  float dotm = smoothstep(radius, radius-0.12, length(gf));
  float hueF = fbm(q*0.55 + so + 31.7);
  vec3 ink = palette(clamp(hueF*1.5 - 0.22, 0.0, 1.0));
  return mix(u_bg, ink, dotm*(0.30 + 0.70*f));
}

/* Mode 6 — Data Glyphs */
const int GLYPHS[8] = int[8](31599, 11415, 29330, 31727, 1488, 448, 128, 9362);
vec3 sceneGlyphs(vec2 uv){
  float asp = u_res.x/u_res.y;
  vec2 so = SO(), lt = LT();
  vec2 guv = uv*vec2(asp,1.0)*vec2(u_cell*0.5, u_cell*0.5/1.55);
  vec2 gp = floor(guv);
  vec2 gf = fract(guv);
  vec2 cuv = (gp+0.5)/vec2(u_cell*0.5, u_cell*0.5/1.55)/vec2(asp,1.0);
  vec2 cp = toP(cuv);
  float b = fbm(cp*0.8 + so + lt);
  b = pow(clamp(b*1.65 - 0.30, 0.0, 1.0), 2.3);
  float step8 = floor(u_phase*8.0);
  b *= 0.55 + 0.9*hash21(vec2(gp.x*1.31, step8));
  b += 0.018;
  float swap = hash21(gp + vec2(floor(u_phase*8.0)*13.0, u_seed));
  int gi = int(floor(swap*7.999));
  int glyph = GLYPHS[gi];
  vec2 cell = gf;
  cell = (cell - 0.5)/0.74 + 0.5;
  vec3 col = u_bg;
  if (cell.x > 0.0 && cell.x < 1.0 && cell.y > 0.0 && cell.y < 1.0){
    int px = int(floor(cell.x*3.0));
    int py = int(floor((1.0-cell.y)*5.0));
    int bit = (glyph >> ((4-py)*3 + (2-px))) & 1;
    vec3 ink = palette(clamp(b*1.3, 0.0, 1.0));
    col += ink * float(bit) * b * 2.2;
  }
  return col;
}

/* Mode 7 — Reeded Glass */
vec3 boldField(vec2 p){
  vec2 so = SO();
  float f1 = fbm(p*0.40 + so + LT()*0.7);
  float ang = TAU*hash11(u_seed*0.071 + 2.0);
  float diag = 0.5 + 0.30*(cos(ang)*p.x + sin(ang)*p.y);
  vec3 col = palette(clamp(diag + (f1-0.5)*1.5, 0.0, 1.0));
  col = mix(col, u_bg, smoothstep(0.60, 0.18, f1)*0.85);
  return col;
}
vec3 sceneReeded(vec2 uv){
  float ridgeFreq = max(u_lines*0.55, 6.0);
  float nx = uv.x * ridgeFreq;
  float ci = floor(nx);
  float lx = fract(nx) - 0.5;
  float lens = sin(lx*PI);
  float refr = lx*0.22*u_warp + lens*0.08*u_warp;
  float srcX = (ci + 0.5 + refr) / ridgeFreq;
  vec3 col = boldField(toP(vec2(srcX, uv.y))*0.8);
  float ridge = cos(lx*PI);
  float shade = 0.78 + 0.28*ridge;
  float groove = smoothstep(0.48, 0.40, abs(lx));
  col *= mix(0.54, shade, groove);
  float spec = pow(max(ridge, 0.0), mix(12.0, 36.0, clamp(u_gloss/120.0, 0.0, 1.0)));
  col += vec3(1.0)*spec*u_light*0.14;
  return col;
}

/* Mode 8 — Pixel Bloom (Mosaic) */
vec3 sceneMosaic(vec2 uv){
  float asp = u_res.x/u_res.y;
  float cells = max(u_cell*0.22, 3.0);
  vec2 g = vec2(cells*asp, cells);
  vec2 q = (floor(uv*g)+0.5)/g;
  vec3 col = blobField(toP(q), u_warp*0.5);
  float h = hash21(floor(uv*g)+u_seed);
  col *= 0.97 + 0.05*h;
  return col;
}

vec3 sceneFor(int m, vec2 uv){
  if (m == 0) return sceneChrome(uv);
  if (m == 1) return sceneSilk(uv);
  if (m == 2) return sceneBloom(uv);
  if (m == 3) return sceneAura(uv);
  if (m == 4) return sceneRays(uv);
  if (m == 5) return sceneHalftone(uv);
  if (m == 6) return sceneGlyphs(uv);
  if (m == 7) return sceneReeded(uv);
  return sceneMosaic(uv);
}

void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  vec3 col = sceneFor(u_mode, uv);

  if (u_ca > 0.004){
    float asp0 = u_res.x/u_res.y;
    float r2 = length((uv - 0.5)*vec2(asp0, 1.0));
    float w = clamp(u_ca, 0.0, 1.0)*smoothstep(0.18, 0.85, r2)*0.45;
    vec3 shifted = vec3(hueRotate(col, 10.0).r, col.g, hueRotate(col, -10.0).b);
    col = mix(col, shifted, w);
  }

  float lum = dot(col, vec3(0.299,0.587,0.114));
  col += u_glow * col * lum * 0.85;

  if (abs(u_hue) > 0.5) col = hueRotate(col, u_hue);
  float l2 = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(l2), col, u_sat);
  col *= u_exposure;
  col = (col - 0.5)*u_contrast + 0.5;

  float asp = u_res.x/u_res.y;
  vec2 vc = (uv-0.5)*vec2(asp,1.0);
  col *= 1.0 - u_vig*smoothstep(0.35, 1.05, length(vc));

  float gstep = floor(u_phase*24.0);
  float gr = hash21(gl_FragCoord.xy*0.71 + vec2(gstep*3.1, gstep*7.7));
  col += (gr-0.5)*u_grain*0.55;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ─── Palette Data ────────────────────────────────────────────── */

interface LumenPalette {
  name: string;
  bg: string;
  colors: [string, string, string, string];
}

const PALETTES: LumenPalette[] = [
  { name: "Inferno Chrome", bg: "#050507", colors: ["#e0220a", "#ff5a1f", "#1f8cff", "#bfe7ff"] },
  { name: "Neon Silk", bg: "#040406", colors: ["#19e3e3", "#ff2d78", "#ff7a1a", "#7a2dff"] },
  { name: "Ultraviolet", bg: "#06040c", colors: ["#2440ff", "#8a2bff", "#e22bd0", "#ff5470"] },
  { name: "Ember", bg: "#070403", colors: ["#ff6a00", "#ffb347", "#a81c00", "#3d0c02"] },
  { name: "Deep Signal", bg: "#030608", colors: ["#0e3a5c", "#2e7fb8", "#9fd4e8", "#16222e"] },
  { name: "Acid Garden", bg: "#04070a", colors: ["#b8ff2e", "#1fd9a4", "#0a7a5c", "#eaffd0"] },
  { name: "Blush", bg: "#fbf6f2", colors: ["#d4607a", "#f0b890", "#fde8d8", "#b8434f"] },
  { name: "Prism Pastel", bg: "#f4f1fa", colors: ["#ffb340", "#2b3bd4", "#ff4f9a", "#9a8cff"] },
  { name: "Velvet Dusk", bg: "#08050c", colors: ["#ff3d2e", "#ff8c5a", "#5a1eb8", "#1a0a3c"] },
];

/* ─── Preset Params per Mode ──────────────────────────────────── */

interface LumenParams {
  mode: number;
  seed: number;
  palette: number;
  phase: number;
  scale: number;
  complex: number;
  warp: number;
  flow: number;
  stretch: number;
  light: number;
  gloss: number;
  lightAngle: number;
  irid: number;
  glow: number;
  grain: number;
  cell: number;
  lines: number;
  ca: number;
  vig: number;
  soft: number;
  travel: number;
  hue: number;
  sat: number;
  exposure: number;
  contrast: number;
}

const MODE_PRESETS: LumenParams[] = [
  // 0 Chrome
  { mode: 0, seed: 4217, palette: 0, phase: 0.35, scale: 1.8, complex: 4.5, warp: 1.3, flow: 0.6, stretch: 0.4, light: 1.6, gloss: 60, lightAngle: 220, irid: 0.5, glow: 0.3, grain: 0.04, cell: 80, lines: 60, ca: 0.15, vig: 0.3, soft: 1.0, travel: 0.7, hue: 0, sat: 1.1, exposure: 1.0, contrast: 1.1 },
  // 1 Silk
  { mode: 1, seed: 7331, palette: 1, phase: 0.2, scale: 1.5, complex: 4, warp: 0.7, flow: 0.3, stretch: 0.1, light: 1.4, gloss: 50, lightAngle: 180, irid: 0.4, glow: 0.35, grain: 0.03, cell: 80, lines: 65, ca: 0.08, vig: 0.25, soft: 1.1, travel: 0.5, hue: 0, sat: 1.2, exposure: 1.0, contrast: 1.05 },
  // 2 Bloom
  { mode: 2, seed: 2048, palette: 7, phase: 0.5, scale: 1.2, complex: 4, warp: 0.8, flow: 0.4, stretch: 0, light: 0.4, gloss: 30, lightAngle: 0, irid: 0.1, glow: 0.1, grain: 0.02, cell: 80, lines: 60, ca: 0.05, vig: 0.1, soft: 1.2, travel: 0.8, hue: 0, sat: 1.0, exposure: 1.0, contrast: 1.0 },
  // 3 Aura
  { mode: 3, seed: 5555, palette: 2, phase: 0.4, scale: 1.3, complex: 4, warp: 0.5, flow: 0.2, stretch: 0, light: 0.5, gloss: 30, lightAngle: 0, irid: 0.2, glow: 0.15, grain: 0.02, cell: 80, lines: 60, ca: 0.03, vig: 0.15, soft: 1.3, travel: 0.5, hue: 0, sat: 1.0, exposure: 1.0, contrast: 1.0 },
  // 4 Rays
  { mode: 4, seed: 1234, palette: 5, phase: 0.3, scale: 1.1, complex: 5, warp: 0.8, flow: 0.5, stretch: 0, light: 0.7, gloss: 40, lightAngle: 0, irid: 0.15, glow: 0.3, grain: 0.04, cell: 80, lines: 55, ca: 0.1, vig: 0.2, soft: 1.0, travel: 0.4, hue: 0, sat: 1.2, exposure: 1.0, contrast: 1.05 },
  // 5 Halftone
  { mode: 5, seed: 8080, palette: 6, phase: 0.6, scale: 1.3, complex: 4.5, warp: 0.9, flow: 0.3, stretch: 0, light: 0.5, gloss: 30, lightAngle: 0, irid: 0, glow: 0.05, grain: 0.02, cell: 100, lines: 60, ca: 0.05, vig: 0.1, soft: 1.0, travel: 0.6, hue: 0, sat: 1.1, exposure: 1.0, contrast: 1.05 },
  // 6 Glyphs
  { mode: 6, seed: 3030, palette: 8, phase: 0.15, scale: 1.0, complex: 5, warp: 1.0, flow: 0.4, stretch: 0, light: 1.0, gloss: 50, lightAngle: 0, irid: 0, glow: 0.5, grain: 0.06, cell: 100, lines: 60, ca: 0.25, vig: 0.4, soft: 1.0, travel: 0.6, hue: 0, sat: 1.3, exposure: 0.95, contrast: 1.15 },
  // 7 Reeded
  { mode: 7, seed: 9015, palette: 3, phase: 0.4, scale: 0.9, complex: 5.5, warp: 1.1, flow: 0.2, stretch: -0.1, light: 1.2, gloss: 44, lightAngle: 235, irid: 0, glow: 0.47, grain: 0.02, cell: 113, lines: 67, ca: 0.02, vig: 0.08, soft: 1.14, travel: 0.72, hue: 23, sat: 0.55, exposure: 1.02, contrast: 0.96 },
  // 8 Mosaic
  { mode: 8, seed: 6666, palette: 1, phase: 0.7, scale: 1.1, complex: 4, warp: 0.7, flow: 0.3, stretch: 0, light: 0.3, gloss: 30, lightAngle: 0, irid: 0, glow: 0.1, grain: 0.02, cell: 70, lines: 60, ca: 0.05, vig: 0.1, soft: 1.1, travel: 0.8, hue: 0, sat: 1.1, exposure: 1.0, contrast: 1.0 },
];

/* ─── WebGL2 Renderer ─────────────────────────────────────────── */

function hexToRgb01(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compile error: ' + log);
  }
  return sh;
}

/**
 * Render a single Lumen mode to an HTMLImageElement.
 */
export function renderLumenMode(modeIdx: number, width = 720, height = 480): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false })!;
      if (!gl) { reject(new Error('WebGL2 not available')); return; }

      const prog = gl.createProgram()!;
      gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT_SRC));
      gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        reject(new Error('Program link: ' + gl.getProgramInfoLog(prog)));
        return;
      }
      gl.useProgram(prog);

      // Full-screen triangle
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // Set uniforms from mode preset
      const p = MODE_PRESETS[modeIdx];
      const pal = PALETTES[p.palette];

      const u = (name: string) => gl.getUniformLocation(prog, name);
      gl.uniform2f(u('u_res'), width, height);
      gl.uniform1f(u('u_phase'), p.phase);
      gl.uniform1f(u('u_seed'), p.seed);
      gl.uniform1i(u('u_mode'), p.mode);
      gl.uniform3fv(u('u_c1'), hexToRgb01(pal.colors[0]));
      gl.uniform3fv(u('u_c2'), hexToRgb01(pal.colors[1]));
      gl.uniform3fv(u('u_c3'), hexToRgb01(pal.colors[2]));
      gl.uniform3fv(u('u_c4'), hexToRgb01(pal.colors[3]));
      gl.uniform3fv(u('u_bg'), hexToRgb01(pal.bg));
      gl.uniform1f(u('u_hue'), p.hue);
      gl.uniform1f(u('u_sat'), p.sat);
      gl.uniform1f(u('u_exposure'), p.exposure);
      gl.uniform1f(u('u_contrast'), p.contrast);
      gl.uniform1f(u('u_scale'), p.scale);
      gl.uniform1f(u('u_complex'), p.complex);
      gl.uniform1f(u('u_warp'), p.warp);
      gl.uniform1f(u('u_flow'), p.flow);
      gl.uniform1f(u('u_stretch'), p.stretch);
      gl.uniform1f(u('u_light'), p.light);
      gl.uniform1f(u('u_gloss'), p.gloss);
      gl.uniform1f(u('u_lightAngle'), p.lightAngle);
      gl.uniform1f(u('u_irid'), p.irid);
      gl.uniform1f(u('u_glow'), p.glow);
      gl.uniform1f(u('u_grain'), p.grain);
      gl.uniform1f(u('u_cell'), p.cell);
      gl.uniform1f(u('u_lines'), p.lines);
      gl.uniform1f(u('u_ca'), p.ca);
      gl.uniform1f(u('u_vig'), p.vig);
      gl.uniform1f(u('u_soft'), p.soft);
      gl.uniform1f(u('u_travel'), p.travel);

      // Draw
      gl.viewport(0, 0, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Read to image
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('toBlob failed')); return; }
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = url;
        // Cleanup GL
        gl.deleteProgram(prog);
        gl.deleteBuffer(buf);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }, 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

/* ─── Mode Labels ─────────────────────────────────────────────── */

export const LUMEN_MODES = [
  { id: 0, label: 'CHROME', hint: 'Liquid Chrome — molten metal reflections' },
  { id: 1, label: 'SILK', hint: 'Silk Ribbons — flowing strands' },
  { id: 2, label: 'BLOOM', hint: 'Soft Bloom — glowing orbs' },
  { id: 3, label: 'AURA', hint: 'Aura Rings — radial gradients' },
  { id: 4, label: 'RAYS', hint: 'Light Rays — angular beams' },
  { id: 5, label: 'HALFTONE', hint: 'Halftone — dot grid patterns' },
  { id: 6, label: 'GLYPHS', hint: 'Data Glyphs — matrix rain characters' },
  { id: 7, label: 'REEDED', hint: 'Reeded Glass — refracted strips' },
  { id: 8, label: 'MOSAIC', hint: 'Pixel Bloom — mosaic blocks' },
];
