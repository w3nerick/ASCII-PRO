import { CHARSETS, type CharsetKey } from './charsets';

export interface AsciiOptions {
  /* ---- Conversion options (changing any of these requires re-running) ---- */
  width: number;
  charset: CharsetKey;
  customRamp: string;
  invert: boolean;
  color: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  colorEnhance: number;  // 0..100: boosts color vibrance in output
  blur: number;
  edges: boolean;
  edgeThreshold: number;
  dithering: boolean;
  density: number;       // 0.5..2: character density multiplier (affects aspect ratio)
  /* ---- Display-only options (do NOT trigger re-conversion) ---- */
  fontSize: number;
  bgColor: string;
  fgColor: string;
  // Background mode
  bgMode: 'solid' | 'blurred' | 'original' | 'transparent';
  bgBlur: number;       // 0..60 px — only for 'blurred' mode
  bgOpacity: number;    // 0..100
  // Post-FX (applied on canvas after ASCII render)
  fx_scanlines: boolean;
  fx_scanlines_intensity: number;   // 0..100
  fx_vignette: boolean;
  fx_vignette_intensity: number;    // 0..100
  fx_glitch: boolean;
  fx_glitch_intensity: number;      // 0..100
  fx_chromatic: boolean;
  fx_chromatic_px: number;          // 1..20
  fx_bloom: boolean;
  fx_bloom_intensity: number;       // 0..100
  fx_grain: boolean;
  fx_grain_intensity: number;       // 0..100
}

export interface AsciiCell {
  char: string;
  r: number;
  g: number;
  b: number;
}

export interface AsciiFrame {
  text: string;
  cells?: AsciiCell[][];
  cols: number;
  rows: number;
}

const CHAR_ASPECT = 0.5;

export const DEFAULT_OPTIONS: AsciiOptions = {
  width: 180,
  charset: 'detailed',
  customRamp: '@%#*+=-:. ',
  invert: false,
  color: true,
  brightness: 0,
  contrast: 15,
  saturation: 20,
  colorEnhance: 30,
  blur: 0,
  edges: false,
  edgeThreshold: 60,
  dithering: false,
  density: 1,
  fontSize: 9,
  bgColor: '#000000',
  fgColor: '#ffffff',
  bgMode: 'original',
  bgBlur: 0,
  bgOpacity: 100,
  fx_scanlines: false,
  fx_scanlines_intensity: 40,
  fx_vignette: false,
  fx_vignette_intensity: 50,
  fx_glitch: false,
  fx_glitch_intensity: 30,
  fx_chromatic: false,
  fx_chromatic_px: 3,
  fx_bloom: false,
  fx_bloom_intensity: 40,
  fx_grain: false,
  fx_grain_intensity: 25,
};

/**
 * A short fingerprint of every option that affects the ASCII output.
 * Display-only options (fontSize/bgColor/fgColor) are excluded so that
 * tweaking them doesn't trigger an expensive re-conversion.
 */
export function conversionKey(o: AsciiOptions): string {
  return [
    o.width,
    o.charset,
    o.charset === 'custom' ? o.customRamp : '',
    o.invert ? 1 : 0,
    o.color ? 1 : 0,
    o.brightness,
    o.contrast,
    o.saturation,
    o.colorEnhance,
    o.blur,
    o.edges ? 1 : 0,
    o.edges ? o.edgeThreshold : 0,
    o.dithering ? 1 : 0,
    o.density,
  ].join('|');
}

function getRamp(opts: AsciiOptions): string {
  if (opts.charset === 'custom') {
    return opts.customRamp.length >= 2 ? opts.customRamp : '@. ';
  }
  return CHARSETS[opts.charset]?.ramp ?? CHARSETS.standard.ramp;
}

function adjust(lum: number, brightness: number, contrast: number): number {
  const c = (contrast + 100) / 100;
  let v = (lum - 0.5) * c + 0.5 + brightness / 200;
  if (v < 0) v = 0;
  if (v > 1) v = 1;
  return v;
}

function sobel(lum: Float32Array, w: number, h: number, out: Float32Array): void {
  out.fill(0);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = lum[i - w - 1], t = lum[i - w], tr = lum[i - w + 1];
      const l  = lum[i - 1],                       r = lum[i + 1];
      const bl = lum[i + w - 1], b = lum[i + w], br = lum[i + w + 1];
      const gx = -tl + tr - 2 * l + 2 * r - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      const m = Math.sqrt(gx * gx + gy * gy);
      out[i] = m > 1 ? 1 : m;
    }
  }
}

function ditherFS(buf: Float32Array, w: number, h: number, levels: number) {
  const step = 1 / (levels - 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = buf[i];
      const q = Math.round(old / step) * step;
      const err = old - q;
      buf[i] = q;
      if (x + 1 < w)              buf[i + 1]     += err * (7 / 16);
      if (x > 0 && y + 1 < h)     buf[i + w - 1] += err * (3 / 16);
      if (y + 1 < h)              buf[i + w]     += err * (5 / 16);
      if (x + 1 < w && y + 1 < h) buf[i + w + 1] += err * (1 / 16);
    }
  }
}

/* ============================================================
 * Reusable working buffers (allocated lazily, kept across calls)
 * ============================================================ */
let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _lum: Float32Array | null = null;
let _edge: Float32Array | null = null;
let _work: Float32Array | null = null;

function getCtx(cols: number, rows: number) {
  if (!_canvas) {
    _canvas = document.createElement('canvas');
    _ctx = _canvas.getContext('2d', { willReadFrequently: true });
  }
  if (_canvas!.width !== cols || _canvas!.height !== rows) {
    _canvas!.width = cols;
    _canvas!.height = rows;
  }
  return _ctx!;
}

function getBuf(name: '_lum' | '_edge' | '_work', size: number): Float32Array {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slot: { [k: string]: Float32Array | null } = { _lum, _edge, _work } as any;
  let buf = slot[name];
  if (!buf || buf.length !== size) buf = new Float32Array(size);
  if (name === '_lum') _lum = buf;
  else if (name === '_edge') _edge = buf;
  else _work = buf;
  return buf;
}

/**
 * Convert any drawable source to ASCII art using the full pipeline:
 *   draw -> blur+saturate -> luminance -> sobel? -> bright/contrast
 *        -> invert? -> dither? -> ramp index
 *
 * This implementation reuses a single offscreen canvas and three working
 * Float32Array buffers across calls to avoid per-frame allocations.
 */
export function sourceToAscii(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: AsciiOptions,
): AsciiFrame {
  const ramp = getRamp(options);
  const cols = Math.max(8, Math.min(400, Math.floor(options.width)));
  const aspect = sourceHeight / sourceWidth;
  const densityFactor = Math.max(0.3, Math.min(2.5, options.density));
  const rows = Math.max(4, Math.floor(cols * aspect * CHAR_ASPECT * densityFactor));
  const total = cols * rows;

  const ctx = getCtx(cols, rows);
  ctx.imageSmoothingEnabled = true;

  const satPct = 100 + options.saturation;
  const filters: string[] = [];
  if (options.blur > 0) filters.push(`blur(${options.blur}px)`);
  if (satPct !== 100) filters.push(`saturate(${satPct}%)`);
  ctx.filter = filters.length ? filters.join(' ') : 'none';
  ctx.drawImage(source, 0, 0, cols, rows);
  ctx.filter = 'none';

  const data = ctx.getImageData(0, 0, cols, rows).data;

  const lum = getBuf('_lum', total);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const a = data[i + 3] / 255;
    lum[p] = ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * a;
  }

  let intensity = lum;
  if (options.edges) {
    const edge = getBuf('_edge', total);
    sobel(lum, cols, rows, edge);
    const t = options.edgeThreshold / 255;
    const inv = 1 / (1 - t || 1);
    for (let p = 0; p < total; p++) {
      const v = edge[p];
      edge[p] = v < t ? 0 : Math.min(1, (v - t) * inv);
    }
    intensity = edge;
  }

  const work = getBuf('_work', total);
  for (let p = 0; p < total; p++) {
    let v = adjust(intensity[p], options.brightness, options.contrast);
    if (options.invert) v = 1 - v;
    work[p] = v;
  }

  if (options.dithering) ditherFS(work, cols, rows, ramp.length);

  const rampLast = ramp.length - 1;
  const lines: string[] = new Array(rows);
  const cells: AsciiCell[][] | undefined = options.color ? new Array(rows) : undefined;

  // Color enhance factor: 0 = no change, 100 = double saturation
  const ceFactor = 1 + options.colorEnhance / 100;

  // Build line strings via a char buffer to avoid expensive string concatenation.
  const charBuf = new Array<string>(cols);

  for (let y = 0; y < rows; y++) {
    const row: AsciiCell[] | undefined = cells ? new Array(cols) : undefined;
    for (let x = 0; x < cols; x++) {
      const p = y * cols + x;
      let v = work[p];
      if (v < 0) v = 0; else if (v > 1) v = 1;
      const idx = (1 - v) * rampLast + 0.5;
      const ch = ramp[idx | 0] ?? ' ';
      charBuf[x] = ch;
      if (row) {
        const i = p * 4;
        let cr = data[i], cg = data[i + 1], cb = data[i + 2];
        // Apply color enhance (boost distance from gray)
        if (ceFactor !== 1) {
          const gray = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
          cr = Math.max(0, Math.min(255, gray + (cr - gray) * ceFactor));
          cg = Math.max(0, Math.min(255, gray + (cg - gray) * ceFactor));
          cb = Math.max(0, Math.min(255, gray + (cb - gray) * ceFactor));
        }
        row[x] = { char: ch, r: cr | 0, g: cg | 0, b: cb | 0 };
      }
    }
    lines[y] = charBuf.join('');
    if (cells && row) cells[y] = row;
  }

  return {
    text: lines.join('\n'),
    cells,
    cols,
    rows,
  };
}

export function imageToAscii(img: HTMLImageElement, options: AsciiOptions): AsciiFrame {
  return sourceToAscii(img, img.naturalWidth || img.width, img.naturalHeight || img.height, options);
}

export function videoFrameToAscii(video: HTMLVideoElement, options: AsciiOptions): AsciiFrame {
  return sourceToAscii(video, video.videoWidth, video.videoHeight, options);
}
