import { useEffect, useRef } from 'react';
import type { AsciiFrame, AsciiOptions } from '../lib/asciiConverter';

interface Props {
  frame: AsciiFrame | null;
  options: AsciiOptions;
  /** Original source for bgMode blurred/original */
  sourceEl?: HTMLImageElement | HTMLVideoElement | null;
}

export function AsciiViewer({ frame, options, sourceEl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: options.bgMode === 'transparent' });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fontSize = options.fontSize;

    if (!frame) {
      const w = Math.max(1, canvas.clientWidth || 320);
      const h = Math.max(1, canvas.clientHeight || 240);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = options.fgColor;
      ctx.globalAlpha = 0.32;
      ctx.font = '13px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting input', w / 2, h / 2);
      ctx.globalAlpha = 1;
      return;
    }

    const charW = fontSize * 0.6;
    const lineH = fontSize;
    const padding = 12;
    const cssW = frame.cols * charW + padding * 2;
    const cssH = frame.rows * lineH + padding * 2;

    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── BACKGROUND ──────────────────────────────────────
    const bgAlpha = options.bgOpacity / 100;
    if (options.bgMode === 'transparent') {
      ctx.clearRect(0, 0, cssW, cssH);
    } else if ((options.bgMode === 'blurred' || options.bgMode === 'original') && sourceEl) {
      ctx.save();
      if (options.bgMode === 'blurred') ctx.filter = `blur(${options.bgBlur}px)`;
      ctx.globalAlpha = bgAlpha;
      ctx.drawImage(sourceEl, 0, 0, cssW, cssH);
      ctx.restore();
    } else {
      ctx.globalAlpha = bgAlpha;
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.globalAlpha = 1;
    }

    // ── ASCII CHARS ──────────────────────────────────────
    ctx.font = `${fontSize}px "Share Tech Mono", "SF Mono", ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 1;

    if (frame.cells) {
      let currentColor = '';
      for (let y = 0; y < frame.cells.length; y++) {
        const row = frame.cells[y];
        const py = padding + y * lineH;
        for (let x = 0; x < row.length; x++) {
          const c = row[x];
          if (c.char === ' ') continue;
          const color = `rgb(${c.r},${c.g},${c.b})`;
          if (color !== currentColor) { ctx.fillStyle = color; currentColor = color; }
          ctx.fillText(c.char, padding + x * charW, py);
        }
      }
    } else {
      ctx.fillStyle = options.fgColor;
      const lines = frame.text.split('\n');
      for (let y = 0; y < lines.length; y++) {
        ctx.fillText(lines[y], padding, padding + y * lineH);
      }
    }

    // ── POST-FX ─────────────────────────────────────────
    applyPostFX(ctx, cssW, cssH, options);

  }, [frame, options, sourceEl]);

  return (
    <div
      className="h-full w-full overflow-auto rounded-2xl"
      style={{ background: options.bgMode === 'transparent' ? 'transparent' : options.bgColor }}
    >
      <canvas ref={canvasRef} className="block" style={{ minWidth: '100%', minHeight: '100%' }} />
    </div>
  );
}

// ── POST-FX PIPELINE ────────────────────────────────────
function applyPostFX(ctx: CanvasRenderingContext2D, w: number, h: number, o: AsciiOptions) {
  // Bloom — glow via shadow blur trick
  if (o.fx_bloom) {
    const intensity = o.fx_bloom_intensity / 100;
    ctx.save();
    ctx.filter = `blur(${Math.round(3 + intensity * 8)}px)`;
    ctx.globalAlpha = intensity * 0.55;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }

  // Chromatic aberration — shift R and B channels
  if (o.fx_chromatic) {
    const px = o.fx_chromatic_px;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.globalCompositeOperation = 'screen';
    // Red channel shift left
    const tmpR = document.createElement('canvas');
    tmpR.width = w; tmpR.height = h;
    const rCtx = tmpR.getContext('2d')!;
    rCtx.drawImage(ctx.canvas, 0, 0);
    // Use multiply for red
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#ff0000'; ctx.globalAlpha = 0.18;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.3;
    ctx.drawImage(tmpR, -px, 0);  // red left
    ctx.drawImage(tmpR, px, 0);   // blue right (approx)
    ctx.restore();
  }

  // Scanlines
  if (o.fx_scanlines) {
    const alpha = o.fx_scanlines_intensity / 200;
    ctx.save();
    ctx.fillStyle = '#000000';
    for (let y = 0; y < h; y += 2) {
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  }

  // Vignette
  if (o.fx_vignette) {
    const intensity = o.fx_vignette_intensity / 100;
    ctx.save();
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${(intensity * 0.85).toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Film grain
  if (o.fx_grain) {
    const intensity = o.fx_grain_intensity / 100;
    ctx.save();
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 255 * intensity * 0.6;
      data[i] = data[i + 1] = data[i + 2] = 128 + noise;
      data[i + 3] = Math.round(intensity * 60);
    }
    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
  }

  // Glitch — random horizontal slice shifts
  if (o.fx_glitch && Math.random() < o.fx_glitch_intensity / 100) {
    ctx.save();
    const slices = Math.floor(2 + o.fx_glitch_intensity / 20);
    for (let i = 0; i < slices; i++) {
      const y = Math.floor(Math.random() * h);
      const sliceH = Math.floor(2 + Math.random() * 12);
      const shift = Math.floor((Math.random() - 0.5) * o.fx_glitch_intensity * 0.5);
      const imgData = ctx.getImageData(0, y, w, sliceH);
      ctx.putImageData(imgData, shift, y);
      // Color tint on glitch slice
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = Math.random() > 0.5 ? '#00ffff' : '#ff00ff';
      ctx.fillRect(shift, y, w, sliceH);
    }
    ctx.restore();
  }
}
