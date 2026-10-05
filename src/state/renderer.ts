// Owns the main engine + thumbnail engine, the animation clock and exports.
import { Engine, DESIGN_LONG, type SourceInfo } from '../engine/engine';
import { getStyle, makeLayer } from '../engine/styles';
import type { Look } from '../engine/types';
import { loadGlyphFonts } from '../engine/glyphAtlas';
import { getState, subscribeStore, useStore } from './store';
import { defaultLook } from './defaults';
import { getSource, onSourceChange, tickSource, getVideo } from './source';
import { renderTextLayer } from './textLayer';
import { DEMO_GALLERY } from '../lib/demoImage';

let engine: Engine | null = null;
let raf = 0;
let dirty = true;
let clock = 0;
let lastNow = 0;
let previewLong = DESIGN_LONG;
let maskCanvas: HTMLCanvasElement | null = null;
let maskVersion = 0;
let textVersion = 0;
let lastTexts: unknown = null;
const frameListeners = new Set<() => void>();
let fpsFrames = 0;
let fpsTime = 0;
export let fps = 0;

export function getEngine() {
  return engine;
}

let sharedCanvas: HTMLCanvasElement | null = null;

/** The single output canvas; Studio and Flow mount it into their own containers. */
export function getOutputCanvas(): HTMLCanvasElement {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
    sharedCanvas.className = 'view';
    attachCanvas(sharedCanvas);
  }
  return sharedCanvas;
}

export function requestRender() {
  dirty = true;
}

export function onFrame(fn: () => void): () => void {
  frameListeners.add(fn);
  return () => {
    frameListeners.delete(fn);
  };
}

function isAnimated(look: Look): boolean {
  if (look.animation.animated) return true;
  if (look.layers.some((l) => l.enabled && getStyle(l.styleId).alwaysAnimated)) return true;
  if (look.lights.enabled && look.lights.flicker) return true;
  return false;
}

export function needsClock(): boolean {
  const s = getState();
  const src = getSource();
  return !!src && (src.dynamic || isAnimated(s.doc.look));
}

/** Attach the main engine to the stage canvas. */
export function attachCanvas(canvas: HTMLCanvasElement): Engine {
  if (engine && engine.canvas === canvas) return engine;
  engine?.dispose();
  engine = new Engine(canvas);
  engine.onError = (m) => console.warn(m);
  syncEngine();
  engine.setSource(getSource());
  loadGlyphFonts().then(() => requestRender());
  // Warm up the most common programs.
  engine.precompile(['characters', 'dither', 'ascii-studio', 'halftone', 'pixel-art', 'dots']);
  cancelAnimationFrame(raf);
  lastNow = performance.now();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    const s = getState();
    const animating = needsClock() && s.ui.playing;
    if (animating) {
      const speed = s.doc.look.animation.animated ? s.doc.look.animation.speed / 100 : 1;
      clock += dt * speed;
      tickSource(clock);
      dirty = true;
    }
    if (dirty && engine) {
      dirty = false;
      syncEngine();
      engine.render(clock);
      if (engine.pending) dirty = true;
      frameListeners.forEach((f) => f());
      fpsFrames += 1;
      if (now - fpsTime > 1000) {
        fps = Math.round((fpsFrames * 1000) / (now - fpsTime));
        fpsFrames = 0;
        fpsTime = now;
      }
    }
  };
  raf = requestAnimationFrame(loop);
  return engine;
}

/** Synchronous render (used by tests and when the tab is hidden). */
export function renderNow() {
  if (!engine) return false;
  syncEngine();
  const ok = engine.render(clock);
  frameListeners.forEach((f) => f());
  return ok;
}

export function detachCanvas() {
  cancelAnimationFrame(raf);
  engine?.dispose();
  engine = null;
}

/** Push store state into the engine. */
function syncEngine() {
  if (!engine) return;
  const s = getState();
  const tool = s.ui.tool;
  engine.setLook(s.doc.look);
  engine.crop = tool === 'crop' || !s.doc.crop ? { x: 0, y: 0, w: 1, h: 1 } : s.doc.crop;
  engine.transform = s.doc.transform;
  engine.compare = s.ui.compare ? s.ui.compareX : -1;
  engine.setMask(s.doc.look.mask.enabled ? maskCanvas : null, maskVersion);
  const texts = s.doc.texts;
  if (texts !== lastTexts) {
    lastTexts = texts;
    textVersion += 1;
  }
  engine.setTextRenderer(texts.length ? (w, h) => renderTextLayer(texts, w, h) : null, textVersion);
  const size = engine.outputSize(previewLong);
  const design = engine.outputSize(DESIGN_LONG);
  engine.setSize(size.w, size.h, size.w / design.w);
}

/** Stage tells us the on-screen size so we render crisp but not wasteful. */
export function setPreviewLong(px: number) {
  const v = Math.max(480, Math.min(2560, Math.round(px)));
  if (Math.abs(v - previewLong) > 8) {
    previewLong = v;
    requestRender();
  }
}

export function setMaskCanvas(c: HTMLCanvasElement | null) {
  maskCanvas = c;
  maskVersion += 1;
  requestRender();
}

export function bumpMask() {
  maskVersion += 1;
  requestRender();
}

export function bumpText() {
  textVersion += 1;
  requestRender();
}

export function setMouse(x: number, y: number) {
  if (!engine) return;
  engine.mouse = [x, 1 - y];
  const s = getState();
  const look = s.doc.look;
  const follows = (look.lights.enabled && look.lights.mode === 0) ||
    look.layers.some((l) => (l.params.follow === true));
  if (follows) requestRender();
}

export function getClock() {
  return clock;
}

export function resetClock() {
  clock = 0;
  requestRender();
}

subscribeStore(() => {
  dirty = true;
});

onSourceChange((src) => {
  engine?.setSource(src);
  clock = 0;
  thumbs.invalidate();
  requestRender();
});

/* ───────── Exports ───────── */

export function designSize() {
  return engine ? engine.outputSize(DESIGN_LONG) : { w: DESIGN_LONG, h: 720 };
}

export function renderImage(scale: number): ImageData | null {
  if (!engine || !getSource()) return null;
  syncEngine();
  const d = engine.outputSize(DESIGN_LONG);
  const img = engine.renderPixels(Math.round(d.w * scale), Math.round(d.h * scale), scale, clock);
  requestRender();
  return img;
}

function imageDataToCanvas(img: ImageData, bg?: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  if (bg) {
    const tmp = document.createElement('canvas');
    tmp.width = img.width;
    tmp.height = img.height;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(tmp, 0, 0);
  } else ctx.putImageData(img, 0, 0);
  return c;
}

export async function exportStill(format: 'png' | 'jpg' | 'webp', scale: number): Promise<Blob | null> {
  const img = renderImage(scale);
  if (!img) return null;
  const canvas = imageDataToCanvas(img, format === 'jpg' ? '#000000' : undefined);
  const mime = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';
  return new Promise((res) => canvas.toBlob((b) => res(b), mime, 0.95));
}

/** Render N frames deterministically (for GIF). */
export async function exportGif(opts: { seconds: number; fps: number; width: number; onProgress?: (p: number) => void }): Promise<Blob | null> {
  if (!engine || !getSource()) return null;
  const { GifEncoder } = await import('../lib/gifEncoder');
  syncEngine();
  const d = engine.outputSize(DESIGN_LONG);
  const w = Math.min(opts.width, d.w);
  const scale = w / d.w;
  const h = Math.round(d.h * scale);
  const frames = Math.max(1, Math.round(opts.seconds * opts.fps));
  const enc = new GifEncoder(w, h, opts.fps, { quality: 10, dither: true });
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const vid = getVideo();
  const start = clock;
  const speed = getState().doc.look.animation.animated ? getState().doc.look.animation.speed / 100 : 1;
  for (let i = 0; i < frames; i++) {
    const t = start + (i / opts.fps) * speed;
    if (vid && !vid.srcObject) {
      vid.pause();
      await seekVideo(vid, (i / opts.fps) % Math.max(vid.duration || 1, 0.1));
    }
    tickSource(t);
    const img = engine.renderPixels(w, h, scale, t);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const tmp = imageDataToCanvas(img);
    ctx.drawImage(tmp, 0, 0);
    enc.addFrame(ctx);
    opts.onProgress?.((i + 1) / frames * 0.7);
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  if (vid && !vid.srcObject && getState().ui.playing) vid.play().catch(() => undefined);
  opts.onProgress?.(0.8);
  const blob = await enc.render();
  opts.onProgress?.(1);
  requestRender();
  return blob;
}

function seekVideo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      res();
    };
    v.addEventListener('seeked', done);
    v.currentTime = t;
    setTimeout(done, 500);
  });
}

export function bestVideoMime(): { mime: string; ext: string } {
  const cands = [
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
  return { mime: 'video/webm', ext: 'webm' };
}

/** Real-time capture of the stage canvas. */
export async function recordVideo(opts: { seconds: number; fps: number; onProgress?: (p: number) => void }): Promise<{ blob: Blob; ext: string } | null> {
  if (!engine || !getSource()) return null;
  const canvas = engine.canvas;
  const { mime, ext } = bestVideoMime();
  const stream = canvas.captureStream(opts.fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const vid = getVideo();
  let seconds = opts.seconds;
  if (vid && !vid.srcObject && vid.duration && isFinite(vid.duration)) {
    seconds = Math.min(vid.duration, 60);
    vid.currentTime = 0;
    await vid.play().catch(() => undefined);
  }
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const tick = () => {
      dirty = true;
      const p = (performance.now() - t0) / 1000 / seconds;
      opts.onProgress?.(Math.min(1, p));
      if (p >= 1) return res();
      requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext };
}

/** ASCII text grid for glyph styles (TXT / HTML export). */
export function asciiGrid(cols: number): { lines: string[]; colors: string[][] } | null {
  if (!engine || !getSource()) return null;
  const s = getState();
  const layer = s.doc.look.layers.find((l) => l.id === s.doc.activeLayer) || s.doc.look.layers[0];
  const style = getStyle(layer.styleId);
  const textParam = style.params.find((p) => p.type === 'text' && p.atlas);
  const ramp = Array.from(String(layer.params[textParam?.key || 'chars'] ?? '@#S08Xx+=-;:.'));
  const invert = !!layer.params.invert;
  const coverage = typeof layer.params.coverage === 'number' ? layer.params.coverage / 100 : 1;
  syncEngine();
  const d = engine.outputSize(DESIGN_LONG);
  const rows = Math.max(1, Math.round((cols * d.h) / d.w * 0.5));
  const img = engine.readPre(cols, rows);
  requestRender();
  const lines: string[] = [];
  const colors: string[][] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    const rowC: string[] = [];
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const t = invert ? l : 1 - l;
      const vis = coverage >= 1 || (invert ? 1 - l : l) >= 1 - coverage;
      const ch = vis ? ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))] : ' ';
      line += ch;
      rowC.push(`rgb(${r},${g},${b})`);
    }
    lines.push(line);
    colors.push(rowC);
  }
  return { lines, colors };
}

/* ───────── Thumbnails ───────── */

type ThumbKey = string;

class ThumbService {
  private engine: Engine | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private cache = new Map<ThumbKey, string>();
  private queue: { key: ThumbKey; look: Look }[] = [];
  private listeners = new Map<ThumbKey, Set<() => void>>();
  private running = false;
  private version = 0;
  private fallback: SourceInfo | null = null;
  private loadingFallback = false;

  invalidate() {
    this.version += 1;
    for (const url of this.cache.values()) URL.revokeObjectURL(url);
    this.cache.clear();
    this.queue = [];
    for (const [key, set] of this.listeners) {
      if (set.size) this.queue.push({ key, look: this.looks.get(key)! });
      set.forEach((f) => f());
    }
    this.pump();
  }

  private looks = new Map<ThumbKey, Look>();

  get(key: ThumbKey) {
    return this.cache.get(key) || null;
  }

  request(key: ThumbKey, look: Look, fn: () => void) {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(fn);
    this.looks.set(key, look);
    if (!this.cache.has(key) && !this.queue.some((q) => q.key === key)) {
      this.queue.push({ key, look });
      this.pump();
    }
    return () => set!.delete(fn);
  }

  private async ensure(): Promise<boolean> {
    if (!this.engine) {
      try {
        this.canvas = document.createElement('canvas');
        this.engine = new Engine(this.canvas);
      } catch {
        return false;
      }
    }
    const src = getSource();
    if (src) {
      // Use a static snapshot so video/webcam thumbs don't need the live element.
      const snap = document.createElement('canvas');
      const sc = Math.min(1, 640 / Math.max(src.width, src.height));
      snap.width = Math.max(1, Math.round(src.width * sc));
      snap.height = Math.max(1, Math.round(src.height * sc));
      try {
        snap.getContext('2d')!.drawImage(src.el as CanvasImageSource, 0, 0, snap.width, snap.height);
      } catch {
        return false;
      }
      this.engine.setSource({ el: snap, width: snap.width, height: snap.height, dynamic: false });
      return true;
    }
    if (!this.fallback) {
      if (this.loadingFallback) return false;
      this.loadingFallback = true;
      try {
        const res = await fetch('/samples/portrait.webp');
        const bmp = await createImageBitmap(await res.blob());
        this.fallback = { el: bmp, width: bmp.width, height: bmp.height, dynamic: false };
      } catch {
        const demo = DEMO_GALLERY.find((d) => d.id === 'portrait') || DEMO_GALLERY[0];
        const img = await demo.generate();
        this.fallback = { el: img, width: img.naturalWidth, height: img.naturalHeight, dynamic: false };
      }
      this.loadingFallback = false;
    }
    this.engine.setSource(this.fallback);
    return true;
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    await new Promise((r) => setTimeout(r, 30));
    const version = this.version;
    if (!(await this.ensure())) {
      this.running = false;
      if (this.loadingFallback) setTimeout(() => this.pump(), 200);
      return;
    }
    const eng = this.engine!;
    const W = 288;
    while (this.queue.length && version === this.version) {
      const job = this.queue[0];
      eng.setLook(job.look);
      // Thumbs show a center crop so fine styles stay readable.
      eng.crop = { x: 0, y: 0, w: 1, h: 1 };
      const full = eng.outputAspect();
      eng.crop = full > 1.5 ? { x: (1 - 1.4 / full) / 2, y: 0, w: 1.4 / full, h: 1 } : { x: 0, y: 0, w: 1, h: 1 };
      const a = eng.outputAspect();
      const h = Math.round(W / Math.max(0.6, Math.min(a, 1.6)));
      eng.setSize(W, h, 0.5);
      // One program compiles at a time so the GPU process never stalls the page.
      let ok = false;
      const t0 = performance.now();
      for (;;) {
        ok = eng.render(1.2);
        if (ok || !eng.pending || performance.now() - t0 > 8000 || version !== this.version) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      this.queue.shift();
      if (!ok || version !== this.version) continue;
      const out = document.createElement('canvas');
      out.width = W;
      out.height = h;
      out.getContext('2d')!.drawImage(this.canvas!, 0, 0);
      const blob: Blob | null = await new Promise((r) => out.toBlob((b) => r(b), 'image/jpeg', 0.82));
      if (blob && version === this.version) {
        this.cache.set(job.key, URL.createObjectURL(blob));
        this.listeners.get(job.key)?.forEach((f) => f());
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    this.running = false;
    if (this.queue.length) this.pump();
  }
}

export const thumbs = new ThumbService();

/** Look used for a style thumbnail: default params of that style. */
const styleLooks = new Map<string, Look>();
export function styleThumbLook(styleId: string): Look {
  let l = styleLooks.get(styleId);
  if (!l) {
    l = defaultLook(styleId);
    l.layers = [makeLayer(styleId)];
    styleLooks.set(styleId, l);
  }
  return l;
}

export function useSourceVersion() {
  return useStore((s) => s.source);
}
