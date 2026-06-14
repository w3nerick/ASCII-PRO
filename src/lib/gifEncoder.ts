/**
 * Real GIF89a encoder with:
 * - Median-cut color quantization (256 colors max)
 * - LZW compression
 * - Bayer ordered dithering
 * - Perfect loop support (NETSCAPE 2.0 extension)
 *
 * Inspired by lumenshaders' approach but fully rewritten for ASCII PRO.
 * Zero dependencies — pure TypeScript.
 */

/* ─── Color Quantization (Median Cut) ─────────────────────────── */

interface ColorBox {
  colors: Uint8Array; // flat R,G,B triples
  count: number;
}

function medianCut(pixels: Uint8Array, maxColors: number): Uint8Array {
  // Build initial box
  const count = pixels.length / 3;
  const boxes: ColorBox[] = [{ colors: pixels, count }];

  while (boxes.length < maxColors) {
    // Find box with largest volume (range)
    let bestIdx = 0;
    let bestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.count < 2) continue;
      const range = boxRange(b);
      if (range > bestRange) { bestRange = range; bestIdx = i; }
    }
    if (bestRange <= 0) break;

    const box = boxes[bestIdx];
    const axis = longestAxis(box);
    // Sort by the chosen axis and split at median
    const sorted = sortByAxis(box.colors, box.count, axis);
    const mid = Math.floor(box.count / 2);
    const left: Uint8Array = sorted.slice(0, mid * 3);
    const right: Uint8Array = sorted.slice(mid * 3);
    boxes[bestIdx] = { colors: left, count: mid };
    boxes.push({ colors: right, count: box.count - mid });
  }

  // Build palette: average color of each box
  const palette = new Uint8Array(boxes.length * 3);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    let rSum = 0, gSum = 0, bSum = 0;
    for (let j = 0; j < b.count; j++) {
      rSum += b.colors[j * 3];
      gSum += b.colors[j * 3 + 1];
      bSum += b.colors[j * 3 + 2];
    }
    palette[i * 3] = Math.round(rSum / b.count);
    palette[i * 3 + 1] = Math.round(gSum / b.count);
    palette[i * 3 + 2] = Math.round(bSum / b.count);
  }
  return palette;
}

function boxRange(box: ColorBox): number {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (let i = 0; i < box.count; i++) {
    const r = box.colors[i * 3], g = box.colors[i * 3 + 1], b = box.colors[i * 3 + 2];
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
    if (g < gMin) gMin = g; if (g > gMax) gMax = g;
    if (b < bMin) bMin = b; if (b > bMax) bMax = b;
  }
  return Math.max(rMax - rMin, gMax - gMin, bMax - bMin);
}

function longestAxis(box: ColorBox): number {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (let i = 0; i < box.count; i++) {
    const r = box.colors[i * 3], g = box.colors[i * 3 + 1], b = box.colors[i * 3 + 2];
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
    if (g < gMin) gMin = g; if (g > gMax) gMax = g;
    if (b < bMin) bMin = b; if (b > bMax) bMax = b;
  }
  const rRange = rMax - rMin, gRange = gMax - gMin, bRange = bMax - bMin;
  if (rRange >= gRange && rRange >= bRange) return 0;
  if (gRange >= bRange) return 1;
  return 2;
}

function sortByAxis(colors: Uint8Array, count: number, axis: number): Uint8Array {
  const arr: number[][] = [];
  for (let i = 0; i < count; i++) {
    arr.push([colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]]);
  }
  arr.sort((a, b) => a[axis] - b[axis]);
  const result = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    result[i * 3] = arr[i][0];
    result[i * 3 + 1] = arr[i][1];
    result[i * 3 + 2] = arr[i][2];
  }
  return result;
}

/* ─── Bayer Dithering ─────────────────────────────────────────── */

const BAYER_4X4 = [
  [ 0, 8, 2,10],
  [12, 4,14, 6],
  [ 3,11, 1, 9],
  [15, 7,13, 5],
];

function bayerThreshold(x: number, y: number): number {
  return (BAYER_4X4[y & 3][x & 3] / 16 - 0.5) * 32;
}

/* ─── Nearest Color Lookup ────────────────────────────────────── */

function nearestColorIndex(r: number, g: number, b: number, palette: Uint8Array): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  const numColors = palette.length / 3;
  for (let i = 0; i < numColors; i++) {
    const dr = r - palette[i * 3];
    const dg = g - palette[i * 3 + 1];
    const db = b - palette[i * 3 + 2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

/* ─── LZW Encoder ─────────────────────────────────────────────── */

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  const output: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  function writeBits(val: number, bits: number) {
    bitBuf |= val << bitCount;
    bitCount += bits;
    while (bitCount >= 8) {
      output.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  }

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxTableSize = 4096;
  // Use a simple prefix table
  const table = new Map<string, number>();

  function resetTable() {
    table.clear();
    for (let i = 0; i < clearCode; i++) {
      table.set(String(i), i);
    }
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  }

  resetTable();
  writeBits(clearCode, codeSize);

  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = String(indices[i]);
    const combined = prefix + ',' + k;
    if (table.has(combined)) {
      prefix = combined;
    } else {
      writeBits(table.get(prefix)!, codeSize);
      if (nextCode < maxTableSize) {
        table.set(combined, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeBits(clearCode, codeSize);
        resetTable();
      }
      prefix = k;
    }
  }

  writeBits(table.get(prefix)!, codeSize);
  writeBits(eoiCode, codeSize);
  if (bitCount > 0) output.push(bitBuf & 0xff);

  return new Uint8Array(output);
}

/* ─── GIF Binary Writer ───────────────────────────────────────── */

class GifWriter {
  private buf: number[] = [];

  writeByte(b: number) { this.buf.push(b & 0xff); }
  writeShort(v: number) { this.buf.push(v & 0xff, (v >> 8) & 0xff); }
  writeBytes(data: Uint8Array | number[]) {
    for (let i = 0; i < data.length; i++) this.buf.push(data[i]);
  }
  writeString(s: string) {
    for (let i = 0; i < s.length; i++) this.buf.push(s.charCodeAt(i));
  }

  writeSubBlocks(data: Uint8Array) {
    let offset = 0;
    while (offset < data.length) {
      const size = Math.min(255, data.length - offset);
      this.writeByte(size);
      for (let i = 0; i < size; i++) this.buf.push(data[offset + i]);
      offset += size;
    }
    this.writeByte(0); // block terminator
  }

  toBlob(): Blob {
    return new Blob([new Uint8Array(this.buf)], { type: 'image/gif' });
  }
}

/* ─── Public GIF Encoder Class ────────────────────────────────── */

export interface GifEncoderOptions {
  width: number;
  height: number;
  fps?: number;
  loop?: boolean;        // infinite loop (default true)
  dither?: boolean;      // Bayer dithering (default true)
  quality?: number;      // 1-30, lower = better quality/slower (default 10)
}

export class GifEncoder {
  private width: number;
  private height: number;
  private delay: number; // in centiseconds (GIF spec)
  private frames: ImageData[] = [];
  private loop: boolean;
  private dither: boolean;
  private quality: number;

  constructor(width: number, height: number, fps = 10, opts?: Partial<GifEncoderOptions>) {
    this.width = width;
    this.height = height;
    this.delay = Math.round(100 / fps); // GIF delay is in centiseconds
    this.loop = opts?.loop ?? true;
    this.dither = opts?.dither ?? true;
    this.quality = opts?.quality ?? 10;
  }

  addFrame(ctx: CanvasRenderingContext2D) {
    this.frames.push(ctx.getImageData(0, 0, this.width, this.height));
  }

  async render(): Promise<Blob> {
    if (this.frames.length === 0) throw new Error('No frames added');

    // Sample pixels for global palette (quality controls sample density: lower = more samples = better)
    const sampleStep = Math.max(1, Math.floor(this.quality * this.frames.length * this.width * this.height / 500000));
    const samplePixels: number[] = [];
    for (const frame of this.frames) {
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4 * sampleStep) {
        if (d[i + 3] > 128) { // skip transparent
          samplePixels.push(d[i], d[i + 1], d[i + 2]);
        }
      }
    }

    const rawSamples = new Uint8Array(samplePixels);
    const numColors = 256;
    let palette = medianCut(rawSamples, numColors);
    // Pad palette to power of 2 (GIF requires 2^n colors)
    const palSize = 256;
    const paddedPalette = new Uint8Array(palSize * 3);
    paddedPalette.set(palette.slice(0, palSize * 3));
    palette = paddedPalette;

    const gif = new GifWriter();

    // Header
    gif.writeString('GIF89a');

    // Logical Screen Descriptor
    gif.writeShort(this.width);
    gif.writeShort(this.height);
    // Global color table flag | color resolution | sort | size of GCT
    gif.writeByte(0xf7); // GCT flag=1, color res=7 (8 bits), sort=1, GCT size=7 (2^(7+1)=256)
    gif.writeByte(0);    // Background color index
    gif.writeByte(0);    // Pixel aspect ratio

    // Global Color Table (256 entries × 3 bytes)
    gif.writeBytes(palette);

    // NETSCAPE 2.0 extension for looping
    if (this.loop) {
      gif.writeByte(0x21); // Extension
      gif.writeByte(0xff); // Application extension
      gif.writeByte(11);   // Block size
      gif.writeString('NETSCAPE2.0');
      gif.writeByte(3);    // Sub-block size
      gif.writeByte(1);    // Loop sub-block ID
      gif.writeShort(0);   // Loop count (0 = infinite)
      gif.writeByte(0);    // Terminator
    }

    // Encode each frame
    const minCodeSize = 8; // for 256-color palette
    for (const frame of this.frames) {
      // Graphic Control Extension
      gif.writeByte(0x21); // Extension introducer
      gif.writeByte(0xf9); // GCE label
      gif.writeByte(4);    // Block size
      gif.writeByte(0x00); // Disposal: none, no transparent
      gif.writeShort(this.delay);
      gif.writeByte(0);    // Transparent color index (unused)
      gif.writeByte(0);    // Terminator

      // Image Descriptor
      gif.writeByte(0x2c); // Image separator
      gif.writeShort(0);   // Left
      gif.writeShort(0);   // Top
      gif.writeShort(this.width);
      gif.writeShort(this.height);
      gif.writeByte(0);    // No local color table

      // Convert frame pixels to palette indices with optional dithering
      const indices = new Uint8Array(this.width * this.height);
      const d = frame.data;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const p = (y * this.width + x) * 4;
          let r = d[p], g = d[p + 1], b = d[p + 2];
          if (this.dither) {
            const t = bayerThreshold(x, y);
            r = Math.max(0, Math.min(255, r + t));
            g = Math.max(0, Math.min(255, g + t));
            b = Math.max(0, Math.min(255, b + t));
          }
          indices[y * this.width + x] = nearestColorIndex(r, g, b, palette);
        }
      }

      // LZW Image Data
      gif.writeByte(minCodeSize);
      const lzwData = lzwEncode(indices, minCodeSize);
      gif.writeSubBlocks(lzwData);
    }

    // Trailer
    gif.writeByte(0x3b);

    return gif.toBlob();
  }
}
