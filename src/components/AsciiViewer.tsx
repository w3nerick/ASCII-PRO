import { useEffect, useRef } from 'react';
import type { AsciiFrame, AsciiOptions, ColorPalette } from '../lib/asciiConverter';
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
      renderToCanvas(canvas, { ...f, cells: mutated }, o, sourceRef.current);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [options.animatedAscii, options.animSpeed, frame, options.charset, options.customRamp]);

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

// ── COLOR PALETTES ──────────────────────────────────────
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

  const glowRadius = options.charGlow / 100 * 12;
  const brightMul = options.charBrightness / 100;
  const palette = options.colorPalette;
  const useGradient = options.gradientMap;

  function processColor(r: number, g: number, b: number): string {
    let pr: number, pg: number, pb: number;
    if (useGradient) {
      [pr, pg, pb] = applyGradientMap(r, g, b, options.gradientStart, options.gradientEnd);
    } else {
      [pr, pg, pb] = applyPalette(r, g, b, palette);
    }
    if (brightMul !== 1) {
      pr = Math.min(255, Math.round(pr * brightMul));
      pg = Math.min(255, Math.round(pg * brightMul));
      pb = Math.min(255, Math.round(pb * brightMul));
    }
    return `rgb(${pr | 0},${pg | 0},${pb | 0})`;
  }

  const renderMode = options.renderMode;

  if (isOverlay) {
    const cellW = cssW / frame.cols;
    const cellH = cssH / frame.rows;

    if (frame.cells) {
      if (glowRadius > 0) ctx.shadowBlur = glowRadius;
      let cur = '';

      if (renderMode === 'filled_circle') {
        const radius = Math.min(cellW, cellH) * 0.4;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const col = processColor(c.r, c.g, c.b);
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
            const col = processColor(c.r, c.g, c.b);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillRect(x * cellW + off, y * cellH + off, sz, sz);
          }
        }
      } else {
        const fs = Math.max(2, Math.min(cellW / 0.55, cellH * 0.95));
        ctx.font = `${fs}px "Courier New", Courier, monospace`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const col = processColor(c.r, c.g, c.b);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillText(c.char, x * cellW, y * cellH);
          }
        }
      }
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }
  } else {
    const charW = options.fontSize * 0.6;
    const lineH = options.fontSize;
    const pad = 12;

    if (frame.cells) {
      if (glowRadius > 0) ctx.shadowBlur = glowRadius;
      let cur = '';

      if (renderMode === 'filled_circle') {
        const radius = Math.min(charW, lineH) * 0.38;
        for (let y = 0; y < frame.cells.length; y++) {
          const row = frame.cells[y];
          for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c.char === ' ') continue;
            const col = processColor(c.r, c.g, c.b);
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
            const col = processColor(c.r, c.g, c.b);
            if (col !== cur) { ctx.fillStyle = col; if (glowRadius > 0) ctx.shadowColor = col; cur = col; }
            ctx.fillRect(pad + x * charW, pad + y * lineH + (lineH - sz) / 2, sz, sz);
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
            const col = processColor(c.r, c.g, c.b);
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

  ctx.globalAlpha = 1;

  // ── POST-FX ──────────────────────────────────────────
  applyPostFX(ctx, cssW, cssH, options);
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
}
