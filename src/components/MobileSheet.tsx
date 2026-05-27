import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function MobileSheet({ open, onClose, title, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const velocity = useRef(0);
  const lastTime = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    if (open) {
      setTranslateY(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, select, button, .slider, [data-light-pad]')) return;
    setDragging(true);
    startY.current = e.touches[0].clientY;
    lastY.current = e.touches[0].clientY;
    lastTime.current = Date.now();
    currentY.current = 0;
    velocity.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const y = e.touches[0].clientY;
    const delta = y - startY.current;
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (y - lastY.current) / dt;
    lastY.current = y;
    lastTime.current = now;
    if (delta > 0) {
      currentY.current = delta;
      setTranslateY(delta);
    }
  }, [dragging]);

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    const shouldClose = currentY.current > 100 || velocity.current > 0.5;
    if (shouldClose) {
      setTranslateY(window.innerHeight);
      setTimeout(onClose, 280);
    } else {
      setTranslateY(0);
    }
    currentY.current = 0;
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeIn 250ms var(--ease-out) both',
        }}
      />

      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 flex flex-col"
        style={{
          maxHeight: '88vh',
          background: 'var(--bg-grouped)',
          borderRadius: '14px 14px 0 0',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.4)',
          transform: `translateY(${translateY}px)`,
          transition: dragging ? 'none' : 'transform 340ms var(--ease-sheet)',
          animation: dragging ? 'none' : 'sheetSlideUp 380ms var(--ease-sheet) both',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Grab pill */}
        <div className="flex justify-center pt-2.5 pb-2">
          <div className="sheet-pill" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="title-3">{title || 'Controls'}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <X className="w-3.5 h-3.5 text-label-secondary" strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
