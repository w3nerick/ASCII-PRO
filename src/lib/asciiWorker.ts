import { CHARSETS, type CharsetKey } from './charsets';

export interface WorkerRequest {
  id: number;
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
  cols: number;
  rows: number;
  charset: CharsetKey;
  customRamp: string;
  invert: boolean;
  color: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  colorEnhance: number;
  blur: number;
  edges: boolean;
  edgeThreshold: number;
  dithering: boolean;
  coverage: number;
  density: number;
}

export interface WorkerResponse {
  id: number;
  text: string;
  cells: { char: string; r: number; g: number; b: number }[][] | null;
  cols: number;
  rows: number;
}

function getRamp(charset: CharsetKey, customRamp: string): string {
  if (charset === 'custom') {
    return customRamp.length >= 2 ? customRamp : '@. ';
  }
  return CHARSETS[charset]?.ramp ?? CHARSETS.standard.ramp;
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
      const l = lum[i - 1], r = lum[i + 1];
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
      if (x + 1 < w) buf[i + 1] += err * (7 / 16);
      if (x > 0 && y + 1 < h) buf[i + w - 1] += err * (3 / 16);
      if (y + 1 < h) buf[i + w] += err * (5 / 16);
      if (x + 1 < w && y + 1 < h) buf[i + w + 1] += err * (1 / 16);
    }
  }
}

function processFrame(req: WorkerRequest): WorkerResponse {
  const { cols, rows, imageData } = req;
  const ramp = getRamp(req.charset, req.customRamp);
  const total = cols * rows;
  const data = imageData;

  const lum = new Float32Array(total);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const a = data[i + 3] / 255;
    lum[p] = ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * a;
  }

  let intensity = lum;
  if (req.edges) {
    const edge = new Float32Array(total);
    sobel(lum, cols, rows, edge);
    const t = req.edgeThreshold / 255;
    const inv = 1 / (1 - t || 1);
    for (let p = 0; p < total; p++) {
      const v = edge[p];
      edge[p] = v < t ? 0 : Math.min(1, (v - t) * inv);
    }
    intensity = edge;
  }

  const work = new Float32Array(total);
  for (let p = 0; p < total; p++) {
    let v = adjust(intensity[p], req.brightness, req.contrast);
    if (req.invert) v = 1 - v;
    work[p] = v;
  }

  if (req.dithering) ditherFS(work, cols, rows, ramp.length);

  const rampLast = ramp.length - 1;
  const lines: string[] = new Array(rows);
  const cells: { char: string; r: number; g: number; b: number }[][] | null = req.color ? new Array(rows) : null;
  const ceFactor = 1 + req.colorEnhance / 100;
  const charBuf = new Array<string>(cols);

  for (let y = 0; y < rows; y++) {
    const row: { char: string; r: number; g: number; b: number }[] | null = cells ? new Array(cols) : null;
    for (let x = 0; x < cols; x++) {
      const p = y * cols + x;
      let v = work[p];
      if (v < 0) v = 0; else if (v > 1) v = 1;
      const coverageThreshold = req.coverage / 100;
      const skipCell = v > coverageThreshold;
      const idx = (1 - v) * rampLast + 0.5;
      const ch = skipCell ? ' ' : (ramp[idx | 0] ?? ' ');
      charBuf[x] = ch;
      if (row) {
        const i = p * 4;
        let cr = data[i], cg = data[i + 1], cb = data[i + 2];
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

  return { id: req.id, text: lines.join('\n'), cells, cols, rows };
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const result = processFrame(e.data);
  self.postMessage(result);
};
