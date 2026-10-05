// Minimal WebGL2 helpers: programs, textures, framebuffers.

export const VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export class ShaderError extends Error {
  constructor(message: string, public source: string, public log: string) {
    super(message);
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export interface Program {
  prog: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
  ready: boolean;
  vs: WebGLShader;
  fs: WebGLShader;
  src: string;
  failed?: string;
}

/**
 * Creates a program. Compilation status is checked lazily (`ensureLinked`) so the
 * driver can compile in parallel when KHR_parallel_shader_compile is present.
 */
export function createProgram(gl: WebGL2RenderingContext, frag: string): Program {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.linkProgram(prog);
  return { prog, uniforms: new Map(), ready: false, vs, fs, src: frag };
}

export function isProgramDone(gl: WebGL2RenderingContext, p: Program, ext: unknown): boolean {
  if (p.ready || p.failed) return true;
  if (!ext) return true;
  return !!gl.getProgramParameter(p.prog, 0x91b1 /* COMPLETION_STATUS_KHR */);
}

export function ensureLinked(gl: WebGL2RenderingContext, p: Program): boolean {
  if (p.ready) return true;
  if (p.failed) return false;
  if (!gl.getProgramParameter(p.prog, gl.LINK_STATUS)) {
    const log = gl.getShaderInfoLog(p.fs) || gl.getProgramInfoLog(p.prog) || 'unknown';
    p.failed = log;
    // Print the failing lines with context to ease debugging.
    const lines = p.src.split('\n');
    const m = /ERROR: \d+:(\d+)/.exec(log);
    const at = m ? parseInt(m[1], 10) : 0;
    const ctx = at ? lines.slice(Math.max(0, at - 4), at + 2).map((l, i) => `${at - 3 + i}: ${l}`).join('\n') : '';
    console.error('[engine] shader failed:\n' + log + '\n' + ctx);
    return false;
  }
  p.ready = true;
  return true;
}

export function uni(gl: WebGL2RenderingContext, p: Program, name: string): WebGLUniformLocation | null {
  let loc = p.uniforms.get(name);
  if (loc === undefined) {
    loc = gl.getUniformLocation(p.prog, name);
    p.uniforms.set(name, loc);
  }
  return loc;
}

export interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export function createTexture(gl: WebGL2RenderingContext, w = 1, h = 1, filter: number = gl.LINEAR): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tex;
}

export function createTarget(gl: WebGL2RenderingContext, w: number, h: number): Target {
  const tex = createTexture(gl, w, h);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}

export function resizeTarget(gl: WebGL2RenderingContext, t: Target, w: number, h: number) {
  if (t.w === w && t.h === h) return;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  t.w = w;
  t.h = h;
}

export function deleteTarget(gl: WebGL2RenderingContext, t: Target) {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16) || 0;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
