import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X, GripHorizontal } from 'lucide-react';

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
    if (target.closest('input, select, button')) return;
    setDragging(true);
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      currentY.current = delta;
      setTranslateY(delta);
    }
  }, [dragging]);

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    if (currentY.current > 120) {
      onClose();
    }
    setTranslateY(0);
    currentY.current = 0;
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 200ms ease-out both' }}
      />

      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 flex flex-col"
        style={{
          maxHeight: '85vh',
          background: 'var(--bg-elevated)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--separator)',
          borderBottom: 'none',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          transform: `translateY(${translateY}px)`,
          transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.2, 0, 0, 1)',
          animation: dragging ? 'none' : 'sheetSlideUp 320ms cubic-bezier(0.2, 0, 0, 1) both',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <GripHorizontal className="w-8 h-1.5 text-label-quaternary" strokeWidth={3} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <span className="title-3">{title || 'Controls'}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
