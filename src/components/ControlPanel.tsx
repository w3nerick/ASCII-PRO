import { useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { CHARSET_KEYS, charsetLabel, type CharsetKey } from '../lib/charsets';
import type { AsciiOptions } from '../lib/asciiConverter';

interface Props {
  options: AsciiOptions;
  onChange: (next: AsciiOptions) => void;
  onReset: () => void;
}

export function ControlPanel({ options, onChange, onReset }: Props) {
  const set = <K extends keyof AsciiOptions>(key: K, val: AsciiOptions[K]) =>
    onChange({ ...options, [key]: val });

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-separator sticky top-0 bg-bg-elevated z-10">
        <span className="caption">Controls</span>
        <button type="button" onClick={onReset} className="btn btn-ghost btn-sm btn-icon" title="Reset to defaults">
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* ── MODE ── */}
      <Group label="Mode">
        <Row label="Mode">
          <select
            value={options.bgMode}
            onChange={e => set('bgMode', e.target.value as AsciiOptions['bgMode'])}
            className="input text-sm h-8 px-2 rounded-lg bg-surface-2 border-separator text-label cursor-pointer"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--separator)', color: 'var(--label)', borderRadius: 8, fontSize: 12, padding: '0 8px', height: 28, cursor: 'pointer' }}
          >
            <option value="original">Original Image</option>
            <option value="blurred">Blurred Image</option>
            <option value="solid">Solid Color</option>
            <option value="transparent">Transparent</option>
          </select>
        </Row>
        <Row label="Opacity">
          <SliderRow value={options.bgOpacity} min={0} max={100} step={1}
            onChange={v => set('bgOpacity', v)} unit="%" />
        </Row>
        {options.bgMode === 'blurred' && (
          <Row label="Blur">
            <SliderRow value={options.bgBlur} min={0} max={40} step={1}
              onChange={v => set('bgBlur', v)} unit="px" />
          </Row>
        )}
        {options.bgMode === 'solid' && (
          <Row label="Color">
            <div className="flex items-center gap-2">
              <span className="footnote text-label-tertiary font-mono">{options.bgColor}</span>
              <label className="color-swatch" style={{ background: options.bgColor }}>
                <input type="color" value={options.bgColor} onChange={e => set('bgColor', e.target.value)} />
              </label>
            </div>
          </Row>
        )}
      </Group>

      {/* ── CHARACTERS ── */}
      <Group label="Characters">
        <Row label="Font Size">
          <SliderRow value={options.fontSize} min={4} max={28} step={1}
            onChange={v => set('fontSize', v)} unit="px" />
        </Row>
        <Row label="Character Set">
          <select
            value={options.charset}
            onChange={e => set('charset', e.target.value as CharsetKey)}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--separator)', color: 'var(--label)', borderRadius: 8, fontSize: 12, padding: '0 8px', height: 28, cursor: 'pointer', maxWidth: 130 }}
          >
            {CHARSET_KEYS.map(k => <option key={k} value={k}>{charsetLabel(k)}</option>)}
          </select>
        </Row>
        {options.charset === 'custom' && (
          <Row label="Chars">
            <input type="text" className="input" value={options.customRamp}
              onChange={e => set('customRamp', e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Row>
        )}
        <Row label="Char Opacity">
          <SliderRow value={options.charOpacity} min={10} max={100} step={1}
            onChange={v => set('charOpacity', v)} unit="%" />
        </Row>
        <Row label="Invert Mapping">
          <Switch value={options.invert} onChange={v => set('invert', v)} />
        </Row>
        <Row label="Randomize">
          <Switch value={options.animatedAscii} onChange={v => set('animatedAscii', v)} />
        </Row>
        {options.animatedAscii && (
          <Row label="Speed">
            <SliderRow value={options.animSpeed} min={1} max={30} step={1}
              onChange={v => set('animSpeed', v)} unit="fps" />
          </Row>
        )}
      </Group>

      {/* ── INTENSITY ── */}
      <Group label="Intensity">
        <Row label="Coverage">
          <SliderRow value={options.coverage} min={0} max={100} step={1}
            onChange={v => set('coverage', v)} unit="%" />
        </Row>
        <Row label="Edge Emphasis">
          <Switch value={options.edges} onChange={v => set('edges', v)} />
        </Row>
        {options.edges && (
          <Row label="Edge Threshold">
            <SliderRow value={options.edgeThreshold} min={0} max={255} step={1}
              onChange={v => set('edgeThreshold', v)} />
          </Row>
        )}
        <Row label="Density">
          <SliderRow value={options.density} min={0.5} max={2} step={0.05}
            onChange={v => set('density', v)} unit="×" format={v => v.toFixed(2)} />
        </Row>
        <Row label="Brightness">
          <SliderRow value={options.brightness} min={-100} max={100} step={1}
            onChange={v => set('brightness', v)} />
        </Row>
        <Row label="Contrast">
          <SliderRow value={options.contrast} min={-100} max={100} step={1}
            onChange={v => set('contrast', v)} />
        </Row>
        <Row label="Saturation">
          <SliderRow value={options.saturation} min={-100} max={100} step={1}
            onChange={v => set('saturation', v)} />
        </Row>
        <Row label="Color Enhance">
          <SliderRow value={options.colorEnhance} min={0} max={100} step={1}
            onChange={v => set('colorEnhance', v)} unit="%" />
        </Row>
      </Group>

      {/* ── OUTPUT ── */}
      <Group label="Output">
        <Row label="Color">
          <Switch value={options.color} onChange={v => set('color', v)} />
        </Row>
        {!options.color && (
          <Row label="Foreground">
            <div className="flex items-center gap-2">
              <span className="footnote text-label-tertiary font-mono">{options.fgColor}</span>
              <label className="color-swatch" style={{ background: options.fgColor }}>
                <input type="color" value={options.fgColor} onChange={e => set('fgColor', e.target.value)} />
              </label>
            </div>
          </Row>
        )}
        <Row label="Dithering">
          <Switch value={options.dithering} onChange={v => set('dithering', v)} />
        </Row>
      </Group>

      {/* ── POST-PROCESSING ── */}
      <Group label="Post-Processing" defaultOpen={false}>
        <FxRow label="Bloom" value={options.fx_bloom} onChange={v => set('fx_bloom', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_bloom_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_bloom_intensity', v)} unit="%" />
          </Row>
        </FxRow>
        <FxRow label="Vignette" value={options.fx_vignette} onChange={v => set('fx_vignette', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_vignette_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_vignette_intensity', v)} unit="%" />
          </Row>
        </FxRow>
        <FxRow label="Scan Lines" value={options.fx_scanlines} onChange={v => set('fx_scanlines', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_scanlines_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_scanlines_intensity', v)} unit="%" />
          </Row>
        </FxRow>
        <FxRow label="Chromatic" value={options.fx_chromatic} onChange={v => set('fx_chromatic', v)}>
          <Row label="Shift">
            <SliderRow value={options.fx_chromatic_px} min={1} max={20} step={1}
              onChange={v => set('fx_chromatic_px', v)} unit="px" />
          </Row>
        </FxRow>
        <FxRow label="Film Grain" value={options.fx_grain} onChange={v => set('fx_grain', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_grain_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_grain_intensity', v)} unit="%" />
          </Row>
        </FxRow>
        <FxRow label="Glitch" value={options.fx_glitch} onChange={v => set('fx_glitch', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_glitch_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_glitch_intensity', v)} unit="%" />
          </Row>
        </FxRow>
      </Group>

      {/* bottom padding */}
      <div className="h-6 shrink-0" />
    </div>
  );
}

/* ── Design system sub-components ─────────────────────── */

function Group({ label, children, defaultOpen = true }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-separator">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-1 transition-colors"
      >
        <span className="caption">{label}</span>
        <ChevronDown
          className="w-3.5 h-3.5 text-label-tertiary transition-transform"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          strokeWidth={2.5}
        />
      </button>
      {open && (
        <div className="rounded-xl mx-3 mb-3 overflow-hidden border border-separator"
          style={{ background: 'var(--surface-1)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="list-row">
      <span className="callout text-label-secondary shrink-0" style={{ minWidth: 104 }}>{label}</span>
      <div className="flex items-center justify-end flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SliderRow({ value, min, max, step, onChange, unit = '', format }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string; format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <div className="flex items-center gap-2 w-full">
      <input type="range" className="slider flex-1"
        value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))} />
      <span className="footnote text-label-tertiary tabular-nums text-right"
        style={{ minWidth: 36 }}>{display}{unit}</span>
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      data-on={value}
      onClick={() => onChange(!value)}
      className="switch"
    />
  );
}

function FxRow({ label, value, onChange, children }: {
  label: string; value: boolean; onChange: (v: boolean) => void; children: ReactNode;
}) {
  return (
    <div>
      <div className="list-row">
        <span className="callout text-label-secondary">{label}</span>
        <Switch value={value} onChange={onChange} />
      </div>
      {value && <div className="border-t border-separator bg-surface-2/30">{children}</div>}
    </div>
  );
}
