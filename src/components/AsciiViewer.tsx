import { useEffect, useRef } from 'react';
import type { AsciiFrame, AsciiOptions, ColorPalette, PointLight, AnimPreset, ShapeMask, ZoneMaskData } from '../lib/asciiConverter';
import { CHARSETS } from '../lib/charsets';

interface Props {
  frame: AsciiFrame | null;
  options: AsciiOptions;
  sourceEl?: HTMLImageElement | HTMLVideoElement | null;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  zoneMask?: ZoneMaskData | null;
}

// Cached offscreen canvases for zone mask compositing (avoids per-pixel loops)
let _maskCanvas: HTMLCanvasElement | null = null;
let _maskCtx: CanvasRenderingContext2D | null = null;
let _maskKey = '';
let _tempCanvas: HTMLCanvasElement | null = null;
let _tempCtx: CanvasRenderingContext2D | null = null;
let _origCanvas: HTMLCanvasElement | null = null;
let _origCtx: CanvasRenderingContext2D | null = null;
let _origSrcKey = '';

function getMaskCanvas(zoneMask: ZoneMaskData): HTMLCanvasElement {
  // Cache: only rebuild when mask data identity changes
  const key = `${zoneMask.width}x${zoneMask.height}_${zoneMask.data.length > 0 ? zoneMask.data[0] + zoneMask.data[zoneMask.data.length - 1] + zoneMask.data[Math.floor(zoneMask.data.length / 2)] : 0}`;
  if (_maskCanvas && _maskKey === key && _maskCanvas.width === zoneMask.width) {
    return _maskCanvas;
  }
  if (!_maskCanvas) { _maskCanvas = document.createElement('canvas'); _maskCtx = _maskCanvas.getContext('2d')!; }
  _maskCanvas.width = zoneMask.width;
  _maskCanvas.height = zoneMask.height;
  const id = _maskCtx!.createImageData(zoneMask.width, zoneMask.height);
  const d = id.data;
  for (let i = 0; i < zoneMask.data.length; i++) {
    const v = zoneMask.data[i];
    d[i * 4] = 255;
    d[i * 4 + 1] = 255;
    d[i * 4 + 2] = 255;
    d[i * 4 + 3] = v; // alpha = mask value
  }
  _maskCtx!.putImageData(id, 0, 0);
  _maskKey = key;
  return _maskCanvas;
}

function getOrigCanvas(src: HTMLImageElement | HTMLVideoElement, cw: number, ch: number): HTMLCanvasElement {
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : (src as HTMLVideoElement).videoWidth;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : (src as HTMLVideoElement).videoHeight;
  const key = `${sw}x${sh}_${cw}x${ch}`;
  // For video, always redraw (frame changes); for images, cache
  const isVideo = src instanceof HTMLVideoElement;
  if (!_origCanvas) { _origCanvas = document.createElement('canvas'); _origCtx = _origCanvas.getContext('2d')!; }
  if (_origCanvas.width !== cw || _origCanvas.height !== ch) {
    _origCanvas.width = cw;
    _origCanvas.height = ch;
  }
  if (!isVideo && _origSrcKey === key) return _origCanvas;
  _origCtx!.drawImage(src, 0, 0, cw, ch);
  _origSrcKey = key;
  return _origCanvas;
}

function getTempCanvas(cw: number, ch: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!_tempCanvas) { _tempCanvas = document.createElement('canvas'); _tempCtx = _tempCanvas.getContext('2d', { alpha: true })!; }
  if (_tempCanvas.width !== cw || _tempCanvas.height !== ch) {
    _tempCanvas.width = cw;
    _tempCanvas.height = ch;
  }
  return [_tempCanvas, _tempCtx!];
}

export function AsciiViewer({ frame, options, sourceEl, onCanvasReady, zoneMask }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const animRef = useRef<number | null>(null);
  const animFrameRef = useRef<AsciiFrame | null>(null);
  const animOptionsRef = useRef<AsciiOptions>(options);
  const zoneMaskRef = useRef<ZoneMaskData | null>(null);
  zoneMaskRef.current = zoneMask ?? null;

  if (sourceEl) sourceRef.current = sourceEl;
  animFrameRef.current = frame;
  animOptionsRef.current = options;

  useEffect(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (!options.animatedAscii || !frame?.cells) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ramp = options.charset === 'custom'
      ? options.customRamp
      : CHARSETS[options.charset as keyof typeof CHARSETS]?.ramp ?? '@%#*+=-:. ';

    let lastT = 0;
    const interval = 1000 / Math.max(1, options.animSpeed);

    const tick = (t: number) => {
      animRef.current = requestAnimationFrame(tick);
      if (t - lastT < interval) return;
      lastT = t;
      const f = animFrameRef.current;
      const o = animOptionsRef.current;
      if (!f?.cells || !canvas) return;
      const mutated = f.cells.map(row =>
        row.map(c => c.char === ' ' ? c : {
          ...c,
          char: Math.random() < 0.15 ? ramp[Math.floor(Math.random() * ramp.length)] : c.char
        })
      );
      renderToCanvas(canvas, { ...f, cells: mutated }, o, sourceRef.current, zoneMaskRef.current);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [options.animatedAscii, options.animSpeed, frame, options.charset, options.customRamp]);

  const needsContinuousRender = !options.animatedAscii && (options.animPreset !== 'none' || options.discoMode || options.renderMode === 'wave');

  useEffect(() => {
    if (options.animatedAscii) return;
    if (needsContinuousRender) return;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderToCanvas(canvas, frame, options, sourceRef.current, zoneMaskRef.current);
  }, [frame, options, sourceEl, needsContinuousRender, zoneMask]);

  useEffect(() => {
    if (options.animatedAscii) return;
    if (!needsContinuousRender) return;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Throttle to 30fps when zone mask is active to reduce GPU/CPU load
    const interval = zoneMaskRef.current ? 1000 / 30 : 0;
    let lastT = 0;
    const tick = (t: number) => {
      animRef.current = requestAnimationFrame(tick);
      if (interval > 0 && t - lastT < interval) return;
      lastT = t;
      const f = animFrameRef.current;
      const o = animOptionsRef.current;
      if (!f || !canvas) return;
      renderToCanvas(canvas, f, o, sourceRef.current, zoneMaskRef.current);
    };
    animRef.current = requestAnimationFrame(tick as any);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [needsContinuousRender, frame, options.animatedAscii, zoneMask]);

  const bgStyle = options.bgMode === 'transparent' ? 'transparent'
    : (options.bgMode === 'original' || options.bgMode === 'blurred') ? '#000' : options.bgColor;

  const showChecker = options.zoneMaskEnabled || options.bgMode === 'transparent';

  return (
    <div className={`h-full w-full overflow-hidden flex items-center justify-center${showChecker ? ' checkered-bg' : ''}`}
      style={showChecker ? undefined : { background: bgStyle }}>
      <canvas ref={(el) => {
        canvasRef.current = el;
        if (el && onCanvasReady) onCanvasReady(el);
      }} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
}

function applyPalette(r: number, g: number, b: number, palette: ColorPalette): [number, number, number] {
  if (palette === 'original') return [r, g, b];
  switch (palette) {
    case 'warm': {
      const warm_r = Math.min(255, r * 1.2 + 20);
      const warm_g = Math.min(255, g * 1.0 + 5);
      const warm_b = Math.max(0, b * 0.7 - 10);
      return [warm_r, warm_g, warm_b];
    }
    case 'cool': {
      const cool_r = Math.max(0, r * 0.7 - 10);
      const cool_g = Math.min(255, g * 0.95 + 10);
      const cool_b = Math.min(255, b * 1.3 + 30);
      return [cool_r, cool_g, cool_b];
    }
    case 'cyberpunk': {
      const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      const cp_r = Math.min(255, r * 0.6 + lum * 180);
      const cp_g = Math.min(255, g * 0.3 + lum * 40);
      const cp_b = Math.min(255, b * 0.8 + lum * 200);
      return [cp_r, cp_g, cp_b];
    }
    case 'neon': {
      const sat = 1.8;
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const n_r = Math.min(255, Math.max(0, gray + (r - gray) * sat));
      const n_g = Math.min(255, Math.max(0, gray + (g - gray) * sat));
      const n_b = Math.min(255, Math.max(0, gray + (b - gray) * sat));
      return [n_r, n_g, n_b];
    }
    case 'sunset': {
      const lum2 = (r + g + b) / 765;
      const s_r = Math.min(255, 255 * lum2 * 1.4 + 60);
      const s_g = Math.min(255, 140 * lum2 + 20);
      const s_b = Math.min(255, 80 * lum2 * (1 - lum2) * 4 + 40);
      return [s_r, s_g, s_b];
    }
    default: return [r, g, b];
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function applyGradientMap(r: number, g: number, b: number, start: string, end: string): [number, number, number] {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const [sr, sg, sb] = hexToRgb(start);
  const [er, eg, eb] = hexToRgb(end);
  return [
    sr + (er - sr) * lum,
    sg + (eg - sg) * lum,
    sb + (eb - sb) * lum,
  ];
}

function computePointLightFactor(
  nx: number, ny: number,
  lights: PointLight[],
  time: number,
  disco: boolean,
  discoSpeed: number,
): number {
  let total = 0;
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    let lx = l.x, ly = l.y;
    if (disco) {
      const t = time * discoSpeed * 0.001;
      lx = 0.5 + 0.4 * Math.sin(t + i * 2.1);
      ly = 0.5 + 0.4 * Math.cos(t * 0.7 + i * 1.7);
    }
    const dx = nx - lx, dy = ny - ly;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const falloff = Math.max(0, 1 - dist / Math.max(0.01, l.radius));
    total += falloff * falloff * l.intensity;
  }
  return Math.min(2, total);
}

function getAnimAlpha(
  preset: AnimPreset,
  x: number, y: number,
  cols: number, rows: number,
  time: number, speed: number,
): number {
  if (preset === 'none') return 1;
  const t = time * speed * 0.001;
  switch (preset) {
    case 'wave': {
      const phase = (x / cols) * Math.PI * 2 + t;
      return 0.5 + 0.5 * Math.sin(phase);
    }
    case 'cascade': {
      const delay = (y / rows) * 3;
      const v = ((t - delay) % 4) / 4;
      return v < 0 ? 0 : Math.min(1, v * 3);
    }
    case 'pulse': {
      const cx = cols / 2, cy = rows / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / Math.sqrt(cx * cx + cy * cy);
      const wave = Math.sin((dist * 6 - t * 2)) * 0.5 + 0.5;
      return wave;
    }
    case 'reveal': {
      const progress = ((t * 0.5) % 2);
      const threshold = (x + y) / (cols + rows) * 2;
      return progress > threshold ? 1 : 0;
    }
    default: return 1;
  }
}

function isInsideShapeMask(
  nx: number, ny: number,
  mask: ShapeMask,
): boolean {
  if (mask === 'none') return true;
  const cx = nx - 0.5, cy = ny - 0.5;
  switch (mask) {
    case 'circle':
      return (cx * cx + cy * cy) <= 0.25;
    case 'heart': {
      const hx = cx * 2.2, hy = -(cy * 2.2 - 0.3);
      return (hx * hx + hy * hy - 1) ** 3 - hx * hx * hy * hy * hy <= 0;
    }
    case 'star': {
      const angle = Math.atan2(cy, cx);
      const dist = Math.sqrt(cx * cx + cy * cy);
      const r = 0.4 * (0.5 + 0.5 * Math.cos(5 * angle));
      return dist <= r;
    }
    case 'diamond':
      return (Math.abs(cx) + Math.abs(cy)) <= 0.45;
    case 'hexagon': {
      const hx = Math.abs(cx), hy = Math.abs(cy);
      return (hx <= 0.42) && (hy <= 0.42 - hx * 0.5);
    }
    default: return true;
  }
}

function renderToCanvas(
  canvas: HTMLCanvasElement,
  frame: AsciiFrame | null,
  options: AsciiOptions,
  src: HTMLImageElement | HTMLVideoElement | null,
  zoneMask?: ZoneMaskData | null,
) {
  const hasZoneMask = options.zoneMaskEnabled && zoneMask && zoneMask.data.length > 0;
  const ctx = canvas.getContext('2d', { alpha: options.bgMode === 'transparent' || !!hasZoneMask }) as CanvasRenderingContext2D | null;
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (!frame) {
    const w = Math.max(1, canvas.clientWidth || 320);
    const h = Math.max(1, canvas.clientHeight || 240);
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = options.bgColor; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.3; ctx.fillStyle = options.fgColor;
    ctx.font = '14px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText('Drop an image or video', w / 2, h / 2);
    ctx.globalAlpha = 1;
    return;
  }

  const isOverlay = (options.bgMode === 'original' || options.bgMode === 'blurred') && src;

  let cssW: number, cssH: number;
  if (isOverlay) {
    const sw = src instanceof HTMLImageElement ? (src.naturalWidth || src.width) : (src as HTMLVideoElement).videoWidth;
    const sh = src instanceof HTMLImageElement ? (src.naturalHeight || src.height) : (src as HTMLVideoElement).videoHeight;
    cssW = sw > 0 ? sw : frame.cols * 8;
    cssH = sh > 0 ? sh : frame.rows * 14;
  } else {
    const charW = options.fontSize * 0.7;
    cssW = frame.cols * charW + 24;
    cssH = frame.rows * options.fontSize + 24;
  }

  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (options.bgMode === 'transparent') {
    ctx.clearRect(0, 0, cssW, cssH);
  } else if (options.bgMode === 'original' && src) {
    ctx.globalAlpha = options.bgOpacity / 100;
    ctx.drawImage(src, 0, 0, cssW, cssH);
    ctx.globalAlpha = 1;
  } else if (options.bgMode === 'blurred' && src) {
    ctx.save();
    ctx.filter = `blur(${options.bgBlur}px)`;
    const pad = options.bgBlur * 2;
    ctx.globalAlpha = options.bgOpacity / 100;
    ctx.drawImage(src, -pad, -pad, cssW + pad * 2, cssH + pad * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  ctx.globalAlpha = options.charOpacity / 100;

  if (options.blendMode && options.blendMode !== 'normal') {
    ctx.globalCompositeOperation = options.blendMode as GlobalCompositeOperation;
  }

  const glowRadius = options.charGlow / 100 * 20;
  const brightMul = options.charBrightness / 100;
  const palette = options.colorPalette;
  const useGradient = options.gradientMap;

  function processColorRaw(r: number, g: number, b: number, lightFactor?: number): [number, number, number] {
    let pr: number, pg: number, pb: number;
    if (useGradient) {
      [pr, pg, pb] = applyGradientMap(r, g, b, options.gradientStart, options.gradientEnd);
    } else {
      [pr, pg, pb] = applyPalette(r, g, b, palette);
    }
    const mul = brightMul * (lightFactor ?? 1);
    if (mul !== 1) {
      pr = Math.min(255, Math.round(pr * mul));
      pg = Math.min(255, Math.round(pg * mul));
      pb = Math.min(255, Math.round(pb * mul));
    }
    return [pr | 0, pg | 0, pb | 0];
  }

  function processColor(r: number, g: number, b: number, lightFactor?: number): string {
    const [pr, pg, pb] = processColorRaw(r, g, b, lightFactor);
    return `rgb(${pr},${pg},${pb})`;
  }

  function shouldRenderCell(x: number, y: number, cols: number, rows: number): number {
    const nx = cols > 1 ? x / (cols - 1) : 0.5;
    const ny = rows > 1 ? y / (rows - 1) : 0.5;
    if (hasMask && !isInsideShapeMask(nx, ny, options.shapeMask)) return 0;
    let alpha = 1;
    if (hasAnim) alpha *= getAnimAlpha(options.animPreset, x, y, cols, rows, now, options.animPresetSpeed);
    return alpha;
  }

  function getLightFactor(x: number, y: number, cols: number, rows: number): number {
    if (!hasLights) return 1;
    const nx = cols > 1 ? x / (cols - 1) : 0.5;
    const ny = rows > 1 ? y / (rows - 1) : 0.5;
    return computePointLightFactor(nx, ny, options.pointLights, now, options.discoMode, options.discoSpeed);
  }

  const renderMode = options.renderMode as string;
  const hasLights = options.pointLightsEnabled && options.pointLights.length > 0;
  const hasAnim = options.animPreset !== 'none';
  const hasMask = options.shapeMask !== 'none';
  const now = performance.now();

  // Pre-compute per-cell alpha and light factor for mask/anim/lights
  let cellAlphas: Float32Array | null = null;
  let cellLights: Float32Array | null = null;
  if (frame.cells && (hasMask || hasAnim || hasLights)) {
    const total = frame.cols * frame.rows;
    if (hasMask || hasAnim) {
      cellAlphas = new Float32Array(total);
      for (let y = 0; y < frame.rows; y++)
        for (let x = 0; x < frame.cols; x++)
          cellAlphas[y * frame.cols + x] = shouldRenderCell(x, y, frame.cols, frame.rows);
    }
    if (hasLights) {
      cellLights = new Float32Array(total);
      for (let y = 0; y < frame.rows; y++)
        for (let x = 0; x < frame.cols; x++)
          cellLights[y * frame.cols + x] = getLightFactor(x, y, frame.cols, frame.rows);
    }
  }

  if (isOverlay) {
    const cellW = cssW / frame.cols;
    const cellH = cssH / frame.rows;

    if (frame.cells) {
      if (glowRadius > 0) ctx.shadowBlur = glowRadius;
      let cur = '';
      const baseAlpha = options.charOpacity / 100;

      if (renderMode === 'filled_circle') {
        const radius = Math.min(cellW, cellH) * 0.4;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.beginPath();
            ctx.arc(x * cellW + cellW / 2, y * cellH + cellH / 2, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (renderMode === 'filled_square') {
        const sz = Math.min(cellW, cellH) * 0.8;
        const off = (Math.min(cellW, cellH) - sz) / 2;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillRect(x * cellW + off, y * cellH + off, sz, sz);
          }
        }
      } else if (renderMode === 'triangle') {
        const sz = Math.min(cellW, cellH) * 0.8;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = x * cellW + cellW / 2;
            const cy = y * cellH + cellH / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - sz / 2);
            ctx.lineTo(cx - sz / 2, cy + sz / 2);
            ctx.lineTo(cx + sz / 2, cy + sz / 2);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'diamond') {
        const sz = Math.min(cellW, cellH) * 0.45;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = x * cellW + cellW / 2;
            const cy = y * cellH + cellH / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - sz);
            ctx.lineTo(cx + sz, cy);
            ctx.lineTo(cx, cy + sz);
            ctx.lineTo(cx - sz, cy);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'cross') {
        const sz = Math.min(cellW, cellH) * 0.8;
        const arm = sz * 0.3;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = x * cellW + cellW / 2;
            const cy = y * cellH + cellH / 2;
            ctx.fillRect(cx - sz / 2, cy - arm / 2, sz, arm);
            ctx.fillRect(cx - arm / 2, cy - sz / 2, arm, sz);
          }
        }
      } else if (renderMode === 'heart') {
        const sz = Math.min(cellW, cellH) * 0.35;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = x * cellW + cellW / 2;
            const cy = y * cellH + cellH / 2;
            ctx.beginPath();
            ctx.arc(cx - sz * 0.5, cy - sz * 0.2, sz * 0.55, Math.PI, 0, false);
            ctx.arc(cx + sz * 0.5, cy - sz * 0.2, sz * 0.55, Math.PI, 0, false);
            ctx.lineTo(cx, cy + sz * 1.2);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'pixel') {
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
          }
        }
      } else if (renderMode === 'lego') {
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const px = x * cellW; const py = y * cellH;
            ctx.fillRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
            ctx.globalAlpha = (options.charOpacity / 100) * 0.4;
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            const studR = Math.min(cellW, cellH) * 0.28;
            ctx.beginPath();
            ctx.arc(px + cellW / 2, py + cellH / 2, studR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = options.charOpacity / 100;
            ctx.fillStyle = col;
            cur = col;
          }
        }
      } else if (renderMode === 'mosaic') {
        const gap = Math.max(1, Math.min(cellW, cellH) * 0.12);
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const px = x * cellW + gap / 2; const py = y * cellH + gap / 2;
            const tw = cellW - gap; const th = cellH - gap;
            ctx.beginPath();
            ctx.roundRect(px, py, tw, th, Math.min(tw, th) * 0.15);
            ctx.fill();
          }
        }
      } else if (renderMode === 'cube') {
        const sz = Math.min(cellW, cellH) * 0.45;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const [pr, pg, pb] = processColorRaw(c.r, c.g, c.b, lf);
            const cx = x * cellW + cellW / 2; const cy = y * cellH + cellH / 2;
            // Top face (lighter)
            ctx.fillStyle = `rgb(${Math.min(255, pr + 40)},${Math.min(255, pg + 40)},${Math.min(255, pb + 40)})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy - sz); ctx.lineTo(cx + sz, cy - sz * 0.4);
            ctx.lineTo(cx, cy + sz * 0.2); ctx.lineTo(cx - sz, cy - sz * 0.4);
            ctx.closePath(); ctx.fill();
            // Right face (original)
            ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy + sz * 0.2); ctx.lineTo(cx + sz, cy - sz * 0.4);
            ctx.lineTo(cx + sz, cy + sz * 0.3); ctx.lineTo(cx, cy + sz * 0.9);
            ctx.closePath(); ctx.fill();
            // Left face (darker)
            ctx.fillStyle = `rgb(${Math.max(0, pr - 50)},${Math.max(0, pg - 50)},${Math.max(0, pb - 50)})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy + sz * 0.2); ctx.lineTo(cx - sz, cy - sz * 0.4);
            ctx.lineTo(cx - sz, cy + sz * 0.3); ctx.lineTo(cx, cy + sz * 0.9);
            ctx.closePath(); ctx.fill();
            if (glowRadius > 0) { ctx.shadowColor = `rgb(${pr},${pg},${pb})`; }
          }
        }
      } else if (renderMode === 'hexagon') {
        const sz = Math.min(cellW, cellH) * 0.42;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const hx = x * cellW + cellW / 2;
            const hy = y * cellH + cellH / 2;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i - Math.PI / 6;
              const px = hx + sz * Math.cos(angle);
              const py = hy + sz * Math.sin(angle);
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'wave') {
        const sz = Math.min(cellW, cellH) * 0.4;
        const time = now * 0.002;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const waveOffset = Math.sin(x * 0.3 + y * 0.2 + time) * sz * 0.5;
            const radius = sz * (0.6 + 0.4 * Math.sin(x * 0.5 + y * 0.3 + time * 1.5));
            ctx.beginPath();
            ctx.arc(x * cellW + cellW / 2, y * cellH + cellH / 2 + waveOffset, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (renderMode === 'outline') {
        const sz = Math.min(cellW, cellH) * 0.38;
        ctx.lineWidth = Math.max(1, sz * 0.2);
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.strokeStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.beginPath();
            ctx.arc(x * cellW + cellW / 2, y * cellH + cellH / 2, sz, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      } else if (renderMode === 'mixed') {
        const mixChars = '@#$%&*+=?!';
        const fs = Math.max(2, Math.min(cellW / 0.65, cellH * 0.95));
        ctx.font = `bold ${fs}px "Courier New", Courier, monospace`;
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const rndChar = mixChars[(x * 7 + y * 13) % mixChars.length];
            ctx.fillText(rndChar, x * cellW, y * cellH);
          }
        }
      } else if (renderMode === 'halftone') {
        const maxR = Math.min(cellW, cellH) * 0.48;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const lum = (c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722) / 255;
            const radius = maxR * (1 - lum * 0.75);
            if (radius > 0.5) {
              ctx.beginPath();
              ctx.arc(x * cellW + cellW / 2, y * cellH + cellH / 2, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      } else {
        const fs = Math.max(2, Math.min(cellW / 0.65, cellH * 0.95));
        ctx.font = `${fs}px "Courier New", Courier, monospace`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillText(c.char, x * cellW, y * cellH);
          }
        }
      }
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }
  } else {
    const charW = options.fontSize * 0.7;
    const lineH = options.fontSize;
    const pad = 12;

    if (frame.cells) {
      if (glowRadius > 0) ctx.shadowBlur = glowRadius;
      let cur = '';
      const baseAlpha = options.charOpacity / 100;

      if (renderMode === 'filled_circle') {
        const radius = Math.min(charW, lineH) * 0.38;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.beginPath();
            ctx.arc(pad + x * charW + charW / 2, pad + y * lineH + lineH / 2, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (renderMode === 'filled_square') {
        const sz = Math.min(charW, lineH) * 0.75;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillRect(pad + x * charW, pad + y * lineH + (lineH - sz) / 2, sz, sz);
          }
        }
      } else if (renderMode === 'triangle') {
        const sz = Math.min(charW, lineH) * 0.75;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = pad + x * charW + charW / 2;
            const cy = pad + y * lineH + lineH / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - sz / 2);
            ctx.lineTo(cx - sz / 2, cy + sz / 2);
            ctx.lineTo(cx + sz / 2, cy + sz / 2);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'diamond') {
        const sz = Math.min(charW, lineH) * 0.42;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = pad + x * charW + charW / 2;
            const cy = pad + y * lineH + lineH / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - sz);
            ctx.lineTo(cx + sz, cy);
            ctx.lineTo(cx, cy + sz);
            ctx.lineTo(cx - sz, cy);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'cross') {
        const sz = Math.min(charW, lineH) * 0.75;
        const arm = sz * 0.3;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = pad + x * charW + charW / 2;
            const cy = pad + y * lineH + lineH / 2;
            ctx.fillRect(cx - sz / 2, cy - arm / 2, sz, arm);
            ctx.fillRect(cx - arm / 2, cy - sz / 2, arm, sz);
          }
        }
      } else if (renderMode === 'heart') {
        const sz = Math.min(charW, lineH) * 0.32;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const cx = pad + x * charW + charW / 2;
            const cy = pad + y * lineH + lineH / 2;
            ctx.beginPath();
            ctx.arc(cx - sz * 0.5, cy - sz * 0.2, sz * 0.55, Math.PI, 0, false);
            ctx.arc(cx + sz * 0.5, cy - sz * 0.2, sz * 0.55, Math.PI, 0, false);
            ctx.lineTo(cx, cy + sz * 1.2);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'pixel') {
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillRect(pad + x * charW, pad + y * lineH, charW, lineH);
          }
        }
      } else if (renderMode === 'lego') {
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const px = pad + x * charW; const py = pad + y * lineH;
            ctx.fillRect(px + 0.5, py + 0.5, charW - 1, lineH - 1);
            ctx.globalAlpha = (options.charOpacity / 100) * 0.4;
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            const studR = Math.min(charW, lineH) * 0.28;
            ctx.beginPath();
            ctx.arc(px + charW / 2, py + lineH / 2, studR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = options.charOpacity / 100;
            ctx.fillStyle = col;
            cur = col;
          }
        }
      } else if (renderMode === 'mosaic') {
        const gap = Math.max(1, Math.min(charW, lineH) * 0.12);
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const px = pad + x * charW + gap / 2; const py = pad + y * lineH + gap / 2;
            const tw = charW - gap; const th = lineH - gap;
            ctx.beginPath();
            ctx.roundRect(px, py, tw, th, Math.min(tw, th) * 0.15);
            ctx.fill();
          }
        }
      } else if (renderMode === 'cube') {
        const sz = Math.min(charW, lineH) * 0.45;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const [pr, pg, pb] = processColorRaw(c.r, c.g, c.b, lf);
            const cx = pad + x * charW + charW / 2; const cy = pad + y * lineH + lineH / 2;
            ctx.fillStyle = `rgb(${Math.min(255, pr + 40)},${Math.min(255, pg + 40)},${Math.min(255, pb + 40)})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy - sz); ctx.lineTo(cx + sz, cy - sz * 0.4);
            ctx.lineTo(cx, cy + sz * 0.2); ctx.lineTo(cx - sz, cy - sz * 0.4);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy + sz * 0.2); ctx.lineTo(cx + sz, cy - sz * 0.4);
            ctx.lineTo(cx + sz, cy + sz * 0.3); ctx.lineTo(cx, cy + sz * 0.9);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = `rgb(${Math.max(0, pr - 50)},${Math.max(0, pg - 50)},${Math.max(0, pb - 50)})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy + sz * 0.2); ctx.lineTo(cx - sz, cy - sz * 0.4);
            ctx.lineTo(cx - sz, cy + sz * 0.3); ctx.lineTo(cx, cy + sz * 0.9);
            ctx.closePath(); ctx.fill();
            if (glowRadius > 0) { ctx.shadowColor = `rgb(${pr},${pg},${pb})`; }
          }
        }
      } else if (renderMode === 'hexagon') {
        const sz = Math.min(charW, lineH) * 0.42;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const hx = pad + x * charW + charW / 2;
            const hy = pad + y * lineH + lineH / 2;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i - Math.PI / 6;
              const px = hx + sz * Math.cos(angle);
              const py = hy + sz * Math.sin(angle);
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (renderMode === 'wave') {
        const sz = Math.min(charW, lineH) * 0.38;
        const time = now * 0.002;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const waveOffset = Math.sin(x * 0.3 + y * 0.2 + time) * sz * 0.5;
            const radius = sz * (0.6 + 0.4 * Math.sin(x * 0.5 + y * 0.3 + time * 1.5));
            ctx.beginPath();
            ctx.arc(pad + x * charW + charW / 2, pad + y * lineH + lineH / 2 + waveOffset, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (renderMode === 'outline') {
        const sz = Math.min(charW, lineH) * 0.35;
        ctx.lineWidth = Math.max(1, sz * 0.2);
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.strokeStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.beginPath();
            ctx.arc(pad + x * charW + charW / 2, pad + y * lineH + lineH / 2, sz, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      } else if (renderMode === 'mixed') {
        const mixChars = '@#$%&*+=?!';
        ctx.font = `bold ${options.fontSize}px "Courier New", Courier, monospace`;
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            const rndChar = mixChars[(x * 7 + y * 13) % mixChars.length];
            ctx.fillText(rndChar, pad + x * charW, pad + y * lineH);
          }
        }
      } else if (renderMode === 'halftone') {
        const maxR = Math.min(charW, lineH) * 0.48;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            // Halftone: radius inversely proportional to luminance
            const lum = (c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722) / 255;
            const radius = maxR * (1 - lum * 0.75);
            if (radius > 0.5) {
              ctx.beginPath();
              ctx.arc(pad + x * charW + charW / 2, pad + y * lineH + lineH / 2, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      } else {
        ctx.font = `${options.fontSize}px "Share Tech Mono", "SF Mono", ui-monospace, monospace`;
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          const py = pad + y * lineH;
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const ci = y * frame.cols + x;
            if (cellAlphas && cellAlphas[ci] <= 0) continue;
            const lf = cellLights ? cellLights[ci] : 1;
            const ca = cellAlphas ? cellAlphas[ci] : 1;
            if (ca < 1) ctx.globalAlpha = baseAlpha * ca; else if (ctx.globalAlpha !== baseAlpha) ctx.globalAlpha = baseAlpha;
            const col = processColor(c.r, c.g, c.b, lf);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillText(c.char, pad + x * charW, py);
          }
        }
      }
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    } else {
      ctx.fillStyle = options.fgColor;
      ctx.font = `${options.fontSize}px "Share Tech Mono", "SF Mono", ui-monospace, monospace`;
      ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      frame.text.split('\n').forEach((line, y) =>
        ctx.fillText(line, 12, 12 + y * options.fontSize));
    }
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Watermark
  if (options.watermark) {
    ctx.save();
    ctx.globalAlpha = options.watermarkOpacity / 100;
    ctx.font = `bold 14px "Share Tech Mono", monospace`;
    ctx.fillStyle = '#ffffff';
    const metrics = ctx.measureText(options.watermark);
    const margin = 16;
    let wx: number, wy: number;
    switch (options.watermarkPosition) {
      case 'top-left': wx = margin; wy = margin + 14; break;
      case 'top-right': wx = cssW - metrics.width - margin; wy = margin + 14; break;
      case 'bottom-left': wx = margin; wy = cssH - margin; break;
      case 'center': wx = (cssW - metrics.width) / 2; wy = cssH / 2; break;
      default: wx = cssW - metrics.width - margin; wy = cssH - margin;
    }
    ctx.fillText(options.watermark, wx, wy);
    ctx.restore();
  }

  applyPostFX(ctx, cssW, cssH, options);

  // Zone mask compositing: GPU-accelerated using canvas compositing operations
  // Strategy: draw original, then stamp ASCII only where mask is white
  if (hasZoneMask && src && zoneMask) {
    const cw = canvas.width;
    const ch = canvas.height;

    // Get cached mask as a canvas (white alpha = mask coverage)
    const maskCvs = getMaskCanvas(zoneMask);

    // Get cached original-image canvas
    const origCvs = getOrigCanvas(src, cw, ch);

    // Use temp canvas for compositing: ASCII masked by zone shapes
    const [tmp, tmpCtx] = getTempCanvas(cw, ch);
    tmpCtx.clearRect(0, 0, cw, ch);

    // Step 1: Draw the mask (white regions = where ASCII shows)
    tmpCtx.globalCompositeOperation = 'source-over';
    tmpCtx.drawImage(maskCvs, 0, 0, cw, ch);

    // Step 2: Draw ASCII art clipped by mask alpha ('source-in' keeps ASCII only where mask is opaque)
    tmpCtx.globalCompositeOperation = 'source-in';
    tmpCtx.drawImage(canvas, 0, 0);

    // Step 3: Compose final — start with original image, layer masked ASCII on top
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(origCvs, 0, 0);

    // Step 4: Draw the masked ASCII on top (destination-over would put behind, we want on top)
    ctx.drawImage(tmp, 0, 0);
  }
}

function applyPostFX(ctx: CanvasRenderingContext2D, w: number, h: number, o: AsciiOptions) {
  if (o.fx_bloom) {
    const i = o.fx_bloom_intensity / 100;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const passes = [
      { blur: Math.round(2 + i * 4), alpha: i * 0.4 },
      { blur: Math.round(5 + i * 10), alpha: i * 0.3 },
      { blur: Math.round(12 + i * 18), alpha: i * 0.2 },
    ];
    for (const p of passes) {
      ctx.filter = `blur(${p.blur}px)`;
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(ctx.canvas, 0, 0);
    }
    ctx.restore();
  }
  if (o.fx_chromatic) {
    const px = o.fx_chromatic_px;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.22;
    ctx.drawImage(ctx.canvas, -px, 0); ctx.drawImage(ctx.canvas, px, 0); ctx.restore();
  }
  if (o.fx_scanlines) {
    const a = o.fx_scanlines_intensity / 200;
    ctx.save(); ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 2) { ctx.globalAlpha = a; ctx.fillRect(0, y, w, 1); }
    ctx.restore();
  }
  if (o.fx_vignette) {
    const i = o.fx_vignette_intensity / 100;
    ctx.save();
    const g = ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.3,w/2,h/2,Math.max(w,h)*0.75);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,`rgba(0,0,0,${(i*0.85).toFixed(2)})`);
    ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.fillRect(0,0,w,h); ctx.restore();
  }
  if (o.fx_grain) {
    const i = o.fx_grain_intensity / 100;
    ctx.save();
    const id = ctx.createImageData(w, h); const d = id.data;
    for (let p = 0; p < d.length; p += 4) {
      const n = (Math.random()-0.5)*255*i*0.6;
      d[p]=d[p+1]=d[p+2]=128+n; d[p+3]=Math.round(i*55);
    }
    ctx.putImageData(id, 0, 0); ctx.restore();
  }
  if (o.fx_glitch && Math.random() < o.fx_glitch_intensity/100) {
    ctx.save();
    for (let i = 0; i < Math.floor(2+o.fx_glitch_intensity/20); i++) {
      const y=Math.floor(Math.random()*h), sh=Math.floor(2+Math.random()*12);
      const shift=Math.floor((Math.random()-0.5)*o.fx_glitch_intensity*0.5);
      const d=ctx.getImageData(0,y,w,sh); ctx.putImageData(d,shift,y);
      ctx.globalAlpha=0.3; ctx.fillStyle=Math.random()>0.5?'#0ff':'#f0f';
      ctx.fillRect(shift,y,w,sh);
    }
    ctx.restore();
  }
  if (o.fx_crt) {
    const strength = o.fx_crt_intensity / 100 * 0.4;
    const src = ctx.getImageData(0, 0, Math.floor(w), Math.floor(h));
    const dst = ctx.createImageData(src.width, src.height);
    const sd = src.data, dd = dst.data;
    const cx = src.width / 2, cy = src.height / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    for (let py = 0; py < src.height; py++) {
      for (let px = 0; px < src.width; px++) {
        const dx = (px - cx) / maxR, dy = (py - cy) / maxR;
        const r2 = dx * dx + dy * dy;
        const f = 1 + r2 * strength;
        const sx = Math.round(cx + dx * f * maxR);
        const sy = Math.round(cy + dy * f * maxR);
        const di = (py * src.width + px) * 4;
        if (sx >= 0 && sx < src.width && sy >= 0 && sy < src.height) {
          const si = (sy * src.width + sx) * 4;
          dd[di] = sd[si]; dd[di+1] = sd[si+1]; dd[di+2] = sd[si+2]; dd[di+3] = sd[si+3];
        } else {
          dd[di+3] = 255;
        }
      }
    }
    ctx.putImageData(dst, 0, 0);
  }
  if (o.fx_reeded) {
    // Reeded Glass: vertical refraction strips that shift pixels horizontally
    const intensity = o.fx_reeded_intensity / 100;
    const slices = Math.max(5, Math.min(80, o.fx_reeded_slices));
    const sliceW = w / slices;
    const src = ctx.getImageData(0, 0, Math.floor(w), Math.floor(h));
    const dst = ctx.createImageData(src.width, src.height);
    const sd = src.data, dd = dst.data;
    for (let py = 0; py < src.height; py++) {
      for (let px = 0; px < src.width; px++) {
        // Each slice acts as a cylindrical lens
        const slicePos = (px % sliceW) / sliceW; // 0..1 within slice
        const refract = Math.sin(slicePos * Math.PI) * intensity * sliceW * 0.3;
        const sx = Math.round(px + refract);
        const di = (py * src.width + px) * 4;
        if (sx >= 0 && sx < src.width) {
          const si = (py * src.width + sx) * 4;
          dd[di] = sd[si]; dd[di+1] = sd[si+1]; dd[di+2] = sd[si+2]; dd[di+3] = sd[si+3];
        } else {
          dd[di] = sd[di]; dd[di+1] = sd[di+1]; dd[di+2] = sd[di+2]; dd[di+3] = 255;
        }
      }
    }
    ctx.putImageData(dst, 0, 0);
  }
  if (o.fx_lightrays) {
    // Light Rays: angular beams radiating from a point source
    const intensity = o.fx_lightrays_intensity / 100;
    const cx = o.fx_lightrays_x * w;
    const cy = o.fx_lightrays_y * h;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numRays = 12 + Math.floor(intensity * 20);
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const length = Math.max(w, h) * (0.8 + Math.random() * 0.4);
      const spread = (0.02 + Math.random() * 0.04) * Math.PI;
      const ex1 = cx + Math.cos(angle - spread) * length;
      const ey1 = cy + Math.sin(angle - spread) * length;
      const ex2 = cx + Math.cos(angle + spread) * length;
      const ey2 = cy + Math.sin(angle + spread) * length;
      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
      grad.addColorStop(0, `rgba(255,255,255,${(intensity * 0.3).toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(255,255,200,${(intensity * 0.1).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex1, ey1);
      ctx.lineTo(ex2, ey2);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.globalAlpha = intensity * 0.5;
      ctx.fill();
    }
    ctx.restore();
  }
}
