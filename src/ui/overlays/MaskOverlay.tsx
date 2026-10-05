import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brush, Square, Circle, Eraser, Check } from 'lucide-react';
import { patchLook, setUi, useStore } from '../../state/store';
import { getMask, paintShape, paintStroke, fillMask, clearMask } from '../../state/mask';
import { onFrame, designSize } from '../../state/renderer';

export function MaskOverlay({ aspect }: { aspect: number }) {
  const mask = useStore((s) => s.doc.look.mask);
  const tool = useStore((s) => s.ui.tool);
  const ref = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [shape, setShape] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const painting = tool === 'mask' && mask.enabled;
  const stage = document.querySelector('.stage');

  // Keep mask canvas in sync with the output aspect.
  useEffect(() => {
    if (mask.enabled) getMask(aspect);
  }, [mask.enabled, aspect]);

  // Redraw the red overlay after each engine frame (cheap canvas ops).
  useEffect(() => {
    if (!mask.enabled || !mask.showOverlay) return;
    const draw = () => {
      const c = overlay.current;
      const m = getMask(aspect);
      if (!c) return;
      if (c.width !== m.width || c.height !== m.height) {
        c.width = m.width;
        c.height = m.height;
      }
      const ctx = c.getContext('2d')!;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(m, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = mask.invert ? 'rgba(80,160,255,0.35)' : 'rgba(255,70,70,0.35)';
      ctx.fillRect(0, 0, c.width, c.height);
    };
    draw();
    return onFrame(draw);
  }, [mask.enabled, mask.showOverlay, mask.invert, aspect]);

  if (!mask.enabled) return null;

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width };
  };
  const d = designSize();
  const brushMaskPx = () => {
    const m = getMask(aspect);
    return (mask.brushSize / 2) * (m.width / d.w);
  };

  const down = (e: React.PointerEvent) => {
    if (!painting || e.button !== 0) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p0 = norm(e);
    if (mask.tool === 1 || mask.tool === 2) {
      setShape({ x0: p0.x, y0: p0.y, x1: p0.x, y1: p0.y });
      const move = (ev: PointerEvent) => {
        const p = norm(ev);
        setShape({ x0: p0.x, y0: p0.y, x1: p.x, y1: p.y });
      };
      const up = (ev: PointerEvent) => {
        const p = norm(ev);
        if (Math.abs(p.x - p0.x) > 0.003 && Math.abs(p.y - p0.y) > 0.003) paintShape(mask.tool === 1 ? 'rect' : 'ellipse', p0.x, p0.y, p.x, p.y, e.altKey);
        setShape(null);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    const erase = mask.tool === 3 || e.altKey;
    let last = p0;
    paintStroke(p0.x, p0.y, p0.x, p0.y, brushMaskPx(), erase);
    const move = (ev: PointerEvent) => {
      const p = norm(ev);
      paintStroke(last.x, last.y, p.x, p.y, brushMaskPx(), erase);
      last = p;
      setCursor({ x: p.x, y: p.y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const wrapW = ref.current?.clientWidth || 1;
  const cursorPx = mask.brushSize * (wrapW / d.w);

  return (
    <>
      <div
        className="mask-layer"
        ref={ref}
        style={{ pointerEvents: painting ? 'auto' : 'none', cursor: painting && (mask.tool === 0 || mask.tool === 3) ? 'none' : painting ? 'crosshair' : 'default' }}
        onPointerDown={down}
        onPointerMove={(e) => painting && setCursor(norm(e))}
        onPointerLeave={() => setCursor(null)}
      >
        {mask.showOverlay && <canvas ref={overlay} />}
        {painting && cursor && (mask.tool === 0 || mask.tool === 3) && (
          <span className="brush-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, width: cursorPx, height: cursorPx }} />
        )}
        {shape && (
          <span
            style={{
              position: 'absolute', border: '1px dashed #fff', borderRadius: mask.tool === 2 ? '50%' : 0, pointerEvents: 'none',
              left: `${Math.min(shape.x0, shape.x1) * 100}%`, top: `${Math.min(shape.y0, shape.y1) * 100}%`,
              width: `${Math.abs(shape.x1 - shape.x0) * 100}%`, height: `${Math.abs(shape.y1 - shape.y0) * 100}%`,
            }}
          />
        )}
      </div>
      {painting && stage && createPortal(
        <div className="floating-bar" onPointerDown={(e) => e.stopPropagation()}>
          {[{ t: 0, icon: Brush, l: 'Brush' }, { t: 1, icon: Square, l: 'Rectangle' }, { t: 2, icon: Circle, l: 'Ellipse' }, { t: 3, icon: Eraser, l: 'Eraser' }].map(({ t, icon: I, l }) => (
            <button key={t} className={`chip wide ${mask.tool === t ? 'on' : ''}`} onClick={() => patchLook('mask', { tool: t })} title={l}><I size={14} /></button>
          ))}
          {(mask.tool === 0 || mask.tool === 3) && (
            <input
              type="range"
              className="range"
              style={{ width: 110, ['--p' as string]: `${((mask.brushSize - 4) / 296) * 100}%` }}
              min={4}
              max={300}
              value={mask.brushSize}
              title="Brush size"
              onChange={(e) => patchLook('mask', { brushSize: Number(e.target.value) })}
            />
          )}
          <span className="fb-sep" />
          <button className="chip wide" onClick={fillMask}>Fill</button>
          <button className="chip wide" onClick={clearMask}>Clear</button>
          <button className={`chip wide ${mask.invert ? 'on' : ''}`} onClick={() => patchLook('mask', { invert: !mask.invert })}>Invert</button>
          <span className="fb-sep" />
          <button className="btn-solid" style={{ height: 30 }} onClick={() => setUi({ tool: 'none' })}><Check size={14} /> Done</button>
        </div>,
        stage,
      )}
    </>
  );
}
