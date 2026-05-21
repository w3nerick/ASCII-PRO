import { useState, type ReactNode } from 'react';
import { RotateCcw, ChevronDown } from 'lucide-react';
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
    <div className="flex flex-col h-full overflow-y-auto bg-[#1a1a1a] text-[#e0e0e0] select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-white/50">Controls</span>
        <button type="button" onClick={onReset}
          className="text-[10px] text-white/40 hover:text-white/80 flex items-center gap-1 transition-colors">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* ── MODE ── */}
      <Section title="Mode">
        <Row label="Mode">
          <Select value={options.bgMode} onChange={v => set('bgMode', v as AsciiOptions['bgMode'])}>
            <option value="original">Original Image</option>
            <option value="blurred">Blurred Image</option>
            <option value="solid">Solid Color</option>
            <option value="transparent">Transparent</option>
          </Select>
        </Row>
        <Row label="Opacity">
          <Slider value={options.bgOpacity} min={0} max={100} step={1}
            onChange={v => set('bgOpacity', v)} unit="%" />
        </Row>
        {options.bgMode === 'blurred' && (
          <Row label="Blur">
            <Slider value={options.bgBlur} min={0} max={40} step={1}
              onChange={v => set('bgBlur', v)} unit="px" />
          </Row>
        )}
        {options.bgMode === 'solid' && (
          <Row label="Color">
            <ColorPick value={options.bgColor} onChange={v => set('bgColor', v)} />
          </Row>
        )}
      </Section>

      {/* ── CHARACTERS ── */}
      <Section title="Characters">
        <Row label="Font Size">
          <Slider value={options.fontSize} min={4} max={28} step={1}
            onChange={v => set('fontSize', v)} unit="" />
        </Row>
        <Row label="Character Set">
          <Select value={options.charset} onChange={v => set('charset', v as CharsetKey)}>
            {CHARSET_KEYS.map(k => (
              <option key={k} value={k}>{charsetLabel(k)}</option>
            ))}
          </Select>
        </Row>
        {options.charset === 'custom' && (
          <Row label="Chars">
            <input type="text" value={options.customRamp}
              onChange={e => set('customRamp', e.target.value)}
              className="bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-xs font-mono text-white/80 w-full focus:outline-none focus:border-white/30" />
          </Row>
        )}
        <Row label="Char Opacity">
          <Slider value={options.charOpacity} min={10} max={100} step={1}
            onChange={v => set('charOpacity', v)} unit="%" />
        </Row>
        <Row label="Invert Mapping">
          <Toggle value={options.invert} onChange={v => set('invert', v)} />
        </Row>
        <Row label="Randomize">
          <Toggle value={options.animatedAscii} onChange={v => set('animatedAscii', v)} />
        </Row>
        {options.animatedAscii && (
          <Row label="Anim Speed">
            <Slider value={options.animSpeed} min={1} max={30} step={1}
              onChange={v => set('animSpeed', v)} unit="fps" />
          </Row>
        )}
      </Section>

      {/* ── INTENSITY ── */}
      <Section title="Intensity">
        <Row label="Coverage">
          <Slider value={options.coverage} min={0} max={100} step={1}
            onChange={v => set('coverage', v)} unit="%" />
        </Row>
        <Row label="Edge Emphasis">
          <Toggle value={options.edges} onChange={v => set('edges', v)} />
        </Row>
        {options.edges && (
          <Row label="Edge Threshold">
            <Slider value={options.edgeThreshold} min={0} max={255} step={1}
              onChange={v => set('edgeThreshold', v)} />
          </Row>
        )}
        <Row label="Density">
          <Slider value={options.density} min={0.5} max={2} step={0.05}
            onChange={v => set('density', v)} unit="×" format={v => v.toFixed(2)} />
        </Row>
        <Row label="Brightness">
          <Slider value={options.brightness} min={-100} max={100} step={1}
            onChange={v => set('brightness', v)} />
        </Row>
        <Row label="Contrast">
          <Slider value={options.contrast} min={-100} max={100} step={1}
            onChange={v => set('contrast', v)} />
        </Row>
        <Row label="Saturation">
          <Slider value={options.saturation} min={-100} max={100} step={1}
            onChange={v => set('saturation', v)} />
        </Row>
      </Section>

      {/* ── POST-PROCESSING ── */}
      <Section title="Post-Processing" defaultOpen={false}>
        <FxToggleRow label="Color Overlay" value={options.fx_bloom} onChange={v => set('fx_bloom', v)}>
          {options.fx_bloom && <Row label="Intensity">
            <Slider value={options.fx_bloom_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_bloom_intensity', v)} unit="%" />
          </Row>}
        </FxToggleRow>
        <FxToggleRow label="Vignette" value={options.fx_vignette} onChange={v => set('fx_vignette', v)}>
          {options.fx_vignette && <Row label="Intensity">
            <Slider value={options.fx_vignette_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_vignette_intensity', v)} unit="%" />
          </Row>}
        </FxToggleRow>
        <FxToggleRow label="Scan Lines" value={options.fx_scanlines} onChange={v => set('fx_scanlines', v)}>
          {options.fx_scanlines && <Row label="Intensity">
            <Slider value={options.fx_scanlines_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_scanlines_intensity', v)} unit="%" />
          </Row>}
        </FxToggleRow>
        <FxToggleRow label="Chromatic Aberration" value={options.fx_chromatic} onChange={v => set('fx_chromatic', v)}>
          {options.fx_chromatic && <Row label="Shift">
            <Slider value={options.fx_chromatic_px} min={1} max={20} step={1}
              onChange={v => set('fx_chromatic_px', v)} unit="px" />
          </Row>}
        </FxToggleRow>
        <FxToggleRow label="Film Grain" value={options.fx_grain} onChange={v => set('fx_grain', v)}>
          {options.fx_grain && <Row label="Intensity">
            <Slider value={options.fx_grain_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_grain_intensity', v)} unit="%" />
          </Row>}
        </FxToggleRow>
        <FxToggleRow label="Glitch" value={options.fx_glitch} onChange={v => set('fx_glitch', v)}>
          {options.fx_glitch && <Row label="Intensity">
            <Slider value={options.fx_glitch_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_glitch_intensity', v)} unit="%" />
          </Row>}
        </FxToggleRow>
      </Section>

      {/* ── OUTPUT ── */}
      <Section title="Output" defaultOpen={false}>
        <Row label="Color Mode">
          <Toggle value={options.color} onChange={v => set('color', v)} label={options.color ? 'Color' : 'Mono'} />
        </Row>
        <Row label="Foreground">
          <ColorPick value={options.fgColor} onChange={v => set('fgColor', v)}
            disabled={options.color} hint="Mono only" />
        </Row>
        <Row label="Dithering">
          <Toggle value={options.dithering} onChange={v => set('dithering', v)} />
        </Row>
      </Section>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/8">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase text-white/40 hover:text-white/60 transition-colors">
        {title}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 gap-3">
      <span className="text-[12px] text-white/70 shrink-0 w-[110px]">{label}</span>
      <div className="flex-1 flex items-center justify-end">{children}</div>
    </div>
  );
}

function Slider({ value, min, max, step, onChange, unit = '', format }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string; format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <div className="flex items-center gap-2 w-full">
      <input type="range" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 appearance-none bg-white/20 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer" />
      <span className="text-[11px] text-white/50 tabular-nums w-10 text-right">{display}{unit}</span>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-white/80' : 'bg-white/20'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#1a1a1a] transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[12px] text-white/80
        focus:outline-none focus:border-white/30 cursor-pointer appearance-none pr-6">
      {children}
    </select>
  );
}

function ColorPick({ value, onChange, disabled, hint }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string;
}) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      {hint && disabled && <span className="text-[10px] text-white/30">{hint}</span>}
      <span className="text-[11px] font-mono text-white/50">{value}</span>
      <div className="w-5 h-5 rounded border border-white/20 overflow-hidden" style={{ background: value }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="opacity-0 w-full h-full cursor-pointer" />
      </div>
    </label>
  );
}

function FxToggleRow({ label, value, onChange, children }: {
  label: string; value: boolean; onChange: (v: boolean) => void; children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${value ? 'bg-white/70' : 'bg-white/15'}`} />
          <span className="text-[12px] text-white/70">{label}</span>
        </div>
        <Toggle value={value} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}
