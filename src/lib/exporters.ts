import type { AsciiFrame } from './asciiConverter';
import { frameCanvasSize, renderFrameToCanvas } from './videoRecorder';

/** Trigger a browser download for a Blob. */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(frame: AsciiFrame, filename = 'ascii-pro.txt') {
  download(new Blob([frame.text], { type: 'text/plain;charset=utf-8' }), filename);
}

export function copyText(frame: AsciiFrame): Promise<void> {
  return navigator.clipboard.writeText(frame.text);
}

/** Build a self-contained HTML file with per-char colors. */
export function frameToHtml(
  frame: AsciiFrame,
  opts: { background: string; foreground: string },
): string {
  let body = '';
  if (frame.cells) {
    for (const row of frame.cells) {
      for (const c of row) {
        const safe = c.char === '<' ? '&lt;' : c.char === '>' ? '&gt;' : c.char === '&' ? '&amp;' : c.char;
        body += `<span style="color:rgb(${c.r},${c.g},${c.b})">${safe}</span>`;
      }
      body += '\n';
    }
  } else {
    body = frame.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>ASCII-PRO</title>
<style>
body{margin:0;background:${opts.background};color:${opts.foreground};font-family:'Share Tech Mono',monospace;}
pre{font-size:8px;line-height:1;letter-spacing:0;margin:0;padding:16px;white-space:pre;}
</style></head><body><pre>${body}</pre></body></html>`;
}

export function downloadHtml(
  frame: AsciiFrame,
  opts: { background: string; foreground: string } = { background: '#05010d', foreground: '#00fff5' },
  filename = 'ascii-pro.html',
) {
  const html = frameToHtml(frame, opts);
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
}

/**
 * Render the ASCII frame to a PNG image at optional higher resolution.
 * Works for both color and mono modes.
 */
export function frameToPngBlob(
  frame: AsciiFrame,
  opts: { background: string; foreground: string; fontSize?: number; color?: boolean; scale?: number },
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const scale = opts.scale ?? 1;
    const fontSize = (opts.fontSize ?? 12) * scale;
    const size = frameCanvasSize(frame, fontSize);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d')!;
    renderFrameToCanvas(ctx, frame, {
      fontSize,
      bgColor: opts.background,
      fgColor: opts.foreground,
      color: opts.color ?? !!frame.cells,
    });
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

export async function downloadPng(
  frame: AsciiFrame,
  opts: { background: string; foreground: string; fontSize?: number; color?: boolean; scale?: number } = {
    background: '#05010d',
    foreground: '#00fff5',
  },
  filename = 'ascii-pro.png',
) {
  const blob = await frameToPngBlob(frame, opts);
  download(blob, filename);
}

export function downloadVideoBlob(blob: Blob, filename = 'ascii-pro.webm') {
  download(blob, filename);
}

/**
 * Convert a WEBM blob to MP4 by re-muxing isn't trivial client-side,
 * so we try to record directly in mp4 if supported, otherwise fall back to webm.
 * This helper determines the best available video mime type.
 */
export function bestVideoMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder !== 'undefined') {
    // Try MP4 first (Safari, some Chrome versions)
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      return { mime: 'video/mp4;codecs=avc1', ext: 'mp4' };
    }
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      return { mime: 'video/mp4', ext: 'mp4' };
    }
    // VP9 webm (Chrome/Firefox)
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      return { mime: 'video/webm;codecs=vp9', ext: 'webm' };
    }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      return { mime: 'video/webm;codecs=vp8', ext: 'webm' };
    }
  }
  return { mime: 'video/webm', ext: 'webm' };
}

/* ─── SVG Export ─────────────────────────────────────────────────────── */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export type SvgRenderMode = 'text' | 'filled_circle' | 'filled_square' | 'triangle' | 'diamond' | 'cross' | 'heart' | 'pixel' | 'lego' | 'mosaic' | 'cube' | 'mixed' | 'hexagon' | 'wave' | 'outline';

export interface SvgExportOptions {
  background?: string;
  foreground?: string;
  fontSize?: number;
  renderMode?: SvgRenderMode;
  color?: boolean;
}

/**
 * Generate an SVG string from an AsciiFrame.
 * Supports colored (per-cell) and monochrome modes.
 * For 'text' renderMode, each character is a <text> element.
 * For shape modes, appropriate SVG primitives are used.
 */
export function frameToSvg(frame: AsciiFrame, opts: SvgExportOptions = {}): string {
  const fontSize = opts.fontSize ?? 10;
  const bg = opts.background ?? '#05010d';
  const fg = opts.foreground ?? '#00fff5';
  const renderMode = opts.renderMode ?? 'text';
  const useColor = opts.color ?? !!frame.cells;

  // Character cell dimensions (monospace proportions)
  const cellW = fontSize * 0.6;
  const cellH = fontSize * 1.2;
  const width = frame.cols * cellW;
  const height = frame.rows * cellH;

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  lines.push(`<rect width="100%" height="100%" fill="${escapeXml(bg)}"/>`);

  if (renderMode === 'text') {
    lines.push(`<g font-family="'Share Tech Mono', monospace" font-size="${fontSize}" dominant-baseline="text-before-edge">`);
  }

  // Get cells: use frame.cells if available, otherwise split text lines
  const rows: { char: string; r: number; g: number; b: number }[][] = [];
  if (frame.cells) {
    for (const row of frame.cells) {
      rows.push(row);
    }
  } else {
    const textLines = frame.text.split('\n');
    for (let y = 0; y < frame.rows; y++) {
      const line = textLines[y] ?? '';
      const row: { char: string; r: number; g: number; b: number }[] = [];
      for (let x = 0; x < frame.cols; x++) {
        row.push({ char: line[x] ?? ' ', r: 0, g: 255, b: 245 });
      }
      rows.push(row);
    }
  }

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const cell = row[x];
      if (cell.char === ' ') continue;

      const cx = x * cellW;
      const cy = y * cellH;
      const color = useColor ? `rgb(${cell.r},${cell.g},${cell.b})` : fg;

      if (renderMode === 'text') {
        lines.push(`<text x="${cx}" y="${cy}" fill="${color}">${escapeXml(cell.char)}</text>`);
      } else {
        // Shape modes: center of cell
        const mx = cx + cellW / 2;
        const my = cy + cellH / 2;
        const r = Math.min(cellW, cellH) * 0.45;

        switch (renderMode) {
          case 'filled_circle':
            lines.push(`<circle cx="${mx}" cy="${my}" r="${r}" fill="${color}"/>`);
            break;
          case 'filled_square':
          case 'pixel':
          case 'lego':
          case 'mosaic':
          case 'cube':
            lines.push(`<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" fill="${color}"/>`);
            break;
          case 'triangle':
            lines.push(`<polygon points="${mx},${cy + cellH * 0.05} ${cx + cellW * 0.05},${cy + cellH * 0.95} ${cx + cellW * 0.95},${cy + cellH * 0.95}" fill="${color}"/>`);
            break;
          case 'diamond': {
            const pts = `${mx},${cy} ${cx + cellW},${my} ${mx},${cy + cellH} ${cx},${my}`;
            lines.push(`<polygon points="${pts}" fill="${color}"/>`);
            break;
          }
          case 'cross': {
            const t = r * 0.35;
            lines.push(`<rect x="${mx - t}" y="${cy}" width="${t * 2}" height="${cellH}" fill="${color}"/>`);
            lines.push(`<rect x="${cx}" y="${my - t}" width="${cellW}" height="${t * 2}" fill="${color}"/>`);
            break;
          }
          case 'heart': {
            const s = r * 0.9;
            lines.push(`<path d="M${mx},${my + s * 0.6} C${mx - s * 1.5},${my - s * 0.5} ${mx - s * 0.5},${my - s * 1.2} ${mx},${my - s * 0.3} C${mx + s * 0.5},${my - s * 1.2} ${mx + s * 1.5},${my - s * 0.5} ${mx},${my + s * 0.6}Z" fill="${color}"/>`);
            break;
          }
          case 'hexagon': {
            const hr = r * 0.95;
            const pts = Array.from({ length: 6 }, (_, i) => {
              const a = (Math.PI / 3) * i - Math.PI / 6;
              return `${mx + hr * Math.cos(a)},${my + hr * Math.sin(a)}`;
            }).join(' ');
            lines.push(`<polygon points="${pts}" fill="${color}"/>`);
            break;
          }
          case 'wave':
            lines.push(`<ellipse cx="${mx}" cy="${my}" rx="${cellW * 0.45}" ry="${cellH * 0.25}" fill="${color}"/>`);
            break;
          case 'outline':
            lines.push(`<circle cx="${mx}" cy="${my}" r="${r}" fill="none" stroke="${color}" stroke-width="1"/>`);
            break;
          case 'mixed':
          default:
            // Mixed: alternate between circle and square
            if ((x + y) % 2 === 0) {
              lines.push(`<circle cx="${mx}" cy="${my}" r="${r}" fill="${color}"/>`);
            } else {
              lines.push(`<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" fill="${color}"/>`);
            }
            break;
        }
      }
    }
  }

  if (renderMode === 'text') {
    lines.push('</g>');
  }

  lines.push('</svg>');
  return lines.join('\n');
}

export function downloadSvg(
  frame: AsciiFrame,
  opts: SvgExportOptions = {},
  filename = 'ascii-pro.svg',
) {
  const svg = frameToSvg(frame, opts);
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}
