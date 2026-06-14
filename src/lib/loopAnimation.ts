/**
 * Perfect Loop Animation System
 *
 * Uses circular noise sampling: noise is evaluated along a circle in
 * 2D parameter space, so the last frame connects seamlessly to the first.
 * This produces loopable GIF/video exports without visible seams.
 *
 * Technique from lumenshaders adapted for ASCII character mutation.
 */

import type { AsciiFrame, AsciiCell } from './asciiConverter';

const TAU = Math.PI * 2;

/* ─── Simple hash-based noise (deterministic, no dependencies) ── */

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy);
  const n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1);
  const n11 = hash(ix + 1, iy + 1);
  return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) +
         n01 * (1 - sx) * sy + n11 * sx * sy;
}

/**
 * Sample noise at a circular position in parameter space.
 * `phase` goes from 0 to 1 over one full loop.
 * The result is continuous and loops perfectly.
 */
function loopNoise(cellX: number, cellY: number, phase: number, scale = 0.3): number {
  // Map phase to a circle in 2D noise space
  const cx = Math.cos(TAU * phase) * 2;
  const cy = Math.sin(TAU * phase) * 2;
  return smoothNoise(cellX * scale + cx, cellY * scale + cy);
}

/* ─── Loop Frame Generator ────────────────────────────────────── */

export interface LoopOptions {
  /** Number of frames in the loop (default: 24) */
  frameCount: number;
  /** Character ramp to sample from */
  ramp: string;
  /** Mutation probability per cell per frame (0..1, default 0.12) */
  mutationRate: number;
  /** How much the animation affects brightness (0..1, default 0.3) */
  brightnessWave: number;
  /** Spatial noise scale (default 0.3) — smaller = larger blobs */
  noiseScale: number;
}

const DEFAULT_LOOP_OPTS: LoopOptions = {
  frameCount: 24,
  ramp: '@%#*+=-:. ',
  mutationRate: 0.12,
  brightnessWave: 0.3,
  noiseScale: 0.3,
};

/**
 * Generate an array of perfectly looping frames from a base frame.
 * Each frame has subtle character mutations and brightness oscillations
 * that loop seamlessly.
 */
export function generateLoopFrames(
  baseFrame: AsciiFrame,
  opts: Partial<LoopOptions> = {},
): AsciiFrame[] {
  const o = { ...DEFAULT_LOOP_OPTS, ...opts };
  const { frameCount, ramp, mutationRate, brightnessWave, noiseScale } = o;

  if (!baseFrame.cells) {
    // Non-color mode: just mutate characters
    return generateTextLoopFrames(baseFrame, o);
  }

  const frames: AsciiFrame[] = [];
  for (let f = 0; f < frameCount; f++) {
    const phase = f / frameCount; // 0..1 looping
    const newCells: AsciiCell[][] = [];

    for (let y = 0; y < baseFrame.rows; y++) {
      const row: AsciiCell[] = [];
      for (let x = 0; x < baseFrame.cols; x++) {
        const cell = baseFrame.cells[y][x];
        if (cell.char === ' ') {
          row.push(cell);
          continue;
        }

        const n = loopNoise(x, y, phase, noiseScale);

        // Character mutation: noise-driven probability
        let char = cell.char;
        if (n > (1 - mutationRate)) {
          const idx = Math.floor(n * ramp.length) % ramp.length;
          char = ramp[idx];
        }

        // Brightness wave: smooth oscillation
        const bWave = 1 + (n - 0.5) * brightnessWave * 2;
        const r = Math.max(0, Math.min(255, Math.round(cell.r * bWave)));
        const g = Math.max(0, Math.min(255, Math.round(cell.g * bWave)));
        const b = Math.max(0, Math.min(255, Math.round(cell.b * bWave)));

        row.push({ char, r, g, b });
      }
      newCells.push(row);
    }

    frames.push({
      text: newCells.map(row => row.map(c => c.char).join('')).join('\n'),
      cells: newCells,
      cols: baseFrame.cols,
      rows: baseFrame.rows,
    });
  }

  return frames;
}

function generateTextLoopFrames(baseFrame: AsciiFrame, opts: LoopOptions): AsciiFrame[] {
  const { frameCount, ramp, mutationRate, noiseScale } = opts;
  const lines = baseFrame.text.split('\n');
  const frames: AsciiFrame[] = [];

  for (let f = 0; f < frameCount; f++) {
    const phase = f / frameCount;
    const newLines: string[] = [];

    for (let y = 0; y < lines.length; y++) {
      let line = '';
      for (let x = 0; x < lines[y].length; x++) {
        const ch = lines[y][x];
        if (ch === ' ') { line += ' '; continue; }
        const n = loopNoise(x, y, phase, noiseScale);
        if (n > (1 - mutationRate)) {
          const idx = Math.floor(n * ramp.length) % ramp.length;
          line += ramp[idx];
        } else {
          line += ch;
        }
      }
      newLines.push(line);
    }

    frames.push({
      text: newLines.join('\n'),
      cols: baseFrame.cols,
      rows: baseFrame.rows,
    });
  }

  return frames;
}
