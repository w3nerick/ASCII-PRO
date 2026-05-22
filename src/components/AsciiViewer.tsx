import { useEffect, useRef } from 'react';
import type { AsciiFrame, AsciiOptions } from '../lib/asciiConverter';
import { CHARSETS } from '../lib/charsets';

interface Props {
  frame: AsciiFrame | null;
  options: AsciiOptions;
  sourceEl?: HTMLImageElement | HTMLVideoElement | null;
}

export function AsciiViewer({ frame, options, sourceEl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const animRef = useRef<number | null>(null);
  const animFrameRef = useRef<AsciiFrame | null>(null);
  const animOptionsRef = useRef<AsciiOptions>(options);

  if (sourceEl) sourceRef.current = sourceEl;
  animFrameRef.current = frame;
  animOptionsRef.current = options;

  // Animation loop for randomizing chars
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
      // Randomize a subset of chars and re-render
      const mutated = f.cells.map(row =>
        row.map(c => c.char === ' ' ? c : {
          ...c,
          char: Math.random() < 0.15 ? ramp[Math.floor(Math.random() * ramp.length)] : c.char
        })
      );
      renderToCanvas(canvas, { ...f, cells: mutated }, o, sourceRef.current);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [options.animatedAscii, options.animSpeed, frame, options.charset, options.customRamp]);

  // Static render when not animating
  useEffect(() => {
    if (options.animatedAscii) return;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderToCanvas(canvas, frame, options, sourceRef.current);
  }, [frame, options, sourceEl]);

  const bgStyle = options.bgMode === 'transparent' ? 'transparent'
    : (options.bgMode === 'original' || options.bgMode === 'blurred') ? '#000' : options.bgColor;

  return (
    <div className="h-full w-full overflow-hidden flex items-center justify-center"
      style={{ background: bgStyle }}>
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
}

// ── CORE RENDERER ────────────────────────────────────────
function renderToCanvas(
  canvas: HTMLCanvasElement,
  frame: AsciiFrame | null,
  options: AsciiOptions,
  src: HTMLImageElement | HTMLVideoElement | null,
) {
  const ctx = canvas.getContext('2d', { alpha: options.bgMode === 'transparent' });
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // ── IDLE STATE ─────────────────────────────────────────
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

  // ── CANVAS SIZE ────────────────────────────────────────
  let cssW: number, cssH: number;
  if (isOverlay) {
    const sw = src instanceof HTMLImageElement ? (src.naturalWidth || src.width) : (src as HTMLVideoElement).videoWidth;
    const sh = src instanceof HTMLImageElement ? (src.naturalHeight || src.height) : (src as HTMLVideoElement).videoHeight;
    cssW = sw > 0 ? sw : frame.cols * 8;
    cssH = sh > 0 ? sh : frame.rows * 14;
  } else {
    const charW = options.fontSize * 0.6;
    cssW = frame.cols * charW + 24;
    cssH = frame.rows * options.fontSize + 24;
  }

  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── BACKGROUND ────────────────────────────────────────
  if (options.bgMode === 'transparent') {
    ctx.clearRect(0, 0, cssW, cssH);
  } else if (options.bgMode === 'original' && src) {
    // Draw image at bgOpacity — the key to the ascii-magic look
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

  // ── ASCII CHARS ───────────────────────────────────────
  ctx.globalAlpha = options.charOpacity / 100;

  if (isOverlay) {
    const cellW = cssW / frame.cols;
    const cellH = cssH / frame.rows;
    const fs = Math.max(2, Math.min(cellW / 0.55, cellH * 0.95));
    ctx.font = `${fs}px "Courier New", Courier, monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    if (frame.cells) {
      let cur = '';
      for (let y = 0; y < frame.cells.length; y++) {
        const row = frame.cells[y];
        for (let x = 0; x < row.length; x++) {
          const c = row[x];
          if (c.char === ' ') continue;
          const col = `rgb(${c.r},${c.g},${c.b})`;
          if (col !== cur) { ctx.fillStyle = col; cur = col; }
          ctx.fillText(c.char, x * cellW, y * cellH);
        }
      }
    }
  } else {
    // Classic: dark background + bright colored chars
    const charW = options.fontSize * 0.6;
    const lineH = options.fontSize;
    const pad = 12;
    ctx.font = `${options.fontSize}px "Share Tech Mono", "SF Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';

    if (frame.cells) {
      let cur = '';
      for (let y = 0; y < frame.cells.length; y++) {
        const row = frame.cells[y];
        const py = pad + y * lineH;
        for (let x = 0; x < row.length; x++) {
          const c = row[x];
          if (c.char === ' ') continue;
          const col = `rgb(${c.r},${c.g},${c.b})`;
          if (col !== cur) { ctx.fillStyle = col; cur = col; }
          ctx.fillText(c.char, pad + x * charW, py);
        }
      }
    } else {
      ctx.fillStyle = options.fgColor;
      frame.text.split('\n').forEach((line, y) =>
        ctx.fillText(line, 12, 12 + y * options.fontSize));
    }
  }

  ctx.globalAlpha = 1;

  // ── POST-FX ──────────────────────────────────────────
  applyPostFX(ctx, cssW, cssH, options);
}

function applyPostFX(ctx: CanvasRenderingContext2D, w: number, h: number, o: AsciiOptions) {
  if (o.fx_bloom) {
    const i = o.fx_bloom_intensity / 100;
    ctx.save(); ctx.filter = `blur(${Math.round(3 + i * 8)}px)`;
    ctx.globalAlpha = i * 0.5; ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(ctx.canvas, 0, 0); ctx.restore();
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
}
