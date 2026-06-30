import { useRef, useEffect, useCallback, useState } from 'react';
import type { ZoneMaskData } from '../lib/asciiConverter';

export type ZoneShapeType = 'rectangle' | 'circle' | 'triangle';

export interface ZoneShape {
  id: string;
  type: ZoneShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  width: number;
  height: number;
  enabled: boolean;
  shapes: ZoneShape[];
  onShapesChange: (shapes: ZoneShape[]) => void;
  onMaskChange: (mask: ZoneMaskData) => void;
}

type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

let _id = 0;
function uid() { return `z${++_id}_${Date.now()}`; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const HANDLE_CURSORS: Record<string, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

export function ZonePainter({ width, height, enabled, shapes, onShapesChange, onMaskChange }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  const dragRef = useRef<{ mode: DragMode; startNx: number; startNy: number; orig: ZoneShape } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rasterize mask from shapes at reduced resolution (max 512px on longest side)
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    const MAX_MASK_DIM = 512;
    const scale = Math.min(1, MAX_MASK_DIM / Math.max(width, height));
    const mw = Math.max(1, Math.round(width * scale));
    const mh = Math.max(1, Math.round(height * scale));
    const mask = new Uint8Array(mw * mh);
    for (const shape of shapes) rasterize(mask, mw, mh, shape);
    onMaskChange({ data: mask, width: mw, height: mh });
  }, [shapes, width, height, onMaskChange]);

  const getNorm = useCallback((e: React.PointerEvent | PointerEvent) => {
    const el = containerRef.current;
    if (!el) return { nx: 0, ny: 0 };
    const r = el.getBoundingClientRect();
    return { nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height };
  }, []);

  const startDrag = useCallback((e: React.PointerEvent, id: string, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
    const shape = shapes.find(s => s.id === id);
    if (!shape) return;
    const { nx, ny } = getNorm(e);
    dragRef.current = { mode, startNx: nx, startNy: ny, orig: { ...shape } };
  }, [shapes, getNorm]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !d.mode) return;
    const { nx, ny } = getNorm(e);
    const dx = nx - d.startNx;
    const dy = ny - d.startNy;
    const o = d.orig;

    const updated = shapes.map(s => {
      if (s.id !== o.id) return s;
      const next = { ...s };

      if (d.mode === 'move') {
        next.x = clamp(o.x + dx, 0, 1);
        next.y = clamp(o.y + dy, 0, 1);
      } else {
        // Edge/corner resize
        let l = o.x - o.w / 2;
        let r = o.x + o.w / 2;
        let t = o.y - o.h / 2;
        let b = o.y + o.h / 2;

        const m = d.mode!;
        if (m.includes('w')) l = clamp(l + dx, 0, r - 0.02);
        if (m.includes('e')) r = clamp(r + dx, l + 0.02, 1);
        if (m.includes('n')) t = clamp(t + dy, 0, b - 0.02);
        if (m.includes('s')) b = clamp(b + dy, t + 0.02, 1);

        next.x = (l + r) / 2;
        next.y = (t + b) / 2;
        next.w = r - l;
        next.h = b - t;
      }
      return next;
    });
    onShapesChange(updated);
  }, [shapes, getNorm, onShapesChange]);

  const handlePointerUp = useCallback(() => { dragRef.current = null; }, []);

  const addShape = useCallback((type: ZoneShapeType) => {
    const id = uid();
    onShapesChange([...shapes, { id, type, x: 0.5, y: 0.5, w: 0.35, h: 0.35 }]);
    setSelected(id);
  }, [shapes, onShapesChange]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    onShapesChange(shapes.filter(s => s.id !== selected));
    setSelected(null);
  }, [selected, shapes, onShapesChange]);

  if (!enabled) return null;

  const activeCursor = dragRef.current?.mode === 'move' ? 'grabbing'
    : dragRef.current?.mode ? HANDLE_CURSORS[dragRef.current.mode] || 'default'
    : hoveredHandle ? HANDLE_CURSORS[hoveredHandle] || 'default'
    : 'default';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ cursor: activeCursor }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerDown={(e) => { if (e.target === containerRef.current) setSelected(null); }}
    >
      {shapes.map(shape => (
        <ShapeOverlay
          key={shape.id}
          shape={shape}
          isSelected={shape.id === selected}
          onDragStart={(e, mode) => startDrag(e, shape.id, mode)}
          onHoverHandle={setHoveredHandle}
        />
      ))}

      {/* Toolbar */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-2xl z-30"
        style={{
          background: 'rgba(28,28,30,0.92)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)',
          border: '0.5px solid rgba(255,255,255,0.08)',
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        <ToolBtn onClick={() => addShape('rectangle')} title="Rectangle" active={false}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="3" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => addShape('circle')} title="Circle" active={false}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => addShape('triangle')} title="Triangle" active={false}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3L15.5 15H2.5L9 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </ToolBtn>

        {selected && (
          <>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <ToolBtn onClick={deleteSelected} title="Delete" active={false} danger>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 5h10M7 5V4a1 1 0 011-1h2a1 1 0 011 1v1m2 0v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 014 14V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </ToolBtn>
          </>
        )}

        {shapes.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
            <ToolBtn onClick={() => { onShapesChange([]); setSelected(null); }} title="Clear all" active={false}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </ToolBtn>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Shape Overlay ---------- */

function ShapeOverlay({ shape, isSelected, onDragStart, onHoverHandle }: {
  shape: ZoneShape;
  isSelected: boolean;
  onDragStart: (e: React.PointerEvent, mode: DragMode) => void;
  onHoverHandle: (h: string | null) => void;
}) {
  const left = (shape.x - shape.w / 2) * 100;
  const top = (shape.y - shape.h / 2) * 100;
  const w = shape.w * 100;
  const h = shape.h * 100;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}%`, top: `${top}%`,
        width: `${w}%`, height: `${h}%`,
        cursor: 'grab',
      }}
      onPointerDown={(e) => onDragStart(e, 'move')}
    >
      {/* Shape border */}
      {shape.type === 'circle' ? (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: isSelected ? '1.5px solid rgba(59,130,246,0.8)' : '1.5px solid rgba(255,255,255,0.4)',
          background: isSelected ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
          transition: 'border-color 0.15s, background 0.15s',
          pointerEvents: 'none',
        }} />
      ) : shape.type === 'triangle' ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <polygon
            points="50,2 98,98 2,98"
            fill={isSelected ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)'}
            stroke={isSelected ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.4)'}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: 6,
          border: isSelected ? '1.5px solid rgba(59,130,246,0.8)' : '1.5px solid rgba(255,255,255,0.4)',
          background: isSelected ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
          transition: 'border-color 0.15s, background 0.15s',
          pointerEvents: 'none',
        }} />
      )}

      {/* Resize handles */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <ResizeHandle pos="nw" onDragStart={onDragStart} onHover={onHoverHandle} />
          <ResizeHandle pos="ne" onDragStart={onDragStart} onHover={onHoverHandle} />
          <ResizeHandle pos="sw" onDragStart={onDragStart} onHover={onHoverHandle} />
          <ResizeHandle pos="se" onDragStart={onDragStart} onHover={onHoverHandle} />
          {/* Edge handles */}
          <ResizeHandle pos="n" onDragStart={onDragStart} onHover={onHoverHandle} />
          <ResizeHandle pos="s" onDragStart={onDragStart} onHover={onHoverHandle} />
          <ResizeHandle pos="e" onDragStart={onDragStart} onHover={onHoverHandle} />
          <ResizeHandle pos="w" onDragStart={onDragStart} onHover={onHoverHandle} />
        </>
      )}
    </div>
  );
}

/* ---------- Resize Handle ---------- */

function ResizeHandle({ pos, onDragStart, onHover }: {
  pos: string;
  onDragStart: (e: React.PointerEvent, mode: DragMode) => void;
  onHover: (h: string | null) => void;
}) {
  const isCorner = pos.length === 2;
  const size = isCorner ? 10 : 8;
  const offset = -(size / 2);

  const style: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: isCorner ? 3 : '50%',
    background: '#fff',
    boxShadow: '0 0 0 1px rgba(59,130,246,0.6), 0 2px 4px rgba(0,0,0,0.3)',
    zIndex: 25,
    cursor: HANDLE_CURSORS[pos],
  };

  // Position
  if (pos.includes('n')) style.top = offset;
  else if (pos.includes('s')) style.bottom = offset;
  else { style.top = '50%'; style.marginTop = offset; }

  if (pos.includes('w')) style.left = offset;
  else if (pos.includes('e')) style.right = offset;
  else { style.left = '50%'; style.marginLeft = offset; }

  return (
    <div
      style={style}
      onPointerDown={(e) => { e.stopPropagation(); onDragStart(e, pos as DragMode); }}
      onPointerEnter={() => onHover(pos)}
      onPointerLeave={() => onHover(null)}
    />
  );
}

/* ---------- Toolbar Button ---------- */

function ToolBtn({ children, onClick, title, active, danger }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center transition-all duration-150"
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        color: danger ? 'rgba(255,69,58,0.9)' : active ? '#fff' : 'rgba(255,255,255,0.7)',
        background: active ? 'rgba(59,130,246,0.5)' : 'transparent',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget.style.background = 'rgba(255,255,255,0.08)'); }}
      onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent'); }}
    >
      {children}
    </button>
  );
}

/* ---------- Rasterizer ---------- */

function rasterize(mask: Uint8Array, mw: number, mh: number, shape: ZoneShape) {
  const left = Math.max(0, Math.floor((shape.x - shape.w / 2) * mw));
  const right = Math.min(mw - 1, Math.ceil((shape.x + shape.w / 2) * mw));
  const top = Math.max(0, Math.floor((shape.y - shape.h / 2) * mh));
  const bottom = Math.min(mh - 1, Math.ceil((shape.y + shape.h / 2) * mh));
  const cx = shape.x * mw;
  const cy = shape.y * mh;
  const rx = (shape.w / 2) * mw;
  const ry = (shape.h / 2) * mh;

  for (let py = top; py <= bottom; py++) {
    for (let px = left; px <= right; px++) {
      let inside = false;
      if (shape.type === 'rectangle') {
        inside = true;
      } else if (shape.type === 'circle') {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        inside = (dx * dx + dy * dy) <= 1;
      } else if (shape.type === 'triangle') {
        const nx = (px - left) / ((right - left) || 1);
        const ny = (py - top) / ((bottom - top) || 1);
        inside = ny >= 0 && nx >= (0.5 - ny * 0.5) && nx <= (0.5 + ny * 0.5);
      }
      if (inside) mask[py * mw + px] = 255;
    }
  }
}
