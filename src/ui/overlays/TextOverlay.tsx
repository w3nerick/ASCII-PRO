import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignCenter, AlignLeft, AlignRight, Bold, Plus, Trash2, Check } from 'lucide-react';
import type { TextItem } from '../../engine/types';
import { getState, setUi, updateDoc, useStore } from '../../state/store';
import { TEXT_FONTS, newText } from '../../state/textLayer';
import { SelectBox } from '../controls';

export function addText() {
  const t = newText();
  updateDoc((d) => ({ ...d, texts: [...d.texts, t] }));
  setUi({ tool: 'text', selectedText: t.id });
}

function patchText(id: string, patch: Partial<TextItem>, key = '') {
  updateDoc((d) => ({ ...d, texts: d.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }), key ? `text:${id}:${key}` : '');
}

export function TextOverlay({ active }: { active: boolean }) {
  const texts = useStore((s) => s.doc.texts);
  const sel = useStore((s) => s.ui.selectedText);
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(400);
  const stage = document.querySelector('.stage');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const drag = (t: TextItem, mode: 'move' | 'size') => (e: React.PointerEvent) => {
    if (!active) return;
    e.stopPropagation();
    e.preventDefault();
    setUi({ selectedText: t.id });
    const r = ref.current!.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const t0 = { ...t };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height;
      if (mode === 'move') patchText(t.id, { x: Math.min(1, Math.max(0, t0.x + dx)), y: Math.min(1, Math.max(0, t0.y + dy)) }, 'pos');
      else patchText(t.id, { size: Math.max(0.01, Math.min(0.8, t0.size * (1 + (dy * 2 + dx)))) }, 'size');
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const cur = texts.find((t) => t.id === sel) || null;

  return (
    <>
      <div className="text-layer" ref={ref} style={{ pointerEvents: active ? 'auto' : 'none' }} onPointerDown={() => active && setUi({ selectedText: null })}>
        {active && texts.map((t) => (
          <div
            key={t.id}
            className={`text-item ghost ${sel === t.id ? 'sel' : ''}`}
            style={{
              left: `${t.x * 100}%`,
              top: `${t.y * 100}%`,
              fontFamily: (TEXT_FONTS[t.font] || TEXT_FONTS[0]).css,
              fontWeight: t.weight,
              fontSize: Math.max(4, t.size * h),
              textAlign: t.align,
              transform: `translate(${t.align === 'center' ? -50 : t.align === 'right' ? -100 : 0}%, -50%)`,
              letterSpacing: `${t.letterSpacing * 0.01}em`,
            }}
            onPointerDown={drag(t, 'move')}
            onDoubleClick={() => document.getElementById('text-edit')?.focus()}
          >
            {t.text || ' '}
            {sel === t.id && <span className="resize" onPointerDown={drag(t, 'size')} />}
          </div>
        ))}
      </div>
      {active && stage && createPortal(
        <div className="floating-bar" onPointerDown={(e) => e.stopPropagation()}>
          <button className="btn-ghost" onClick={addText}><Plus size={14} /> Text</button>
          {cur && (
            <>
              <span className="fb-sep" />
              <input
                id="text-edit"
                className="text-input"
                style={{ width: 170, height: 30 }}
                value={cur.text}
                onChange={(e) => patchText(cur.id, { text: e.target.value }, 'text')}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Type…"
              />
              <SelectBox value={cur.font} options={TEXT_FONTS.map((f, i) => ({ label: f.label, value: i }))} onChange={(v) => patchText(cur.id, { font: v })} />
              <span className="color-input">
                <span className="sw" style={{ background: cur.color, width: 30 }}>
                  <input type="color" value={cur.color} onChange={(e) => patchText(cur.id, { color: e.target.value }, 'color')} aria-label="Text color" />
                </span>
              </span>
              <button className={`icon-btn ${cur.weight >= 700 ? 'on' : ''}`} title="Bold" onClick={() => patchText(cur.id, { weight: cur.weight >= 700 ? 400 : 800 })} style={{ color: cur.weight >= 700 ? '#fff' : undefined }}><Bold size={15} /></button>
              <button className="icon-btn" title="Align left" onClick={() => patchText(cur.id, { align: 'left' })}><AlignLeft size={15} /></button>
              <button className="icon-btn" title="Align center" onClick={() => patchText(cur.id, { align: 'center' })}><AlignCenter size={15} /></button>
              <button className="icon-btn" title="Align right" onClick={() => patchText(cur.id, { align: 'right' })}><AlignRight size={15} /></button>
              <input
                type="range"
                className="range"
                style={{ width: 80, ['--p' as string]: `${cur.opacity}%` }}
                min={0}
                max={100}
                value={cur.opacity}
                title="Opacity"
                onChange={(e) => patchText(cur.id, { opacity: Number(e.target.value) }, 'opacity')}
              />
              <button className="icon-btn" title="Delete text" onClick={() => {
                updateDoc((d) => ({ ...d, texts: d.texts.filter((t) => t.id !== cur.id) }));
                setUi({ selectedText: null });
              }}><Trash2 size={15} /></button>
            </>
          )}
          <span className="fb-sep" />
          <button className="btn-solid" style={{ height: 30 }} onClick={() => setUi({ tool: 'none', selectedText: null })}><Check size={14} /> Done</button>
        </div>,
        stage,
      )}
    </>
  );
}

export function hasTexts() {
  return getState().doc.texts.length > 0;
}
