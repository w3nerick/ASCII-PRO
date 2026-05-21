import React, { useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { CHARSETS, CHARSET_KEYS, charsetLabel, type CharsetKey } from '../lib/charsets';
import type { AsciiOptions } from '../lib/asciiConverter';

interface Props {
  options: AsciiOptions;
  onChange: (next: AsciiOptions) => void;
  onReset: () => void;
}

/**
 * Apple Settings-style control panel.
 * Grouped lists with subtle separators, clean typography, restrained color.
 */
export function ControlPanel({ options, onChange, onReset }: Props) {
  const set = <K extends keyof AsciiOptions>(key: K, value: AsciiOptions[K]) =>
    onChange({ ...options, [key]: value });

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="title-2 m-0">Adjust</h2>
          <p className="footnote text-label-tertiary mt-0.5">Fine-tune the conversion</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="btn btn-ghost btn-sm"
          title="Reset to defaults"
          aria-label="Reset"
        >
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
          Reset
        </button>
      </div>

      {/* ===== Geometry ===== */}
      <Group title="Geometry">
        <SliderRow
          label="Resolution"
          hint="Characters per row"
          value={options.width}
          min={32}
          max={300}
          step={1}
          unit=""
          onChange={(v) => set('width', v)}
        />
        <SliderRow
          label="Density"
          hint="Vertical character density"
          value={options.density}
          min={0.5}
          max={2}
          step={0.05}
          unit="×"
          format={(v) => v.toFixed(2)}
          onChange={(v) => set('density', v)}
        />
        <SliderRow
          label="Font Size"
          value={options.fontSize}
          min={4}
          max={24}
          step={1}
          unit="pt"
          onChange={(v) => set('fontSize', v)}
        />
      </Group>

      {/* ===== Image ===== */}
      <Group title="Image">
        <SliderRow
          label="Brightness"
          value={options.brightness}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => set('brightness', v)}
        />
        <SliderRow
          label="Contrast"
          value={options.contrast}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => set('contrast', v)}
        />
        <SliderRow
          label="Saturation"
          value={options.saturation}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => set('saturation', v)}
        />
        <SliderRow
          label="Color Enhance"
          hint="Boosts color vibrance"
          value={options.colorEnhance}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => set('colorEnhance', v)}
        />
        <SliderRow
          label="Blur"
          value={options.blur}
          min={0}
          max={10}
          step={0.5}
          unit="pt"
          format={(v) => v.toFixed(1)}
          onChange={(v) => set('blur', v)}
        />
      </Group>

      {/* ===== Effects ===== */}
      <Group title="Effects">
        <SwitchRow
          label="Edges"
          hint="Detect outlines (Sobel)"
          value={options.edges}
          onChange={(v) => set('edges', v)}
        />
        {options.edges && (
          <SliderRow
            label="Edge Threshold"
            value={options.edgeThreshold}
            min={0}
            max={255}
            step={1}
            onChange={(v) => set('edgeThreshold', v)}
          />
        )}
        <SwitchRow
          label="Dithering"
          hint="Floyd–Steinberg"
          value={options.dithering}
          onChange={(v) => set('dithering', v)}
        />
      </Group>

      {/* ===== Character set ===== */}
      <Group title="Character Set">
        <div className="px-3 pt-3 pb-2">
          <div className="grid grid-cols-3 gap-1.5">
            {CHARSET_KEYS.map((k) => {
              const active = options.charset === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-selected={active}
                  onClick={() => set('charset', k as CharsetKey)}
                  className={`h-9 px-2 rounded-md text-[12px] font-medium transition-all duration-150 border ${
                    active
                      ? 'bg-accent border-accent text-white shadow-sm'
                      : 'bg-transparent border-separator text-label-secondary hover:bg-surface-2 hover:text-label hover:border-separator-strong'
                  }`}
                >
                  {charsetLabel(k)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-3 pb-3 pt-1">
          {options.charset === 'custom' ? (
            <div className="space-y-1.5">
              <label className="caption block">Custom ramp (dark → light)</label>
              <input
                type="text"
                className="input font-mono"
                value={options.customRamp}
                onChange={(e) => set('customRamp', e.target.value)}
                placeholder="@%#*+=-:. "
              />
              <span className="footnote text-label-tertiary">
                {options.customRamp.length} character{options.customRamp.length === 1 ? '' : 's'}
              </span>
            </div>
          ) : (
            <div className="font-mono text-[11px] text-label-tertiary break-all leading-relaxed px-1">
              {CHARSETS[options.charset].ramp}
            </div>
          )}
        </div>
      </Group>

      {/* ===== Output ===== */}
      <Group title="Output">
        <SwitchRow
          label="Color"
          hint="Per-character RGB"
          value={options.color}
          onChange={(v) => set('color', v)}
        />
        <SwitchRow
          label="Invert"
          value={options.invert}
          onChange={(v) => set('invert', v)}
        />
        <ColorRow
          label="Foreground"
          value={options.fgColor}
          onChange={(v) => set('fgColor', v)}
          disabled={options.color}
          disabledHint="Only used in mono mode"
        />
      </Group>

      {/* ===== Background ===== */}
      <Group title="Background" defaultOpen={false}>
        <div className="px-3 pt-3 pb-2">
          <div className="grid grid-cols-2 gap-1.5">
            {(['solid','blurred','original','transparent'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set('bgMode', m)}
                className={`h-8 px-2 rounded-md text-[11px] font-medium capitalize transition-all border ${
                  options.bgMode === m
                    ? 'bg-accent border-accent text-white'
                    : 'bg-transparent border-separator text-label-secondary hover:bg-surface-2'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {options.bgMode === 'blurred' && (
          <SliderRow label="Blur" value={options.bgBlur} min={0} max={40} step={1} unit="px"
            onChange={(v) => set('bgBlur', v)} />
        )}
        {options.bgMode !== 'transparent' && (
          <SliderRow label="Opacity" value={options.bgOpacity} min={0} max={100} step={1} unit="%"
            onChange={(v) => set('bgOpacity', v)} />
        )}
        {options.bgMode === 'solid' && (
          <ColorRow label="Color" value={options.bgColor} onChange={(v) => set('bgColor', v)} />
        )}
      </Group>

      {/* ===== Post-FX ===== */}
      <Group title="Post-FX" defaultOpen={false}>
        <FxRow label="Scanlines" active={options.fx_scanlines}
          onToggle={(v) => set('fx_scanlines', v)}>
          {options.fx_scanlines && (
            <SliderRow label="Intensity" value={options.fx_scanlines_intensity}
              min={0} max={100} step={1} unit="%" onChange={(v) => set('fx_scanlines_intensity', v)} />
          )}
        </FxRow>
        <FxRow label="Vignette" active={options.fx_vignette}
          onToggle={(v) => set('fx_vignette', v)}>
          {options.fx_vignette && (
            <SliderRow label="Intensity" value={options.fx_vignette_intensity}
              min={0} max={100} step={1} unit="%" onChange={(v) => set('fx_vignette_intensity', v)} />
          )}
        </FxRow>
        <FxRow label="Bloom" active={options.fx_bloom}
          onToggle={(v) => set('fx_bloom', v)}>
          {options.fx_bloom && (
            <SliderRow label="Intensity" value={options.fx_bloom_intensity}
              min={0} max={100} step={1} unit="%" onChange={(v) => set('fx_bloom_intensity', v)} />
          )}
        </FxRow>
        <FxRow label="Chromatic Aberration" active={options.fx_chromatic}
          onToggle={(v) => set('fx_chromatic', v)}>
          {options.fx_chromatic && (
            <SliderRow label="Shift" value={options.fx_chromatic_px}
              min={1} max={20} step={1} unit="px" onChange={(v) => set('fx_chromatic_px', v)} />
          )}
        </FxRow>
        <FxRow label="Film Grain" active={options.fx_grain}
          onToggle={(v) => set('fx_grain', v)}>
          {options.fx_grain && (
            <SliderRow label="Intensity" value={options.fx_grain_intensity}
              min={0} max={100} step={1} unit="%" onChange={(v) => set('fx_grain_intensity', v)} />
          )}
        </FxRow>
        <FxRow label="Glitch" active={options.fx_glitch}
          onToggle={(v) => set('fx_glitch', v)}>
          {options.fx_glitch && (
            <SliderRow label="Intensity" value={options.fx_glitch_intensity}
              min={0} max={100} step={1} unit="%" onChange={(v) => set('fx_glitch_intensity', v)} />
          )}
        </FxRow>
      </Group>
    </div>
  );
}

/* ============================================================
 *  Sub-components
 * ============================================================ */

function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="section-header w-full hover:text-label-secondary transition-colors"
      >
        <span>{title}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          strokeWidth={2.5}
        />
      </button>
      {open && (
        <div className="material-thin overflow-hidden fade-in">
          {children}
        </div>
      )}
    </section>
  );
}

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const display = format ? format(value) : value.toString();
  return (
    <div className="list-row flex-col items-stretch !min-h-0 py-3">
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <span className="callout">{label}</span>
          {hint && <span className="footnote text-label-tertiary">{hint}</span>}
        </div>
        <span className="callout font-mono text-label-secondary tabular-nums min-w-[44px] text-right">
          {display}
          {unit && <span className="text-label-tertiary ml-0.5">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className="slider mt-2"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="list-row">
      <div className="flex flex-col min-w-0">
        <span className="callout">{label}</span>
        {hint && <span className="footnote text-label-tertiary">{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        data-on={value}
        className="switch"
        onClick={() => onChange(!value)}
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  disabled,
  disabledHint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className={`list-row ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex flex-col min-w-0">
        <span className="callout">{label}</span>
        {disabled && disabledHint && (
          <span className="footnote text-label-tertiary">{disabledHint}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="callout font-mono text-label-tertiary tabular-nums">{value.toUpperCase()}</span>
        <label
          className="color-swatch"
          style={{ background: value }}
          aria-label={`${label} color picker`}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </label>
      </div>
    </div>
  );
}


function FxRow({
  label,
  active,
  onToggle,
  children,
}: {
  label: string;
  active: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="list-row">
        <span className="callout">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          onClick={() => onToggle(!active)}
          className={`toggle ${active ? 'toggle-on' : ''}`}
        >
          <span className="toggle-thumb" />
        </button>
      </div>
      {children}
    </div>
  );
}
