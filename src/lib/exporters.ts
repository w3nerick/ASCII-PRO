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
