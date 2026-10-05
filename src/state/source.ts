// Holds the live media element used as the render source.
import type { SourceInfo } from '../engine/engine';
import { setSourceMeta, toast, updateDoc } from './store';
import { DEMO_GALLERY } from '../lib/demoImage';

export interface Generator {
  id: string;
  label: string;
  kind: 'lumen' | 'canvas';
  index: number;
}

export const GENERATORS: Generator[] = [
  { id: 'lumen_chrome', label: 'Liquid Chrome', kind: 'lumen', index: 0 },
  { id: 'lumen_silk', label: 'Silk Ribbons', kind: 'lumen', index: 1 },
  { id: 'lumen_bloom', label: 'Soft Bloom', kind: 'lumen', index: 2 },
  { id: 'lumen_aura', label: 'Aura Rings', kind: 'lumen', index: 3 },
  { id: 'lumen_rays', label: 'Light Rays', kind: 'lumen', index: 4 },
  { id: 'lumen_halftone', label: 'Halftone Field', kind: 'lumen', index: 5 },
  { id: 'lumen_glyphs', label: 'Data Glyphs', kind: 'lumen', index: 6 },
  { id: 'lumen_reeded', label: 'Reeded Light', kind: 'lumen', index: 7 },
  { id: 'lumen_mosaic', label: 'Pixel Bloom', kind: 'lumen', index: 8 },
  { id: 'synthwave', label: 'Synthwave', kind: 'canvas', index: 0 },
  { id: 'portrait', label: 'Portrait', kind: 'canvas', index: 1 },
  { id: 'cityscape', label: 'Cityscape', kind: 'canvas', index: 2 },
  { id: 'geometric', label: 'Geometric', kind: 'canvas', index: 3 },
];

/** Bundled sample photos (Unsplash License, served via picsum.photos). */
export const SAMPLES: { id: string; label: string; url: string }[] = [
  { id: 'portrait', label: 'Portrait', url: '/samples/portrait.webp' },
  { id: 'lioness', label: 'Lioness', url: '/samples/lioness.webp' },
  { id: 'jellyfish', label: 'Jellyfish', url: '/samples/jellyfish.webp' },
  { id: 'pug', label: 'Pug', url: '/samples/pug.webp' },
  { id: 'bear', label: 'Bear', url: '/samples/bear.webp' },
  { id: 'canoe', label: 'Canoe', url: '/samples/canoe.webp' },
  { id: 'waterfall', label: 'Waterfall', url: '/samples/waterfall.webp' },
  { id: 'puppy', label: 'Puppy', url: '/samples/puppy.webp' },
  { id: 'camera', label: 'Camera', url: '/samples/camera.webp' },
  { id: 'sunglasses', label: 'Sunglasses', url: '/samples/sunglasses.webp' },
  { id: 'walrus', label: 'Walrus', url: '/samples/walrus.webp' },
  { id: 'valley', label: 'Valley', url: '/samples/valley.webp' },
];

export async function loadSample(id: string) {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
  try {
    const res = await fetch(s.url);
    if (!res.ok) throw new Error(String(res.status));
    await loadImageBlob(await res.blob(), s.label);
  } catch {
    toast('Could not load the sample image');
  }
}

interface LiveGen {
  render(t: number): void;
  dispose(): void;
  canvas: HTMLCanvasElement;
}

let current: SourceInfo | null = null;
let video: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;
let live: LiveGen | null = null;
let objectUrl: string | null = null;
let fileBlob: Blob | null = null;
const listeners = new Set<(s: SourceInfo | null) => void>();

export function getSource() {
  return current;
}

export function getVideo() {
  return video;
}

export function getSourceBlob() {
  return fileBlob;
}

export function onSourceChange(fn: (s: SourceInfo | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Called every frame by the render loop for animated generators. */
export function tickSource(t: number) {
  live?.render(t);
}

function cleanup() {
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (live) {
    live.dispose();
    live = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function publish(src: SourceInfo | null, meta: Parameters<typeof setSourceMeta>[0], resetCrop = true) {
  current = src;
  setSourceMeta(meta);
  if (resetCrop) updateDoc((d) => ({ ...d, crop: null, transform: { rotate: 0, flipX: false, flipY: false } }), '', false);
  listeners.forEach((l) => l(src));
}

const MAX_SRC = 4096;

function fitCanvas(img: HTMLImageElement | ImageBitmap, w: number, h: number): TexImageSource & CanvasImageSource {
  if (Math.max(w, h) <= MAX_SRC) return img;
  const s = MAX_SRC / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

async function decodeBlob(blob: Blob): Promise<{ el: ImageBitmap | HTMLImageElement; w: number; h: number; url?: string }> {
  try {
    const bmp = await createImageBitmap(blob);
    return { el: bmp, w: bmp.width, h: bmp.height };
  } catch {
    // SVG and some formats need an <img>.
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('decode'));
      img.src = url;
    });
    return { el: img, w: img.naturalWidth, h: img.naturalHeight, url };
  }
}

export async function loadImageBlob(blob: Blob, name = 'image') {
  let dec: Awaited<ReturnType<typeof decodeBlob>>;
  try {
    dec = await decodeBlob(blob);
  } catch {
    toast('Could not read that image');
    return;
  }
  cleanup();
  objectUrl = dec.url || null;
  fileBlob = blob;
  const { w, h } = dec;
  const el = fitCanvas(dec.el, w, h);
  const ew = el instanceof HTMLCanvasElement ? el.width : w;
  const eh = el instanceof HTMLCanvasElement ? el.height : h;
  publish({ el, width: ew, height: eh, dynamic: false }, { kind: 'image', name, width: w, height: h });
}

export async function loadVideoBlob(blob: Blob, name = 'video') {
  cleanup();
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.src = url;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.crossOrigin = 'anonymous';
  try {
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error('video'));
    });
    await v.play().catch(() => undefined);
  } catch {
    URL.revokeObjectURL(url);
    toast('Could not play that video');
    return;
  }
  objectUrl = url;
  video = v;
  fileBlob = blob;
  publish({ el: v, width: v.videoWidth, height: v.videoHeight, dynamic: true }, { kind: 'video', name, width: v.videoWidth, height: v.videoHeight });
}

export async function loadFile(file: File) {
  if (file.type.startsWith('video/')) return loadVideoBlob(file, file.name);
  if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file.name)) return loadImageBlob(file, file.name);
  toast('Unsupported file type');
}

export async function startWebcam() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Camera not available in this browser');
    return;
  }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    cleanup();
    stream = s;
    const v = document.createElement('video');
    v.srcObject = s;
    v.muted = true;
    v.playsInline = true;
    await v.play();
    video = v;
    fileBlob = null;
    publish({ el: v, width: v.videoWidth, height: v.videoHeight, dynamic: true }, { kind: 'webcam', name: 'Webcam', width: v.videoWidth, height: v.videoHeight });
    updateDoc((d) => ({ ...d, transform: { ...d.transform, flipX: true } }), '', false);
  } catch {
    toast('Camera permission denied');
  }
}

export async function loadGenerator(g: Generator) {
  if (g.kind === 'lumen') {
    const { LumenSource } = await import('../lib/lumenRenderer');
    let gen: LiveGen;
    try {
      gen = new LumenSource(g.index, 1280, 800);
    } catch {
      toast('WebGL2 not available');
      return;
    }
    cleanup();
    live = gen;
    fileBlob = null;
    publish({ el: gen.canvas, width: 1280, height: 800, dynamic: true }, { kind: 'generative', name: g.label, width: 1280, height: 800, generator: GENERATORS.indexOf(g) });
    return;
  }
  const demo = DEMO_GALLERY.find((d) => d.id === g.id);
  if (!demo) return;
  const img = await demo.generate();
  cleanup();
  fileBlob = null;
  publish({ el: img, width: img.naturalWidth, height: img.naturalHeight, dynamic: false }, { kind: 'image', name: g.label, width: img.naturalWidth, height: img.naturalHeight });
}

let lastInspire = -1;
/** Random sample photo (mostly) or an animated generator. */
export async function inspire() {
  if (Math.random() < 0.18) {
    const lumens = GENERATORS.filter((g) => g.kind === 'lumen');
    await loadGenerator(lumens[Math.floor(Math.random() * lumens.length)]);
    return;
  }
  let i = Math.floor(Math.random() * SAMPLES.length);
  if (i === lastInspire) i = (i + 1) % SAMPLES.length;
  lastInspire = i;
  await loadSample(SAMPLES[i].id);
}

export function clearSource() {
  cleanup();
  fileBlob = null;
  publish(null, null);
}

export function setVideoPlaying(play: boolean) {
  if (!video || stream) return;
  if (play) video.play().catch(() => undefined);
  else video.pause();
}

/** Static frame of the current source (for thumbnails). */
export function snapshotSource(maxSize = 512): HTMLCanvasElement | null {
  if (!current) return null;
  const { width, height } = current;
  const s = Math.min(1, maxSize / Math.max(width, height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width * s));
  c.height = Math.max(1, Math.round(height * s));
  try {
    c.getContext('2d')!.drawImage(current.el as CanvasImageSource, 0, 0, c.width, c.height);
  } catch {
    return null;
  }
  return c;
}
