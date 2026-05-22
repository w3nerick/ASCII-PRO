import { useRef, useState, useCallback } from 'react';

interface Props {
  sourceEl: HTMLImageElement | HTMLVideoElement | null;
  canvasEl: HTMLCanvasElement | null;
}

export function CompareSlider({ sourceEl, canvasEl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(x);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updatePosition(e.clientX);
  };

  const onPointerUp = () => { dragging.current = false; };

  if (!sourceEl || !canvasEl) return null;

  const srcUrl = sourceEl instanceof HTMLImageElement ? sourceEl.src : '';
  if (!srcUrl) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 cursor-col-resize select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={srcUrl}
          alt=""
          className="w-full h-full object-contain"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          draggable={false}
        />
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 2L1 7L4 12M10 2L13 7L10 12" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-white text-xs font-medium">
        Original
      </div>
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 text-white text-xs font-medium">
        ASCII
      </div>
    </div>
  );
}
