import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, Check, X } from 'lucide-react';
import type { CropRect } from '../../engine/types';
import { getState, setUi, updateDoc, useStore } from '../../state/store';
import { rectOutToSrc, rectSrcToOut, clamp01, outputAspect, rotateCrop } from './geom';

const ASPECTS: { label: string; v: number }[] = [
  { label: 'Free', v: 0 },
  { label: 'Original', v: -1 },
  { label: '1:1', v: 1 },
  { label: '4:5', v: 4 / 5 },
  { label: '3:4', v: 3 / 4 },
  { label: '16:9', v: 16 / 9 },
  { label: '9:16', v: 9 / 16 },
  { label: '3:2', v: 3 / 2 },
];

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export function CropOverlay() {
  const source = useStore((s) => s.source);
  const transform = useStore((s) => s.doc.transform);
  const imgAspect = outputAspect(source, null, transform, true);
  const [rect, setRect] = useState<CropRect>(() => {
    const c = getState().doc.crop;
    return c ? rectSrcToOut(c, getState().doc.transform) : { x: 0, y: 0, w: 1, h: 1 };
  });
  const [ratio, setRatio] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const stage = document.querySelector('.stage');

  const effRatio = ratio === -1 ? imgAspect : ratio;

  const fitRatio = (r: CropRect, R: number): CropRect => {
    if (R <= 0) return r;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    let h = r.h, w = (h * R) / imgAspect;
    if (w > 1) { w = 1; h = (w * imgAspect) / R; }
    if (h > 1) { h = 1; w = (h * R) / imgAspect; }
    return { x: clamp01(Math.min(cx - w / 2, 1 - w)), y: clamp01(Math.min(cy - h / 2, 1 - h)), w, h };
  };

  useEffect(() => {
    if (effRatio > 0) setRect((r) => fitRatio(r, effRatio));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio, imgAspect]);

  const start = (h: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const wrap = ref.current?.getBoundingClientRect();
    if (!wrap) return;
    const sx = e.clientX, sy = e.clientY;
    const r0 = rect;
    const MIN = 0.04;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / wrap.width;
      const dy = (ev.clientY - sy) / wrap.height;
      let { x, y, w, h: hh } = r0;
      if (h === 'move') {
        x = Math.min(1 - w, Math.max(0, x + dx));
        y = Math.min(1 - hh, Math.max(0, y + dy));
      } else {
        if (h.includes('w')) { const nx = Math.min(x + w - MIN, Math.max(0, x + dx)); w += x - nx; x = nx; }
        if (h.includes('e')) w = Math.min(1 - x, Math.max(MIN, w + dx));
        if (h.includes('n')) { const ny = Math.min(y + hh - MIN, Math.max(0, y + dy)); hh += y - ny; y = ny; }
        if (h.includes('s')) hh = Math.min(1 - y, Math.max(MIN, hh + dy));
        if (effRatio > 0) {
          const R = effRatio;
          if (h === 'n' || h === 's') {
            const nw = (hh * R) / imgAspect;
            x = x + (w - nw) / 2;
            w = nw;
          } else {
            const nh = (w * imgAspect) / R;
            if (h.includes('n')) y = y + hh - nh;
            else if (h === 'e' || h === 'w') y = y + (hh - nh) / 2;
            hh = nh;
          }
          if (x < 0 || y < 0 || x + w > 1.0001 || y + hh > 1.0001) return;
        }
      }
      setRect({ x, y, w, h: hh });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const apply = () => {
    const full = rect.w > 0.995 && rect.h > 0.995;
    const t = getState().doc.transform;
    updateDoc((d) => ({ ...d, crop: full ? null : rectOutToSrc(rect, t) }));
    setUi({ tool: 'none' });
  };

  const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const pos = (h: Handle): React.CSSProperties => {
    const s: React.CSSProperties = {};
    if (h.includes('n')) s.top = -6; else if (h.includes('s')) s.bottom = -6; else s.top = 'calc(50% - 6px)';
    if (h.includes('w')) s.left = -6; else if (h.includes('e')) s.right = -6; else s.left = 'calc(50% - 6px)';
    s.cursor = `${h}-resize`;
    return s;
  };

  return (
    <div className="crop-layer" ref={ref}>
      <div
        className="crop-box"
        style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
        onPointerDown={start('move')}
      >
        <div className="grid" />
        {handles.map((h) => <span key={h} className="crop-handle" style={pos(h)} onPointerDown={start(h)} />)}
      </div>
      {stage && createPortal(
        <div className="floating-bar" onPointerDown={(e) => e.stopPropagation()}>
          {ASPECTS.map((a) => (
            <button key={a.label} className={`chip wide ${ratio === a.v ? 'on' : ''}`} onClick={() => setRatio(a.v)}>{a.label}</button>
          ))}
          <span className="fb-sep" />
          <button className="icon-btn" title="Rotate left" onClick={() => { rotateCrop(-1); setRect({ x: 0, y: 0, w: 1, h: 1 }); }}><RotateCcw size={15} /></button>
          <button className="icon-btn" title="Rotate right" onClick={() => { rotateCrop(1); setRect({ x: 0, y: 0, w: 1, h: 1 }); }}><RotateCw size={15} /></button>
          <button className="icon-btn" title="Flip horizontal" onClick={() => updateDoc((d) => ({ ...d, transform: { ...d.transform, flipX: !d.transform.flipX } }))}><FlipHorizontal2 size={15} /></button>
          <button className="icon-btn" title="Flip vertical" onClick={() => updateDoc((d) => ({ ...d, transform: { ...d.transform, flipY: !d.transform.flipY } }))}><FlipVertical2 size={15} /></button>
          <span className="fb-sep" />
          <button className="chip wide" onClick={() => { setRect({ x: 0, y: 0, w: 1, h: 1 }); setRatio(0); }}>Reset</button>
          <button className="icon-btn" title="Cancel" onClick={() => setUi({ tool: 'none' })}><X size={15} /></button>
          <button className="btn-solid" style={{ height: 30 }} onClick={apply}><Check size={14} /> Apply</button>
        </div>,
        stage,
      )}
    </div>
  );
}
