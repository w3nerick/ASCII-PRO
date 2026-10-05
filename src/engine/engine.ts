// WebGL2 render engine: source -> pre-adjust -> blur -> style layers -> post FX -> final composite.
import {
  createProgram, createTarget, createTexture, deleteTarget, ensureLinked, hexToRgb, isProgramDone, resizeTarget, uni,
  type Program, type Target,
} from './gl';
import { PRE_FRAG, BLUR1D_FRAG, BLUR2D_FRAG, BRIGHT_FRAG, POST_FRAG, FINAL_FRAG, COPY_FRAG } from './passes';
import { buildStyleFrag } from './shaderLib';
import { getStyle } from './styles';
import { buildAtlas, type GlyphAtlas } from './glyphAtlas';
import { CHARSETS, GRADIENTS, PALETTES, PALETTE_CUSTOM, PALETTE_ORIGINAL, THERMAL } from './palettes';
import type { CropRect, Layer, Look, ParamValue, StyleDef, Transform } from './types';

export const DESIGN_LONG = 1280;

const BLEND_INDEX: Record<string, number> = {
  normal: 0, multiply: 1, screen: 2, overlay: 3, softlight: 4, add: 5, difference: 6, colordodge: 7, lighten: 8, darken: 9,
};

const MATRIX_DIRS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

export interface SourceInfo {
  el: TexImageSource;
  width: number;
  height: number;
  dynamic: boolean;
}

type TextRenderer = (w: number, h: number) => HTMLCanvasElement | null;

export class Engine {
  readonly canvas: HTMLCanvasElement;
  gl!: WebGL2RenderingContext;
  private parallel: unknown = null;
  private vao!: WebGLVertexArrayObject;
  private styles = new Map<string, Program>();
  private pass!: Record<'pre' | 'blur1d' | 'blur2d' | 'bright' | 'post' | 'final' | 'copy', Program>;
  private srcTex!: WebGLTexture;
  private dummy!: WebGLTexture;
  private maskTex!: WebGLTexture;
  private textTex!: WebGLTexture;
  private atlasTex = new Map<string, { tex: WebGLTexture; atlas: GlyphAtlas }>();
  private t!: Record<'pre' | 'a' | 'b' | 'back' | 'backTmp' | 'la' | 'lb' | 'prev' | 'post' | 'bloomA' | 'bloomB', Target>;
  private out: Target | null = null;

  private source: SourceInfo | null = null;
  private sourceDirty = false;
  look: Look | null = null;
  crop: CropRect = { x: 0, y: 0, w: 1, h: 1 };
  transform: Transform = { rotate: 0, flipX: false, flipY: false };
  mouse: [number, number] = [0.5, 0.5];
  compare = -1;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskVersion = -1;
  private maskUploaded = -2;
  private textRenderer: TextRenderer | null = null;
  private textVersion = -1;
  private textUploaded = -2;
  private textSize = '';
  private w = 2;
  private h = 2;
  private k = 1;
  private hasPrev = false;
  /** True while a shader is still compiling; caller should render again. */
  pending = false;
  lost = false;
  onError: ((msg: string) => void) | null = null;

  private blocking: boolean;

  constructor(canvas: HTMLCanvasElement, opts: { blockingCompile?: boolean } = {}) {
    this.canvas = canvas;
    this.blocking = !!opts.blockingCompile;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.init();
      this.sourceDirty = true;
      this.maskUploaded = -2;
      this.textUploaded = -2;
    });
    this.init();
  }

  private init() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.parallel = this.blocking ? null : gl.getExtension('KHR_parallel_shader_compile');
    this.styles.clear();
    this.atlasTex.clear();
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;
    this.pass = {
      pre: createProgram(gl, PRE_FRAG),
      blur1d: createProgram(gl, BLUR1D_FRAG),
      blur2d: createProgram(gl, BLUR2D_FRAG),
      bright: createProgram(gl, BRIGHT_FRAG),
      post: createProgram(gl, POST_FRAG),
      final: createProgram(gl, FINAL_FRAG),
      copy: createProgram(gl, COPY_FRAG),
    };
    this.srcTex = createTexture(gl, 1, 1);
    this.dummy = createTexture(gl, 1, 1);
    this.maskTex = createTexture(gl, 1, 1);
    this.textTex = createTexture(gl, 1, 1);
    const mk = () => createTarget(gl, this.w, this.h);
    const half = () => createTarget(gl, Math.max(1, this.w >> 1), Math.max(1, this.h >> 1));
    this.t = {
      pre: mk(), a: mk(), b: mk(), la: mk(), lb: mk(), prev: mk(), post: mk(),
      back: half(), backTmp: half(), bloomA: half(), bloomB: half(),
    };
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  /* ───────── Configuration ───────── */

  setSource(src: SourceInfo | null) {
    this.source = src;
    this.sourceDirty = true;
    this.hasPrev = false;
  }

  setLook(look: Look) {
    this.look = look;
  }

  setMask(canvas: HTMLCanvasElement | null, version: number) {
    this.maskCanvas = canvas;
    this.maskVersion = version;
  }

  setTextRenderer(fn: TextRenderer | null, version: number) {
    this.textRenderer = fn;
    this.textVersion = version;
  }

  /** Output aspect ratio (w/h) after crop + rotation. */
  outputAspect(): number {
    if (!this.source) return 16 / 9;
    let a = (this.source.width * this.crop.w) / Math.max(1, this.source.height * this.crop.h);
    if (this.transform.rotate === 90 || this.transform.rotate === 270) a = 1 / a;
    return a;
  }

  /** Design-resolution size for a given long edge. */
  outputSize(long = DESIGN_LONG): { w: number; h: number } {
    const a = this.outputAspect();
    return a >= 1 ? { w: long, h: Math.max(1, Math.round(long / a)) } : { w: Math.max(1, Math.round(long * a)), h: long };
  }

  get maxSize() {
    const gl = this.gl;
    return Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), 8192);
  }

  /** Resize the internal pipeline. k = render px per design px. */
  setSize(w: number, h: number, k: number) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    this.k = k;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    const gl = this.gl;
    for (const key of ['pre', 'a', 'b', 'la', 'lb', 'prev', 'post'] as const) resizeTarget(gl, this.t[key], w, h);
    for (const key of ['back', 'backTmp', 'bloomA', 'bloomB'] as const) resizeTarget(gl, this.t[key], Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.hasPrev = false;
  }

  /* ───────── Programs ───────── */

  private styleProgram(style: StyleDef): Program | null {
    let p = this.styles.get(style.id);
    if (!p) {
      p = createProgram(this.gl, buildStyleFrag(style));
      this.styles.set(style.id, p);
    }
    if (!isProgramDone(this.gl, p, this.parallel)) {
      this.pending = true;
      return null;
    }
    if (!ensureLinked(this.gl, p)) {
      this.onError?.(`Style "${style.name}" failed to compile.`);
      return null;
    }
    return p;
  }

  /** Kick off compilation for styles in the background. */
  precompile(ids: string[]) {
    for (const id of ids) {
      if (this.styles.has(id)) continue;
      const style = getStyle(id);
      this.styles.set(id, createProgram(this.gl, buildStyleFrag(style)));
    }
  }

  isStyleReady(id: string): boolean {
    const p = this.styles.get(id);
    if (!p) return false;
    return isProgramDone(this.gl, p, this.parallel) && ensureLinked(this.gl, p);
  }

  failedStyles(): string[] {
    const out: string[] = [];
    for (const [id, p] of this.styles) {
      if (isProgramDone(this.gl, p, this.parallel) && !ensureLinked(this.gl, p)) out.push(id);
    }
    return out;
  }

  private passProgram(name: keyof Engine['pass']): Program | null {
    const p = this.pass[name];
    if (!isProgramDone(this.gl, p, this.parallel)) {
      this.pending = true;
      return null;
    }
    return ensureLinked(this.gl, p) ? p : null;
  }

  /* ───────── Textures ───────── */

  private uploadSource() {
    const gl = this.gl;
    const src = this.source;
    if (!src) return;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.el);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } catch (e) {
      console.warn('[engine] source upload failed', e);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  private uploadCanvas(tex: WebGLTexture, canvas: HTMLCanvasElement, mip = false) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (mip) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }

  private atlasFor(text: string, font: number) {
    const atlas = buildAtlas(text, font);
    let entry = this.atlasTex.get(atlas.key);
    if (!entry) {
      const gl = this.gl;
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_2D);
      entry = { tex, atlas };
      this.atlasTex.set(atlas.key, entry);
      if (this.atlasTex.size > 24) {
        const [firstKey, first] = this.atlasTex.entries().next().value as [string, { tex: WebGLTexture }];
        gl.deleteTexture(first.tex);
        this.atlasTex.delete(firstKey);
      }
    }
    return entry;
  }

  /* ───────── Drawing helpers ───────── */

  private bindTex(unit: number, tex: WebGLTexture | null) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex || this.dummy);
  }

  private draw(p: Program, target: Target | null, w: number, h: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(p.prog);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private setSrcUv(p: Program) {
    const gl = this.gl;
    const c = this.crop;
    gl.uniform4f(uni(gl, p, 'u_crop'), c.x, c.y, c.w, c.h);
    gl.uniform1i(uni(gl, p, 'u_rot'), this.transform.rotate / 90);
    gl.uniform2f(uni(gl, p, 'u_flip'), this.transform.flipX ? 1 : 0, this.transform.flipY ? 1 : 0);
    const bmp = typeof ImageBitmap !== 'undefined' && this.source?.el instanceof ImageBitmap;
    gl.uniform1f(uni(gl, p, 'u_srcNoFlip'), bmp ? 1 : 0);
  }

  private gaussian(src: WebGLTexture, srcW: number, srcH: number, tmp: Target, dst: Target, sigmaDst: number) {
    const gl = this.gl;
    const p = this.passProgram('blur1d');
    if (!p) return false;
    gl.useProgram(p.prog);
    gl.uniform1i(uni(gl, p, 'u_src'), 0);
    gl.uniform1f(uni(gl, p, 'u_sigma'), sigmaDst);
    this.bindTex(0, src);
    gl.uniform2f(uni(gl, p, 'u_dir'), 1 / tmp.w, 0);
    this.draw(p, tmp, tmp.w, tmp.h);
    gl.useProgram(p.prog);
    this.bindTex(0, tmp.tex);
    gl.uniform2f(uni(gl, p, 'u_dir'), 0, 1 / dst.h);
    this.draw(p, dst, dst.w, dst.h);
    void srcW;
    void srcH;
    return true;
  }

  private setGradient(p: Program, stops: string[], name = 'u_grad', nName = 'u_gradN') {
    const gl = this.gl;
    const arr = new Float32Array(24);
    const n = Math.min(8, Math.max(2, stops.length));
    for (let i = 0; i < n; i++) {
      const c = hexToRgb(stops[Math.min(i, stops.length - 1)]);
      arr.set(c, i * 3);
    }
    gl.uniform3fv(uni(gl, p, name + '[0]'), arr);
    gl.uniform1i(uni(gl, p, nName), n);
  }

  private setPalette(p: Program, params: Record<string, ParamValue>) {
    const gl = this.gl;
    const idx = typeof params.palette === 'number' ? params.palette : -1;
    if (idx < 0) return;
    let colors: string[];
    if (idx === PALETTE_CUSTOM) colors = [params.c1, params.c2, params.c3, params.c4].map((c) => String(c || '#000000'));
    else if (idx === PALETTE_ORIGINAL) colors = [];
    else colors = PALETTES[idx]?.colors || PALETTES[0].colors;
    const arr = new Float32Array(48);
    colors.slice(0, 16).forEach((c, i) => arr.set(hexToRgb(c), i * 3));
    gl.uniform3fv(uni(gl, p, 'u_pal[0]'), arr);
    gl.uniform1i(uni(gl, p, 'u_palN'), Math.min(16, colors.length));
  }

  /* ───────── Render ───────── */

  /**
   * Render one frame. If `target` is given (export), renders into it at its size.
   */
  render(time: number, exportTarget: Target | null = null): boolean {
    if (this.lost) return false;
    const gl = this.gl;
    this.pending = false;
    const W = this.w, H = this.h;
    if (!this.source || !this.look) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return false;
    }
    if (this.sourceDirty || this.source.dynamic) {
      this.uploadSource();
      this.sourceDirty = false;
    }
    const look = this.look;

    // 1 — Pre-adjust (crop, lights, color)
    const pre = this.passProgram('pre');
    if (!pre) return false;
    gl.useProgram(pre.prog);
    this.bindTex(0, this.srcTex);
    gl.uniform1i(uni(gl, pre, 'u_src'), 0);
    gl.uniform2f(uni(gl, pre, 'u_res'), W, H);
    gl.uniform1f(uni(gl, pre, 'u_time'), time);
    gl.uniform2f(uni(gl, pre, 'u_mouse'), this.mouse[0], this.mouse[1]);
    this.setSrcUv(pre);
    const c = look.color;
    gl.uniform1f(uni(gl, pre, 'u_exposure'), c.exposure / 100);
    gl.uniform1f(uni(gl, pre, 'u_brightness'), c.brightness / 200);
    gl.uniform1f(uni(gl, pre, 'u_contrast'), c.contrast / 100);
    gl.uniform1f(uni(gl, pre, 'u_saturation'), c.saturation / 100);
    gl.uniform1f(uni(gl, pre, 'u_vibrance'), c.vibrance / 100);
    gl.uniform1f(uni(gl, pre, 'u_hue'), c.hue / 360);
    gl.uniform1f(uni(gl, pre, 'u_gray'), c.grayscale / 100);
    gl.uniform1f(uni(gl, pre, 'u_temp'), c.temperature / 100);
    gl.uniform1f(uni(gl, pre, 'u_invert'), c.invert ? 1 : 0);
    gl.uniform1i(uni(gl, pre, 'u_filter'), c.filter);
    gl.uniform3fv(uni(gl, pre, 'u_tint'), hexToRgb(c.tint));
    gl.uniform1f(uni(gl, pre, 'u_tintOp'), c.tintOpacity / 100);
    gl.uniform1i(uni(gl, pre, 'u_tintBlend'), c.tintBlend);
    gl.uniform1f(uni(gl, pre, 'u_gradOn'), c.gradientMap > 0 ? 1 : 0);
    if (c.gradientMap > 0) this.setGradient(pre, GRADIENTS[c.gradientMap - 1]?.stops || GRADIENTS[0].stops);
    const L = look.lights;
    gl.uniform1f(uni(gl, pre, 'u_lightsOn'), L.enabled ? 1 : 0);
    if (L.enabled) {
      gl.uniform1i(uni(gl, pre, 'u_lightMode'), L.mode);
      gl.uniform1f(uni(gl, pre, 'u_lightR'), (L.radius / 100) * 0.8 + 0.02);
      gl.uniform1f(uni(gl, pre, 'u_lightI'), L.intensity / 100);
      gl.uniform1f(uni(gl, pre, 'u_ambient'), L.ambient / 100);
      gl.uniform1f(uni(gl, pre, 'u_flicker'), L.flicker ? 1 : 0);
      gl.uniform3fv(uni(gl, pre, 'u_lightC'), hexToRgb(L.color));
      const lp = new Float32Array(16);
      const lpc = new Float32Array(12);
      L.points.slice(0, 4).forEach((pt, i) => {
        lp.set([pt.x, 1 - pt.y, 0, 0], i * 4);
        lpc.set(hexToRgb(pt.color), i * 3);
      });
      gl.uniform4fv(uni(gl, pre, 'u_lp[0]'), lp);
      gl.uniform3fv(uni(gl, pre, 'u_lpc[0]'), lpc);
      gl.uniform1i(uni(gl, pre, 'u_lpN'), Math.min(4, L.points.length));
    }
    this.draw(pre, this.t.pre, W, H);

    // 2 — Global blur
    let cur: Target = this.t.pre;
    const B = look.blur;
    if (B.type > 0 && B.amount > 0) {
      if (B.type === 1) {
        if (this.gaussian(cur.tex, W, H, this.t.a, this.t.b, (B.amount * this.k) / 2)) cur = this.t.b;
      } else {
        const p = this.passProgram('blur2d');
        if (p) {
          gl.useProgram(p.prog);
          this.bindTex(0, cur.tex);
          gl.uniform1i(uni(gl, p, 'u_src'), 0);
          gl.uniform2f(uni(gl, p, 'u_res'), W, H);
          gl.uniform1i(uni(gl, p, 'u_type'), B.type);
          gl.uniform1f(uni(gl, p, 'u_amount'), B.amount * this.k);
          gl.uniform1f(uni(gl, p, 'u_angle'), (B.angle * Math.PI) / 180);
          gl.uniform1f(uni(gl, p, 'u_focus'), B.focus / 100);
          gl.uniform1f(uni(gl, p, 'u_spread'), B.spread / 100);
          gl.uniform2f(uni(gl, p, 'u_center'), B.centerX / 100, 1 - B.centerY / 100);
          this.draw(p, this.t.a, W, H);
          cur = this.t.a;
        }
      }
    }

    // 3 — Style layers
    let feedbackUsed = false;
    let toggle = false;
    for (const layer of look.layers) {
      if (!layer.enabled || layer.opacity <= 0) continue;
      const style = getStyle(layer.styleId);
      const prog = this.styleProgram(style);
      if (!prog) {
        // Still compiling: keep showing the previous frame instead of flashing the raw image.
        if (this.pending && !exportTarget) return false;
        continue;
      }
      const dst = toggle ? this.t.lb : this.t.la;
      if (dst === cur) continue;
      this.drawLayer(layer, style, prog, cur, dst, time);
      if (style.feedback) feedbackUsed = true;
      cur = dst;
      toggle = !toggle;
    }
    if (feedbackUsed) {
      const cp = this.passProgram('copy');
      if (cp) {
        gl.useProgram(cp.prog);
        this.bindTex(0, cur.tex);
        gl.uniform1i(uni(gl, cp, 'u_src'), 0);
        this.draw(cp, this.t.prev, W, H);
        this.hasPrev = true;
      }
    }

    // 4 — Post FX
    const post = look.post;
    const anyPost = post.levels.on || post.curves.on || post.vignette.on || post.scanlines.on || post.crt.on || post.chromatic.on ||
      post.bloom.on || post.glow.on || post.tint.on || post.grain.on || post.glitch.on || post.rgbSplit.on || post.pixelate.on ||
      post.halftone.on || post.ascii.on || post.sharpen.on || post.threshold.on || post.noise.on;
    if (anyPost) {
      const pp = this.passProgram('post');
      if (pp) {
        let bloomTex: WebGLTexture | null = null;
        if (post.bloom.on || post.glow.on) {
          const br = this.passProgram('bright');
          if (br) {
            gl.useProgram(br.prog);
            this.bindTex(0, cur.tex);
            gl.uniform1i(uni(gl, br, 'u_src'), 0);
            gl.uniform1f(uni(gl, br, 'u_threshold'), post.bloom.on ? post.bloom.threshold / 100 : 0.35);
            this.draw(br, this.t.bloomB, this.t.bloomB.w, this.t.bloomB.h);
            const radius = post.bloom.on ? post.bloom.radius : 10;
            if (this.gaussian(this.t.bloomB.tex, 0, 0, this.t.backTmp, this.t.bloomA, (radius * this.k) / 2)) bloomTex = this.t.bloomA.tex;
          }
        }
        gl.useProgram(pp.prog);
        this.bindTex(0, cur.tex);
        this.bindTex(1, bloomTex);
        gl.uniform1i(uni(gl, pp, 'u_src'), 0);
        gl.uniform1i(uni(gl, pp, 'u_bloom'), 1);
        gl.uniform1i(uni(gl, pp, 'u_atlas'), 2);
        gl.uniform2f(uni(gl, pp, 'u_res'), W, H);
        gl.uniform1f(uni(gl, pp, 'u_k'), this.k);
        gl.uniform1f(uni(gl, pp, 'u_time'), time);
        gl.uniform1f(uni(gl, pp, 'u_levelsOn'), post.levels.on ? 1 : 0);
        gl.uniform4f(uni(gl, pp, 'u_levels'), post.levels.inBlack / 255, post.levels.inWhite / 255, post.levels.outBlack / 255, post.levels.outWhite / 255);
        gl.uniform1f(uni(gl, pp, 'u_gamma'), post.levels.gamma / 100);
        gl.uniform1i(uni(gl, pp, 'u_curve'), post.curves.on ? post.curves.preset + 1 : 0);
        gl.uniform1f(uni(gl, pp, 'u_curveAmt'), post.curves.amount / 100);
        gl.uniform2f(uni(gl, pp, 'u_vignette'), post.vignette.on ? post.vignette.amount / 100 : 0, post.vignette.softness / 100);
        gl.uniform2f(uni(gl, pp, 'u_scan'), post.scanlines.on ? post.scanlines.amount / 100 : 0, post.scanlines.density);
        gl.uniform1f(uni(gl, pp, 'u_crt'), post.crt.on ? post.crt.amount / 100 : 0);
        gl.uniform1f(uni(gl, pp, 'u_chroma'), post.chromatic.on ? post.chromatic.amount / 10 : 0);
        gl.uniform1f(uni(gl, pp, 'u_bloomAmt'), post.bloom.on && bloomTex ? post.bloom.amount / 100 : 0);
        gl.uniform1f(uni(gl, pp, 'u_glowAmt'), post.glow.on && bloomTex ? post.glow.amount / 100 : 0);
        gl.uniform3fv(uni(gl, pp, 'u_ptint'), hexToRgb(post.tint.color));
        gl.uniform1f(uni(gl, pp, 'u_ptintAmt'), post.tint.on ? post.tint.amount / 100 : 0);
        gl.uniform2f(uni(gl, pp, 'u_grain'), post.grain.on ? post.grain.amount / 100 : 0, post.grain.colour ? 1 : 0);
        gl.uniform2f(uni(gl, pp, 'u_glitch'), post.glitch.on ? post.glitch.amount / 100 : 0, post.glitch.slice);
        gl.uniform2f(uni(gl, pp, 'u_rgbs'), post.rgbSplit.on ? post.rgbSplit.amount : 0, (post.rgbSplit.angle * Math.PI) / 180);
        gl.uniform1f(uni(gl, pp, 'u_pixel'), post.pixelate.on ? post.pixelate.size : 0);
        gl.uniform3f(uni(gl, pp, 'u_half'), post.halftone.on ? post.halftone.size : 0, post.halftone.shape, post.halftone.mono ? 1 : 0);
        gl.uniform3f(uni(gl, pp, 'u_ascii'), post.ascii.on ? post.ascii.size : 0, post.ascii.charset, post.ascii.mono ? 1 : 0);
        gl.uniform1f(uni(gl, pp, 'u_sharpen'), post.sharpen.on ? post.sharpen.amount / 100 : 0);
        gl.uniform1f(uni(gl, pp, 'u_thresh'), post.threshold.on ? Math.max(0.001, post.threshold.level / 100) : 0);
        gl.uniform1f(uni(gl, pp, 'u_noise'), post.noise.on ? post.noise.amount / 100 : 0);
        if (post.ascii.on) {
          const at = this.atlasFor(CHARSETS[post.ascii.charset]?.ramp || CHARSETS[0].ramp, 0);
          this.bindTex(2, at.tex);
          gl.uniform1f(uni(gl, pp, 'u_glyphN'), at.atlas.count);
          gl.uniform2f(uni(gl, pp, 'u_atlasGrid'), at.atlas.cols, at.atlas.rows);
        } else this.bindTex(2, null);
        this.draw(pp, this.t.post, W, H);
        cur = this.t.post;
      }
    }

    // 5 — Final composite (mask, text, compare)
    const fp = this.passProgram('final');
    if (!fp) return false;
    const m = look.mask;
    if (m.enabled && this.maskCanvas && this.maskUploaded !== this.maskVersion) {
      this.uploadCanvas(this.maskTex, this.maskCanvas);
      this.maskUploaded = this.maskVersion;
    }
    const outW = exportTarget ? exportTarget.w : W;
    const outH = exportTarget ? exportTarget.h : H;
    let textOn = false;
    if (this.textRenderer) {
      const sizeKey = `${outW}x${outH}`;
      if (this.textUploaded !== this.textVersion || this.textSize !== sizeKey) {
        const tc = this.textRenderer(outW, outH);
        if (tc) this.uploadCanvas(this.textTex, tc);
        this.textUploaded = tc ? this.textVersion : -3;
        this.textSize = sizeKey;
      }
      textOn = this.textUploaded === this.textVersion;
    }
    gl.useProgram(fp.prog);
    this.bindTex(0, cur.tex);
    this.bindTex(1, this.srcTex);
    this.bindTex(2, this.maskTex);
    this.bindTex(3, this.textTex);
    gl.uniform1i(uni(gl, fp, 'u_fx'), 0);
    gl.uniform1i(uni(gl, fp, 'u_src'), 1);
    gl.uniform1i(uni(gl, fp, 'u_mask'), 2);
    gl.uniform1i(uni(gl, fp, 'u_text'), 3);
    gl.uniform2f(uni(gl, fp, 'u_res'), outW, outH);
    this.setSrcUv(fp);
    gl.uniform1f(uni(gl, fp, 'u_maskOn'), m.enabled && this.maskCanvas ? 1 : 0);
    gl.uniform1f(uni(gl, fp, 'u_maskInvert'), m.invert ? 1 : 0);
    gl.uniform1f(uni(gl, fp, 'u_feather'), m.feather * (outW / Math.max(W, 1)) * this.k);
    gl.uniform1f(uni(gl, fp, 'u_textOn'), textOn ? 1 : 0);
    gl.uniform1f(uni(gl, fp, 'u_compare'), exportTarget ? -1 : this.compare);
    gl.uniform1f(uni(gl, fp, 'u_opaque'), 0);
    if (!exportTarget && (this.canvas.width !== W || this.canvas.height !== H)) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    this.draw(fp, exportTarget, outW, outH);
    return true;
  }

  private drawLayer(layer: Layer, style: StyleDef, p: Program, input: Target, dst: Target, time: number) {
    const gl = this.gl;
    const W = this.w, H = this.h;
    const params = layer.params;
    const look = this.look!;

    // Backdrop blur for overlay styles.
    let backTex: WebGLTexture = input.tex;
    if (style.backdrop && Number(params.bdMode ?? 0) === 0) {
      const soft = Number(params.bdSoftness ?? 0);
      if (soft > 0) {
        if (this.gaussian(input.tex, W, H, this.t.backTmp, this.t.back, (soft * this.k) / 2)) backTex = this.t.back.tex;
      }
    }

    gl.useProgram(p.prog);
    this.bindTex(0, input.tex);
    this.bindTex(1, backTex);
    this.bindTex(2, this.hasPrev ? this.t.prev.tex : null);
    gl.uniform1i(uni(gl, p, 'u_src'), 0);
    gl.uniform1i(uni(gl, p, 'u_back'), 1);
    gl.uniform1i(uni(gl, p, 'u_prev'), 2);
    gl.uniform1i(uni(gl, p, 'u_atlas'), 3);
    gl.uniform2f(uni(gl, p, 'u_res'), W, H);
    gl.uniform1f(uni(gl, p, 'u_k'), this.k);
    gl.uniform1f(uni(gl, p, 'u_time'), time);
    gl.uniform2f(uni(gl, p, 'u_mouse'), this.mouse[0], this.mouse[1]);
    gl.uniform1f(uni(gl, p, 'u_seed'), 0.123);
    gl.uniform1f(uni(gl, p, 'u_opacity'), layer.opacity / 100);
    gl.uniform1i(uni(gl, p, 'u_blend'), BLEND_INDEX[layer.blend] ?? 0);

    // Glyph atlas
    if (style.glyphs) {
      const textParam = style.params.find((q) => q.type === 'text' && q.atlas);
      const text = String(params[textParam?.key || 'chars'] ?? '@#S08Xx+=-;:.');
      const at = this.atlasFor(text, Number(params.font ?? 0));
      this.bindTex(3, at.tex);
      gl.uniform1f(uni(gl, p, 'u_glyphN'), at.atlas.count);
      gl.uniform2f(uni(gl, p, 'u_atlasGrid'), at.atlas.cols, at.atlas.rows);
    } else this.bindTex(3, null);

    // Backdrop
    gl.uniform1i(uni(gl, p, 'u_bdMode'), Number(params.bdMode ?? 0));
    gl.uniform1f(uni(gl, p, 'u_bdOpacity'), Number(params.bdOpacity ?? 100) / 100);
    gl.uniform3fv(uni(gl, p, 'u_bdColor'), hexToRgb(String(params.bdColor ?? '#000000')));

    // Depth + animation (glyph styles)
    const d = look.depth;
    const useDepth = !!style.depth;
    gl.uniform4f(uni(gl, p, 'u_depth'), useDepth ? d.wave / 100 : 0, useDepth ? d.splay / 100 : 0, useDepth ? d.colorSplit / 100 : 0, useDepth ? d.etch / 100 : 0);
    const a = look.animation;
    gl.uniform1f(uni(gl, p, 'u_matrix'), a.matrix ? 1 : 0);
    const md = MATRIX_DIRS[a.matrixDir] || MATRIX_DIRS[2];
    gl.uniform2f(uni(gl, p, 'u_matrixDir'), md[0], md[1]);
    gl.uniform1f(uni(gl, p, 'u_matrixSpeed'), a.matrixSpeed / 100);
    gl.uniform1f(uni(gl, p, 'u_shimmer'), a.shimmer / 100 * 0.35);

    // Palettes / gradients
    this.setPalette(p, params);
    if (typeof params.thermal === 'number') this.setGradient(p, THERMAL[params.thermal]?.stops || THERMAL[0].stops);
    else if (typeof params.gradient === 'number') this.setGradient(p, GRADIENTS[params.gradient]?.stops || GRADIENTS[0].stops);
    else this.setGradient(p, GRADIENTS[2].stops);

    // Style params
    for (const def of style.params) {
      if (def.type === 'text' || def.noUniform) continue;
      const v = params[def.key] ?? def.default;
      const loc = uni(gl, p, 'u_' + def.key);
      if (!loc) continue;
      if (def.type === 'color') gl.uniform3fv(loc, hexToRgb(String(v)));
      else if (def.type === 'toggle') gl.uniform1f(loc, v ? 1 : 0);
      else gl.uniform1f(loc, Number(v));
    }
    this.draw(p, dst, W, H);
  }

  /** Render at an arbitrary size and return top-down RGBA pixels. */
  renderPixels(w: number, h: number, k: number, time: number): ImageData {
    const gl = this.gl;
    const prev = { w: this.w, h: this.h, k: this.k };
    const max = this.maxSize;
    if (w > max || h > max) {
      const s = max / Math.max(w, h);
      w = Math.floor(w * s);
      h = Math.floor(h * s);
      k *= s;
    }
    this.setSize(w, h, k);
    if (!this.out) this.out = createTarget(gl, w, h);
    else resizeTarget(gl, this.out, w, h);
    // Feedback styles need a few frames to settle.
    const frames = this.look?.layers.some((l) => getStyle(l.styleId).feedback) ? 6 : 1;
    for (let i = 0; i < frames; i++) this.render(time + i / 30, this.out);
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.out.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const img = new ImageData(w, h);
    const row = w * 4;
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    deleteTarget(gl, this.out);
    this.out = null;
    this.setSize(prev.w, prev.h, prev.k);
    return img;
  }

  /** Read the pre-adjusted image (for ASCII text export). */
  readPre(w: number, h: number): ImageData {
    const gl = this.gl;
    const prev = { w: this.w, h: this.h, k: this.k };
    this.setSize(w, h, this.k);
    const look = this.look;
    if (look) {
      const saved = look.layers;
      look.layers = [];
      this.render(0);
      look.layers = saved;
    }
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.t.pre.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const img = new ImageData(w, h);
    const row = w * 4;
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    this.setSize(prev.w, prev.h, prev.k);
    return img;
  }

  dispose() {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}
