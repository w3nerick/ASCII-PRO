import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ParamDef, ParamValue } from '../engine/types';
import { GRADIENTS, PALETTES, THERMAL } from '../engine/palettes';

export function Section({ title, children, onReset, sub }: { title?: string; children?: ReactNode; onReset?: () => void; sub?: string }) {
  return (
    <div className="section">
      {title && (
        <div className="section-title">
          <span>/ {title}</span>
          {onReset && (
            <button className="reset" onClick={onReset}>
              Reset
            </button>
          )}
        </div>
      )}
      {sub && <div className="section-sub">{sub}</div>}
      {children}
    </div>
  );
}

function fmt(v: number, step?: number) {
  if (step && step < 1) return v.toFixed(step < 0.1 ? 2 : 1);
  return String(Math.round(v));
}

export function Slider({
  label, value, min, max, step = 1, unit = '', onChange,
}: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const p = ((value - min) / (max - min)) * 100;
  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setEditing(false);
  };
  return (
    <div className="ctl">
      <div className="ctl-row" style={{ minHeight: 18 }}>
        <span className="ctl-label">{label}</span>
        {editing ? (
          <span className="ctl-val">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
                e.stopPropagation();
              }}
            />
          </span>
        ) : (
          <span
            className="ctl-val"
            title="Click to type a value"
            onClick={() => {
              setDraft(fmt(value, step));
              setEditing(true);
            }}
          >
            {fmt(value, step)}
            {unit}
          </span>
        )}
      </div>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--p' as string]: `${Math.max(0, Math.min(100, p))}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={label}
      />
    </div>
  );
}

export function SelectBox<T extends string | number>({
  value, options, onChange, ariaLabel, className = '',
}: { value: T; options: { label: string; value: T }[]; onChange: (v: T) => void; ariaLabel?: string; className?: string }) {
  return (
    <div className={`select ${className}`}>
      <select
        aria-label={ariaLabel}
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </div>
  );
}

export function SelectRow<T extends string | number>(props: { label: string; value: T; options: { label: string; value: T }[]; onChange: (v: T) => void }) {
  return (
    <div className="ctl">
      <div className="ctl-row">
        <span className="ctl-label">{props.label}</span>
        <SelectBox value={props.value} options={props.options} onChange={props.onChange} ariaLabel={props.label} />
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="ctl">
      <div className="ctl-row">
        <span className="ctl-label" onClick={() => onChange(!value)} style={{ cursor: 'pointer' }}>
          {label}
        </span>
        <Toggle on={value} onChange={onChange} label={label} />
      </div>
    </div>
  );
}

export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  return (
    <div className="ctl">
      <div className="ctl-row">
        <span className="ctl-label">{label}</span>
        <span className="color-input">
          <input
            className="hex"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={() => /^#[0-9a-f]{6}$/i.test(hex) ? onChange(hex.toLowerCase()) : setHex(value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <span className="sw" style={{ background: value }}>
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
          </span>
        </span>
      </div>
    </div>
  );
}

export function TextRow({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const [v, setV] = useState(value);
  const t = useRef<number>(0);
  useEffect(() => setV(value), [value]);
  const update = (s: string) => {
    setV(s);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => onChange(s), 180);
  };
  if (multiline) {
    return (
      <div className="ctl">
        <div className="ctl-label" style={{ marginBottom: 6 }}>{label}</div>
        <textarea className="text-input" value={v} onChange={(e) => update(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </div>
    );
  }
  return (
    <div className="ctl">
      <div className="ctl-row">
        <span className="ctl-label">{label}</span>
        <input className="text-input" value={v} spellCheck={false} onChange={(e) => update(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

export function GradientPreview({ stops }: { stops: string[] }) {
  return <div className="grad-preview" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />;
}

/** Visibility rule for params with showIf. */
export function paramVisible(def: ParamDef, params: Record<string, ParamValue>) {
  if (!def.showIf) return true;
  return Object.entries(def.showIf).every(([k, allowed]) => allowed.includes(params[k] as never));
}

export function ParamControl({ def, value, params, onChange }: { def: ParamDef; value: ParamValue; params: Record<string, ParamValue>; onChange: (v: ParamValue) => void }) {
  switch (def.type) {
    case 'range':
      return <Slider label={def.label} value={Number(value)} min={def.min} max={def.max} step={def.step} unit={def.unit} onChange={onChange} />;
    case 'select': {
      const extra =
        def.key === 'palette' && typeof value === 'number' && PALETTES[value]?.colors.length ? (
          <div className="swatches">{PALETTES[value].colors.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
        ) : def.key === 'gradient' && typeof value === 'number' && GRADIENTS[value] ? (
          <GradientPreview stops={GRADIENTS[value].stops} />
        ) : def.key === 'thermal' && typeof value === 'number' && THERMAL[value] ? (
          <GradientPreview stops={THERMAL[value].stops} />
        ) : null;
      return (
        <div className="ctl">
          <div className="ctl-row">
            <span className="ctl-label">{def.label}</span>
            <SelectBox value={Number(value)} options={def.options} onChange={onChange} ariaLabel={def.label} />
          </div>
          {extra}
        </div>
      );
    }
    case 'toggle':
      return <ToggleRow label={def.label} value={!!value} onChange={onChange} />;
    case 'color':
      return <ColorRow label={def.label} value={String(value)} onChange={onChange} />;
    case 'text':
      return <TextRow label={def.label} value={String(value)} onChange={onChange} />;
  }
  void params;
  return null;
}

/** Renders params grouped by `section` (params without section go in the first group). */
export function ParamGroups({
  defs, params, onChange, defaultTitle, skip,
}: { defs: ParamDef[]; params: Record<string, ParamValue>; onChange: (key: string, v: ParamValue) => void; defaultTitle?: string; skip?: (d: ParamDef) => boolean }) {
  const groups: { title?: string; defs: ParamDef[] }[] = [];
  for (const d of defs) {
    if (skip?.(d)) continue;
    const title = d.section || defaultTitle;
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, defs: [] }));
    g.defs.push(d);
  }
  return (
    <>
      {groups.map((g) => {
        const visible = g.defs.filter((d) => paramVisible(d, params));
        if (!visible.length) return null;
        return (
          <Section key={g.title || '_'} title={g.title}>
            {visible.map((d) => (
              <ParamControl key={d.key} def={d} value={params[d.key] ?? d.default} params={params} onChange={(v) => onChange(d.key, v)} />
            ))}
          </Section>
        );
      })}
    </>
  );
}

/** Hook: thumbnail URL for a key, requested lazily when visible. */
export function useInView<T extends Element>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen] as const;
}
