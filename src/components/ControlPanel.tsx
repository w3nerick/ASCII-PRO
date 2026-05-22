import { useState, type ReactNode } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { CHARSET_KEYS, charsetLabel, type CharsetKey } from '../lib/charsets';
import type { AsciiOptions, RenderMode, ColorPalette, AspectRatio, BlendMode } from '../lib/asciiConverter';

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
      {/* Header — desktop only */}
      <div className="hidden md:flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10"
        style={{ borderColor: 'var(--separator)', background: 'var(--bg-elevated)' }}>
        <span className="caption">Controls</span>
        <button type="button" onClick={onReset} className="btn btn-ghost btn-sm btn-icon" title="Reset to defaults">
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Mobile reset */}
      <div className="flex md:hidden items-center justify-end px-5 py-2">
        <button type="button" onClick={onReset} className="btn btn-tinted btn-sm">
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Reset</span>
        </button>
      </div>

      {/* MODE */}
      <Group label="Background">
        <Row label="Mode">
          <Select
            value={options.bgMode}
            onChange={v => set('bgMode', v as AsciiOptions['bgMode'])}
            options={[
              { value: 'original', label: 'Original' },
              { value: 'blurred', label: 'Blurred' },
              { value: 'solid', label: 'Solid' },
              { value: 'transparent', label: 'None' },
            ]}
          />
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

      {/* CHARACTERS */}
      <Group label="Characters">
        <Row label="Render">
          <Select
            value={options.renderMode}
            onChange={v => set('renderMode', v as RenderMode)}
            options={[
              { value: 'text', label: 'Text' },
              { value: 'filled_circle', label: 'Dots' },
              { value: 'filled_square', label: 'Squares' },
              { value: 'triangle', label: 'Triangles' },
              { value: 'diamond', label: 'Diamonds' },
              { value: 'cross', label: 'Crosses' },
              { value: 'heart', label: 'Hearts' },
            ]}
          />
        </Row>
        <Row label="Blend">
          <Select
            value={options.blendMode}
            onChange={v => set('blendMode', v as BlendMode)}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'screen', label: 'Screen' },
              { value: 'multiply', label: 'Multiply' },
              { value: 'overlay', label: 'Overlay' },
            ]}
          />
        </Row>
        <Row label="Font Size">
          <SliderRow value={options.fontSize} min={4} max={28} step={1}
            onChange={v => set('fontSize', v)} unit="px" />
        </Row>
        <Row label="Charset">
          <Select
            value={options.charset}
            onChange={v => set('charset', v as CharsetKey)}
            options={CHARSET_KEYS.map(k => ({ value: k, label: charsetLabel(k) }))}
          />
        </Row>
        {options.charset === 'custom' && (
          <Row label="Custom">
            <input type="text" className="input" value={options.customRamp}
              onChange={e => set('customRamp', e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, maxWidth: 120 }} />
          </Row>
        )}
        <Row label="Opacity">
          <SliderRow value={options.charOpacity} min={10} max={100} step={1}
            onChange={v => set('charOpacity', v)} unit="%" />
        </Row>
        <Row label="Glow">
          <SliderRow value={options.charGlow} min={0} max={100} step={1}
            onChange={v => set('charGlow', v)} unit="%" />
        </Row>
        <Row label="Brightness">
          <SliderRow value={options.charBrightness} min={50} max={250} step={5}
            onChange={v => set('charBrightness', v)} unit="%" />
        </Row>
        <Row label="Invert">
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

      {/* COLOR */}
      <Group label="Color">
        <Row label="Enabled">
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
        {options.color && (
          <>
            <Row label="Palette">
              <Select
                value={options.colorPalette}
                onChange={v => set('colorPalette', v as ColorPalette)}
                options={[
                  { value: 'original', label: 'Original' },
                  { value: 'warm', label: 'Warm' },
                  { value: 'cool', label: 'Cool' },
                  { value: 'cyberpunk', label: 'Cyberpunk' },
                  { value: 'neon', label: 'Neon' },
                  { value: 'sunset', label: 'Sunset' },
                ]}
              />
            </Row>
            <Row label="Gradient Map">
              <Switch value={options.gradientMap} onChange={v => set('gradientMap', v)} />
            </Row>
            {options.gradientMap && (
              <>
                <Row label="Start">
                  <div className="flex items-center gap-2">
                    <label className="color-swatch" style={{ background: options.gradientStart }}>
                      <input type="color" value={options.gradientStart} onChange={e => set('gradientStart', e.target.value)} />
                    </label>
                  </div>
                </Row>
                <Row label="End">
                  <div className="flex items-center gap-2">
                    <label className="color-swatch" style={{ background: options.gradientEnd }}>
                      <input type="color" value={options.gradientEnd} onChange={e => set('gradientEnd', e.target.value)} />
                    </label>
                  </div>
                </Row>
              </>
            )}
            <Row label="Color Boost">
              <SliderRow value={options.colorEnhance} min={0} max={100} step={1}
                onChange={v => set('colorEnhance', v)} unit="%" />
            </Row>
          </>
        )}
      </Group>

      {/* INTENSITY */}
      <Group label="Adjustments">
        <Row label="Coverage">
          <SliderRow value={options.coverage} min={0} max={100} step={1}
            onChange={v => set('coverage', v)} unit="%" />
        </Row>
        <Row label="Edges">
          <Switch value={options.edges} onChange={v => set('edges', v)} />
        </Row>
        {options.edges && (
          <Row label="Threshold">
            <SliderRow value={options.edgeThreshold} min={0} max={255} step={1}
              onChange={v => set('edgeThreshold', v)} />
          </Row>
        )}
        <Row label="Density">
          <SliderRow value={options.density} min={0.5} max={2} step={0.05}
            onChange={v => set('density', v)} unit="x" format={v => v.toFixed(2)} />
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
        <Row label="Dithering">
          <Switch value={options.dithering} onChange={v => set('dithering', v)} />
        </Row>
      </Group>

      {/* OUTPUT / EXPORT */}
      <Group label="Output">
        <Row label="Aspect Ratio">
          <Select
            value={options.aspectRatio}
            onChange={v => set('aspectRatio', v as AspectRatio)}
            options={[
              { value: 'free', label: 'Free' },
              { value: '1:1', label: '1:1' },
              { value: '4:5', label: '4:5 IG' },
              { value: '9:16', label: '9:16 Story' },
              { value: '16:9', label: '16:9 Wide' },
              { value: '3:1', label: '3:1 Banner' },
            ]}
          />
        </Row>
        <Row label="Export Scale">
          <Select
            value={String(options.exportScale)}
            onChange={v => set('exportScale', Number(v))}
            options={[
              { value: '1', label: '1x' },
              { value: '2', label: '2x HD' },
              { value: '4', label: '4x Ultra' },
            ]}
          />
        </Row>
      </Group>

      {/* POST-PROCESSING */}
      <Group label="Effects" defaultOpen={false}>
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

      <div className="h-8 shrink-0" />
    </div>
  );
}

/* ── Sub-components ─────────────────────── */

function Group({ label, children, defaultOpen = true }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="px-3 md:px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-1 py-1.5"
      >
        <span className="caption">{label}</span>
        <ChevronRight
          className="w-3 h-3 text-label-quaternary transition-transform duration-200"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          strokeWidth={2.5}
        />
      </button>
      {open && (
        <div
          className="mt-1.5 rounded-xl overflow-hidden"
          style={{ background: 'var(--surface-1)', border: '0.5px solid var(--separator)' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="list-row">
      <span className="subhead text-label-secondary shrink-0">{label}</span>
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
    <div className="flex items-center gap-3 w-full">
      <input type="range" className="slider flex-1"
        value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))} />
      <span className="footnote text-label-tertiary tabular-nums text-right font-mono"
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

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--surface-2)',
        border: '0.5px solid var(--separator-strong)',
        color: 'var(--label)',
        borderRadius: 8,
        fontSize: 13,
        padding: '0 10px',
        height: 30,
        cursor: 'pointer',
        maxWidth: 130,
        appearance: 'none',
        WebkitAppearance: 'none',
        paddingRight: 24,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(235,235,245,0.3)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function FxRow({ label, value, onChange, children }: {
  label: string; value: boolean; onChange: (v: boolean) => void; children: ReactNode;
}) {
  return (
    <div>
      <div className="list-row">
        <span className="subhead text-label-secondary">{label}</span>
        <Switch value={value} onChange={onChange} />
      </div>
      {value && (
        <div style={{ borderTop: '0.5px solid var(--separator)', background: 'rgba(0,0,0,0.15)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
