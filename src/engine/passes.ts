// Fixed pipeline passes: pre-adjust, blur, bloom, post FX and final composite.
import { COMMON } from './shaderLib';

const HEAD = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 o_col;
${COMMON}
`;

/** Maps output uv -> raw source texture uv (crop + rotate + flip). */
const SRC_UV = `
uniform vec4 u_crop;   // x, y, w, h (top-left origin, source-relative)
uniform int u_rot;     // 0, 1, 2, 3 (x90 degrees clockwise)
uniform vec2 u_flip;   // 1 = flip
uniform float u_srcNoFlip; // ImageBitmap uploads ignore UNPACK_FLIP_Y
vec2 srcUV(vec2 uv){
  vec2 q = vec2(uv.x, 1.0 - uv.y);
  if (u_flip.x > 0.5) q.x = 1.0 - q.x;
  if (u_flip.y > 0.5) q.y = 1.0 - q.y;
  if (u_rot == 1) q = vec2(q.y, 1.0 - q.x);
  else if (u_rot == 2) q = vec2(1.0 - q.x, 1.0 - q.y);
  else if (u_rot == 3) q = vec2(1.0 - q.y, q.x);
  vec2 s = u_crop.xy + q * u_crop.zw;
  return vec2(s.x, u_srcNoFlip > 0.5 ? s.y : 1.0 - s.y);
}
`;

export const PRE_FRAG = `${HEAD}
uniform sampler2D u_src;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
${SRC_UV}
uniform float u_exposure, u_brightness, u_contrast, u_saturation, u_vibrance, u_hue, u_gray, u_temp;
uniform float u_invert;
uniform int u_filter;
uniform vec3 u_tint; uniform float u_tintOp; uniform int u_tintBlend;
uniform vec3 u_grad[8]; uniform int u_gradN; uniform float u_gradOn;
uniform float u_lightsOn; uniform int u_lightMode; uniform float u_lightR, u_lightI, u_ambient, u_flicker;
uniform vec3 u_lightC;
uniform vec4 u_lp[4]; uniform vec3 u_lpc[4]; uniform int u_lpN;
vec3 gmap(float t){
  t = clamp(t, 0.0, 1.0) * float(u_gradN - 1);
  int i = int(floor(t));
  vec3 a = u_grad[0], b = u_grad[0];
  for (int k = 0; k < 8; k++){ if (k == i) a = u_grad[k]; if (k == min(i + 1, u_gradN - 1)) b = u_grad[k]; }
  return mix(a, b, fract(t));
}
vec3 photoFilter(vec3 c, int f){
  float l = luma(c);
  if (f == 1) return vec3(l);
  if (f == 2) return vec3(dot(c, vec3(.393,.769,.189)), dot(c, vec3(.349,.686,.168)), dot(c, vec3(.272,.534,.131)));
  if (f == 3) return c * vec3(1.08, 1.0, 0.86) + vec3(0.03, 0.01, 0.0);
  if (f == 4) return c * vec3(0.88, 0.98, 1.1);
  if (f == 5) return mix(vec3(l), c, 0.65) * vec3(1.06, 0.98, 0.82) + vec3(0.06, 0.04, 0.02);
  if (f == 6) return mix(c, vec3(0.5), 0.18) + 0.04;
  if (f == 7) return vec3(c.r * 0.8 + c.b * 0.3, c.g * 0.6 + 0.1 * l, c.b * 1.15 + c.r * 0.15);
  if (f == 8) { float k = smoothstep(0.15, 0.85, l); return vec3(k); }
  if (f == 9) return clamp((c - 0.5) * 1.25 + 0.5, 0.0, 1.0) * 1.05;
  if (f == 10) return mix(c, vec3(l), 0.15) * 0.9 + 0.08;
  if (f == 11) { vec3 sh = vec3(0.0, 0.45, 0.55); vec3 hi = vec3(1.0, 0.62, 0.3); return mix(c, mix(sh, hi, l) * (0.6 + l * 0.6), 0.35); }
  return c;
}
void main(){
  vec2 suv = srcUV(v_uv);
  vec4 s = texture(u_src, suv);
  vec3 c = s.rgb;
  // Lights
  if (u_lightsOn > 0.5){
    float asp = u_res.x / u_res.y;
    vec3 L = vec3(u_ambient);
    float fl = 1.0 - u_flicker * (0.25 * vnoise(vec2(u_time * 9.0, 0.0)));
    if (u_lightMode == 0){
      vec2 d = (v_uv - u_mouse) * vec2(asp, 1.0);
      L += u_lightC * u_lightI * fl * exp(-dot(d, d) / max(u_lightR * u_lightR, 1e-4));
    } else {
      for (int i = 0; i < 4; i++){
        if (i >= u_lpN) break;
        vec2 d = (v_uv - u_lp[i].xy) * vec2(asp, 1.0);
        L += u_lpc[i] * u_lightI * fl * exp(-dot(d, d) / max(u_lightR * u_lightR, 1e-4));
      }
    }
    c *= L;
  }
  c *= exp2(u_exposure);
  c += u_brightness;
  c = (c - 0.5) * u_contrast + 0.5;
  c += vec3(u_temp, u_temp * 0.2, -u_temp) * 0.12;
  c = clamp(c, 0.0, 1.0);
  if (u_filter > 0) c = clamp(photoFilter(c, u_filter), 0.0, 1.0);
  if (u_hue != 0.0){ vec3 h = rgb2hsv(c); h.x = fract(h.x + u_hue); c = hsv2rgb(h); }
  float l = luma(c);
  c = mix(vec3(l), c, u_saturation);
  if (u_vibrance != 0.0){
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    float sat = mx - mn;
    c = mix(vec3(luma(c)), c, 1.0 + u_vibrance * (1.0 - sat));
  }
  c = clamp(c, 0.0, 1.0);
  if (u_tintOp > 0.0){
    vec3 t = u_tint;
    vec3 b = u_tintBlend == 0 ? c * t : u_tintBlend == 1 ? 1.0 - (1.0 - c) * (1.0 - t) : u_tintBlend == 2 ? mix(2.0 * c * t, 1.0 - 2.0 * (1.0 - c) * (1.0 - t), step(0.5, c)) : t * (0.25 + luma(c) * 1.1);
    c = mix(c, b, u_tintOp);
  }
  if (u_gradOn > 0.0) c = mix(c, gmap(luma(c)), u_gradOn);
  c = mix(c, vec3(luma(c)), u_gray);
  if (u_invert > 0.5) c = 1.0 - c;
  o_col = vec4(clamp(c, 0.0, 1.0), s.a);
}`;

/** Separable gaussian. */
export const BLUR1D_FRAG = `${HEAD}
uniform sampler2D u_src;
uniform vec2 u_dir;    // texel step * direction
uniform float u_sigma; // in texels
void main(){
  if (u_sigma < 0.3){ o_col = texture(u_src, v_uv); return; }
  float s = u_sigma;
  int n = int(min(ceil(s * 2.5), 40.0));
  float stepMul = max(1.0, (s * 2.5) / 40.0);
  vec4 acc = texture(u_src, v_uv);
  float wsum = 1.0;
  for (int i = 1; i <= 40; i++){
    if (i > n) break;
    float x = float(i) * stepMul;
    float w = exp(-0.5 * x * x / (s * s));
    acc += (texture(u_src, v_uv + u_dir * x) + texture(u_src, v_uv - u_dir * x)) * w;
    wsum += 2.0 * w;
  }
  o_col = acc / wsum;
}`;

/** Variable / directional blurs (lens, tilt-shift, radial, zoom, glassy, perspective, progressive). */
export const BLUR2D_FRAG = `${HEAD}
uniform sampler2D u_src;
uniform vec2 u_res;
uniform int u_type;
uniform float u_amount; // render px
uniform float u_angle;
uniform float u_focus, u_spread;
uniform vec2 u_center;
void main(){
  vec2 uv = v_uv;
  float asp = u_res.x / u_res.y;
  vec2 px = 1.0 / u_res;
  vec2 dir = vec2(cos(u_angle), sin(u_angle));
  float r = u_amount;
  if (u_type == 2){
    float d = length((uv - u_center) * vec2(asp, 1.0));
    r *= smoothstep(u_spread * 0.6, u_spread * 0.6 + 0.35, d);
  } else if (u_type == 3){
    vec2 n = vec2(-dir.y, dir.x);
    float d = abs(dot(uv - vec2(0.5, u_focus), n * vec2(asp, 1.0)) );
    r *= smoothstep(u_spread * 0.35, u_spread * 0.35 + 0.22, d);
  } else if (u_type == 8){
    r *= pow(clamp(abs(uv.y - u_focus) * (2.2 - u_spread * 1.6), 0.0, 1.0), 1.4);
  } else if (u_type == 9){
    float t = dot(uv - 0.5, dir) + 0.5;
    r *= smoothstep(u_focus, u_focus + max(u_spread, 0.02), t);
  }
  if (r < 0.5){ o_col = texture(u_src, uv); return; }
  vec4 acc = vec4(0.0); float ws = 0.0;
  if (u_type == 4){
    for (int i = -16; i <= 16; i++){
      float t = float(i) / 16.0;
      acc += texture(u_src, uv + dir * px * r * t); ws += 1.0;
    }
  } else if (u_type == 5){
    vec2 p = (uv - u_center) * vec2(asp, 1.0);
    float ang = r * 0.0025;
    for (int i = -16; i <= 16; i++){
      float t = float(i) / 16.0 * ang;
      vec2 q = rot2(t) * p;
      acc += texture(u_src, q / vec2(asp, 1.0) + u_center); ws += 1.0;
    }
  } else if (u_type == 6){
    vec2 d = uv - u_center;
    for (int i = 0; i < 32; i++){
      float t = float(i) / 31.0;
      acc += texture(u_src, u_center + d * (1.0 - t * r * 0.004)); ws += 1.0;
    }
  } else {
    vec2 off = vec2(0.0);
    if (u_type == 7){ off = (vec2(vnoise(uv * 40.0), vnoise(uv * 40.0 + 7.3)) - 0.5) * r * 2.0 * px; }
    float ga = 2.39996323;
    for (int i = 0; i < 48; i++){
      float fi = float(i) + 0.5;
      float rr = sqrt(fi / 48.0) * r;
      vec2 o = vec2(cos(fi * ga), sin(fi * ga)) * rr * px;
      acc += texture(u_src, uv + off + o); ws += 1.0;
    }
  }
  o_col = acc / ws;
}`;

export const BRIGHT_FRAG = `${HEAD}
uniform sampler2D u_src;
uniform float u_threshold;
void main(){
  vec4 c = texture(u_src, v_uv);
  float l = luma(c.rgb);
  o_col = vec4(c.rgb * smoothstep(u_threshold, u_threshold + 0.25, l), 1.0);
}`;

export const COPY_FRAG = `${HEAD}
uniform sampler2D u_src;
void main(){ o_col = texture(u_src, v_uv); }`;

export const POST_FRAG = `${HEAD}
uniform sampler2D u_src;
uniform sampler2D u_bloom;
uniform sampler2D u_atlas;
uniform vec2 u_res;
uniform float u_k;
uniform float u_time;
uniform float u_glyphN; uniform vec2 u_atlasGrid;
uniform vec4 u_levels; uniform float u_gamma; uniform float u_levelsOn;
uniform int u_curve; uniform float u_curveAmt;
uniform vec2 u_vignette;
uniform vec2 u_scan;
uniform float u_crt;
uniform float u_chroma;
uniform float u_bloomAmt, u_glowAmt;
uniform vec3 u_ptint; uniform float u_ptintAmt;
uniform vec2 u_grain;
uniform vec2 u_glitch;
uniform vec2 u_rgbs;
uniform float u_pixel;
uniform vec3 u_half;
uniform vec3 u_ascii;
uniform float u_sharpen, u_thresh, u_noise;
vec3 tap(vec2 uv){ return texture(u_src, uv).rgb; }
float curve(float x){
  if (u_curve == 1) return smoothstep(0.0, 1.0, x);
  if (u_curve == 2) return x * x * (3.0 - 2.0 * x) * 0.5 + x * 0.5 + 0.06 * (1.0 - x);
  if (u_curve == 3) return pow(x, 0.75);
  if (u_curve == 4) return pow(x, 1.35);
  if (u_curve == 5) return 1.0 - smoothstep(0.0, 1.0, 1.0 - x) * 0.9 - 0.05;
  return x;
}
void main(){
  vec2 uv = v_uv;
  vec2 px = 1.0 / u_res;
  if (u_crt > 0.0){
    vec2 c = uv * 2.0 - 1.0;
    c *= 1.0 + u_crt * 0.12 * vec2(c.y * c.y, c.x * c.x);
    uv = c * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0){ o_col = vec4(0.0, 0.0, 0.0, 1.0); return; }
  }
  if (u_glitch.x > 0.0){
    float sl = max(u_glitch.y, 2.0) * u_k;
    float row = floor(uv.y * u_res.y / sl);
    float t = floor(u_time * 12.0);
    float r = hash12(vec2(row, t));
    if (r < u_glitch.x * 0.35) uv.x += (hash12(vec2(row, t + 3.1)) - 0.5) * u_glitch.x * 0.2;
  }
  if (u_pixel > 1.0){ vec2 cs = vec2(u_pixel * u_k); uv = (floor(uv * u_res / cs) + 0.5) * cs / u_res; }
  float alpha = texture(u_src, uv).a;
  vec3 col;
  if (u_rgbs.x > 0.0 || u_chroma > 0.0){
    vec2 d = vec2(cos(u_rgbs.y), sin(u_rgbs.y)) * u_rgbs.x * u_k * px;
    vec2 cd = (uv - 0.5) * u_chroma * 0.02;
    col = vec3(tap(uv + d + cd).r, tap(uv).g, tap(uv - d - cd).b);
  } else col = tap(uv);
  if (u_sharpen > 0.0){
    vec3 b = (tap(uv + vec2(px.x, 0.0)) + tap(uv - vec2(px.x, 0.0)) + tap(uv + vec2(0.0, px.y)) + tap(uv - vec2(0.0, px.y))) * 0.25;
    col = clamp(col + (col - b) * u_sharpen * 2.0, 0.0, 1.0);
  }
  vec3 bl = texture(u_bloom, uv).rgb;
  col += bl * (u_bloomAmt * 1.5 + u_glowAmt * 2.5);
  alpha = max(alpha, clamp(luma(bl) * (u_bloomAmt + u_glowAmt) * 2.0, 0.0, 1.0));
  if (u_levelsOn > 0.5){
    col = clamp((col - u_levels.x) / max(u_levels.y - u_levels.x, 1e-3), 0.0, 1.0);
    col = pow(col, vec3(1.0 / max(u_gamma, 0.05)));
    col = mix(vec3(u_levels.z), vec3(u_levels.w), col);
  }
  if (u_curve > 0) col = mix(col, vec3(curve(col.r), curve(col.g), curve(col.b)), u_curveAmt);
  if (u_ptintAmt > 0.0) col = mix(col, col * u_ptint * 1.4 + u_ptint * 0.05, u_ptintAmt);
  if (u_thresh > 0.0) col = vec3(step(u_thresh, luma(col)));
  if (u_half.x > 0.0){
    float cs = u_half.x * u_k;
    vec2 p = rot2(0.785398) * (uv * u_res);
    vec2 id = floor(p / cs);
    vec2 f = fract(p / cs) - 0.5;
    vec2 cpx = rot2(-0.785398) * ((id + 0.5) * cs);
    vec3 cc = tap(cpx / u_res);
    float l = luma(cc);
    float d;
    if (u_half.y < 0.5) d = length(f) - sqrt(l) * 0.62;
    else if (u_half.y < 1.5) d = max(abs(f.x), abs(f.y)) - sqrt(l) * 0.5;
    else d = abs(f.y) - l * 0.5;
    float m = aa(d * cs, 1.0);
    col = (u_half.z > 0.5 ? vec3(1.0) : cc / max(l, 0.2) * 0.9) * m;
  }
  if (u_ascii.x > 0.0){
    vec2 cs = vec2(u_ascii.x * 0.62, u_ascii.x) * u_k;
    vec2 p = vec2(uv.x, 1.0 - uv.y) * u_res;
    vec2 id = floor(p / cs);
    vec2 f = fract(p / cs);
    vec2 cuv = (id + 0.5) * cs; cuv = vec2(cuv.x, u_res.y - cuv.y) / u_res;
    vec3 cc = tap(cuv);
    float l = luma(cc);
    float idx = floor((1.0 - l) * (u_glyphN - 0.001));
    vec2 g = vec2(mod(idx, u_atlasGrid.x), floor(idx / u_atlasGrid.x));
    vec2 a = vec2(0.5 + (f.x - 0.5) * cs.x / cs.y, f.y);
    float m = textureGrad(u_atlas, (g + a) / u_atlasGrid, vec2(1.0 / (cs.y * u_atlasGrid.x), 0.0), vec2(0.0, 1.0 / (cs.y * u_atlasGrid.y))).a;
    col = (u_ascii.z > 0.5 ? vec3(0.92) : cc * 1.25) * m;
  }
  if (u_scan.x > 0.0){
    float dens = max(u_scan.y, 1.0) * u_k;
    float s = 0.5 + 0.5 * sin(uv.y * u_res.y / dens * PI);
    col *= 1.0 - u_scan.x * 0.6 * (1.0 - s);
  }
  if (u_crt > 0.0){
    float m = mod(floor(uv.x * u_res.x / max(u_k, 1.0)), 3.0);
    vec3 mask = m < 1.0 ? vec3(1.0, 0.7, 0.7) : m < 2.0 ? vec3(0.7, 1.0, 0.7) : vec3(0.7, 0.7, 1.0);
    col *= mix(vec3(1.0), mask, u_crt * 0.6);
    vec2 c = uv * 2.0 - 1.0;
    col *= 1.0 - u_crt * 0.5 * pow(max(abs(c.x), abs(c.y)), 8.0);
  }
  if (u_grain.x > 0.0){
    float t = floor(u_time * 24.0);
    vec2 gp = uv * u_res / max(u_k, 0.5);
    vec3 n = u_grain.y > 0.5 ? vec3(hash12(gp + t), hash12(gp + t + 11.1), hash12(gp + t + 23.7)) : vec3(hash12(gp + t));
    col += (n - 0.5) * u_grain.x * 0.35;
  }
  if (u_noise > 0.0){ col = mix(col, vec3(hash12(uv * u_res + floor(u_time * 30.0))), u_noise * 0.4); }
  if (u_vignette.x > 0.0){
    vec2 c = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
    float v = smoothstep(0.85 - u_vignette.y * 0.6, 0.15, length(c) * (0.9 + u_vignette.x * 0.4));
    col *= mix(1.0, v, u_vignette.x);
  }
  o_col = vec4(clamp(col, 0.0, 1.0), alpha);
}`;

export const FINAL_FRAG = `${HEAD}
uniform sampler2D u_fx;
uniform sampler2D u_src;
uniform sampler2D u_mask;
uniform sampler2D u_text;
uniform vec2 u_res;
${SRC_UV}
uniform float u_maskOn, u_maskInvert, u_feather;
uniform float u_textOn;
uniform float u_compare;
uniform float u_opaque;
void main(){
  vec4 fx = texture(u_fx, v_uv);
  vec4 orig = texture(u_src, srcUV(v_uv));
  vec4 c = fx;
  if (u_maskOn > 0.5){
    float m;
    if (u_feather > 0.5){
      vec2 px = u_feather / u_res;
      m = 0.0;
      for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) m += texture(u_mask, v_uv + vec2(float(i), float(j)) * px * 0.5).a;
      m /= 25.0;
    } else m = texture(u_mask, v_uv).a;
    if (u_maskInvert > 0.5) m = 1.0 - m;
    c = mix(orig, fx, m);
  }
  if (u_compare >= 0.0 && v_uv.x < u_compare) c = orig;
  if (u_textOn > 0.5){
    vec4 t = texture(u_text, v_uv);
    c.rgb = mix(c.rgb, t.rgb, t.a);
    c.a = max(c.a, t.a);
  }
  if (u_opaque > 0.5) c.a = 1.0;
  o_col = c;
}`;
