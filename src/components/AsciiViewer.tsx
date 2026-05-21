import { useEffect, useRef } from 'react';
import type { AsciiFrame, AsciiOptions } from '../lib/asciiConverter';

interface Props {
  frame: AsciiFrame | null;
  options: AsciiOptions;
  sourceEl?: HTMLImageElement | HTMLVideoElement | null;
}

export function AsciiViewer({ frame, options, sourceEl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  if (sourceEl) sourceRef.current = sourceEl;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: options.bgMode === 'transparent' });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fontSize = options.fontSize;
    const src = sourceRef.current;
    const isOverlay = options.bgMode === 'original' || options.bgMode === 'blurred';

    // ── IDLE STATE ───────────────────────────────────────
    if (!frame) {
      const w = Math.max(1, canvas.clientWidth || 320);
      const h = Math.max(1, canvas.clientHeight || 240);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = options.fgColor;
      ctx.globalAlpha = 0.32;
      ctx.font = '13px -apple-system, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting input', w / 2, h / 2);
      ctx.globalAlpha = 1;
      return;
    }

    // ── CANVAS SIZE ──────────────────────────────────────
    let cssW: number, cssH: number;

    if (isOverlay && src) {
      const srcW = src instanceof HTMLImageElement
        ? (src.naturalWidth || src.width)
        : (src as HTMLVideoElement).videoWidth;
      const srcH = src instanceof HTMLImageElement
        ? (src.naturalHeight || src.height)
        : (src as HTMLVideoElement).videoHeight;
      // Fallback for webcam that hasn't loaded dimensions yet
      cssW = srcW > 0 ? srcW : frame.cols * 8;
      cssH = srcH > 0 ? srcH : frame.rows * 14;
    } else {
      const charW = fontSize * 0.6;
      const lineH = fontSize;
      const padding = 12;
      cssW = frame.cols * charW + padding * 2;
      cssH = frame.rows * lineH + padding * 2;
    }

    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── BACKGROUND ──────────────────────────────────────
    if (options.bgMode === 'transparent') {
      ctx.clearRect(0, 0, cssW, cssH);

    } else if (options.bgMode === 'original' && src) {
      // Full image, no dimming — chars create contrast by themselves
      ctx.drawImage(src, 0, 0, cssW, cssH);

    } else if (options.bgMode === 'blurred' && src) {
      ctx.save();
      ctx.filter = `blur(${options.bgBlur}px)`;
      const pad = options.bgBlur * 2;
      ctx.drawImage(src, -pad, -pad, cssW + pad * 2, cssH + pad * 2);
      ctx.restore();

    } else {
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    // ── ASCII CHARS ──────────────────────────────────────
    if (isOverlay && src) {
      const cellW = cssW / frame.cols;
      const cellH = cssH / frame.rows;
      // Font fills each cell: width = fontSize * 0.6 → fontSize = cellW / 0.6
      // Cap by cellH so chars don't overflow row height
      const fs = Math.max(2, Math.min(cellW / 0.6, cellH));
      ctx.font = `${fs}px "Courier New", Courier, monospace`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      if (frame.cells) {
        let currentColor = '';
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const color = `rgb(${c.r},${c.g},${c.b})`;
            if (color !== currentColor) { ctx.fillStyle = color; currentColor = color; }
            ctx.fillText(c.char, x * cellW, y * cellH);
          }
        }
      }

    } else {
      // Classic mode
      const charW = fontSize * 0.6;
      const lineH = fontSize;
      const padding = 12;
      ctx.font = `${fontSize}px "Share Tech Mono", "SF Mono", ui-monospace, Menlo, monospace`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

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
          ctx.fillText(lines[y], 12, 12 + y * lineH);
        }
      }
    }

    // ── POST-FX ─────────────────────────────────────────
    applyPostFX(ctx, cssW, cssH, options);

  }, [frame, options, sourceEl]);

  const bgStyle = options.bgMode === 'transparent'
    ? 'transparent'
    : (options.bgMode === 'original' || options.bgMode === 'blurred') ? '#000' : options.bgColor;

  return (
    <div className="h-full w-full overflow-auto rounded-2xl flex items-center justify-center"
      style={{ background: bgStyle }}>
      <canvas ref={canvasRef} className="block max-w-full max-h-full object-contain" />
    </div>
  );
}

function applyPostFX(ctx: CanvasRenderingContext2D, w: number, h: number, o: AsciiOptions) {
  if (o.fx_bloom) {
    const intensity = o.fx_bloom_intensity / 100;
    ctx.save();
    ctx.filter = `blur(${Math.round(3 + intensity * 8)}px)`;
    ctx.globalAlpha = intensity * 0.55;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }
  if (o.fx_chromatic) {
    const px = o.fx_chromatic_px;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.25;
    ctx.drawImage(ctx.canvas, -px, 0);
    ctx.drawImage(ctx.canvas, px, 0);
    ctx.restore();
  }
  if (o.fx_scanlines) {
    const alpha = o.fx_scanlines_intensity / 200;
    ctx.save();
    ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 2) { ctx.globalAlpha = alpha; ctx.fillRect(0, y, w, 1); }
    ctx.restore();
  }
  if (o.fx_vignette) {
    const intensity = o.fx_vignette_intensity / 100;
    ctx.save();
    const grad = ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.3,w/2,h/2,Math.max(w,h)*0.75);
    grad.addColorStop(0,'rgba(0,0,0,0)');
    grad.addColorStop(1,`rgba(0,0,0,${(intensity*0.85).toFixed(2)})`);
    ctx.fillStyle = grad; ctx.globalAlpha = 1; ctx.fillRect(0,0,w,h);
    ctx.restore();
  }
  if (o.fx_grain) {
    const intensity = o.fx_grain_intensity / 100;
    ctx.save();
    const id = ctx.createImageData(w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random()-0.5)*255*intensity*0.6;
      d[i]=d[i+1]=d[i+2]=128+n; d[i+3]=Math.round(intensity*60);
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
}
