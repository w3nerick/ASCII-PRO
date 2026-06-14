import { useState, useRef, useCallback, type ReactNode } from 'react';
import { ChevronRight, RotateCcw, Download, Upload, Trash2, Shuffle } from 'lucide-react';
import { CHARSET_KEYS, charsetLabel, type CharsetKey } from '../lib/charsets';
import { PRESETS, applyPreset } from '../lib/presets';
import { loadUserPresets, saveUserPreset, deleteUserPreset, exportPresetsJson, importPresetsJson } from '../lib/userPresets';
import { randomizeGenome } from '../lib/genomeRandomizer';
import type { AsciiOptions, RenderMode, ColorPalette, AspectRatio, BlendMode, AnimPreset, ShapeMask, PointLight } from '../lib/asciiConverter';

interface Props {
  options: AsciiOptions;
  onChange: (next: AsciiOptions) => void;
  onReset: () => void;
}

export function ControlPanel({ options, onChange, onReset }: Props) {
  const set = <K extends keyof AsciiOptions>(key: K, val: AsciiOptions[K]) =>
    onChange({ ...options, [key]: val });

  const [userPresets, setUserPresets] = useState(() => loadUserPresets());

  const handleSavePreset = () => {
    const name = window.prompt('Preset name:');
    if (!name?.trim()) return;
    saveUserPreset(name.trim(), options);
    setUserPresets(loadUserPresets());
  };

  const handleDeletePreset = (id: string) => {
    deleteUserPreset(id);
    setUserPresets(loadUserPresets());
  };

  const handleExportPresets = () => {
    const json = exportPresetsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ascii-pro-presets.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportPresets = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const count = importPresetsJson(reader.result as string);
        if (count > 0) setUserPresets(loadUserPresets());
      };
      reader.readAsText(file);
    };
    input.click();
  };

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

      {/* PRESETS */}
      <Group label="Presets">
        <div style={{ padding: '8px 12px' }}>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p.id} type="button" className="btn btn-ghost btn-sm"
                title={p.hint}
                onClick={() => onChange(applyPreset(p.id, options))}
                style={{ fontSize: 11, height: 26, padding: '0 8px' }}>
                {p.label}
              </button>
            ))}
          </div>
          {userPresets.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '0.5px solid var(--separator)', paddingTop: 8 }}>
              <span className="caption" style={{ marginBottom: 4, display: 'block' }}>Saved</span>
              <div className="flex flex-col gap-1">
                {userPresets.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <button type="button" className="btn btn-ghost btn-sm flex-1 justify-start"
                      onClick={() => onChange({ ...options, ...p.options })}
                      style={{ fontSize: 12, height: 26 }}>
                      {p.name}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => handleDeletePreset(p.id)}
                      style={{ width: 26, height: 26 }}>
                      <Trash2 className="w-3 h-3 text-label-tertiary" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-tinted btn-sm flex-1" onClick={handleSavePreset}
              style={{ fontSize: 12, height: 28 }}>
              Save Current
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onChange(randomizeGenome(options))}
              title="Surprise me — random style" style={{ width: 28, height: 28 }}>
              <Shuffle className="w-3 h-3" strokeWidth={1.75} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={handleExportPresets}
              title="Export presets" style={{ width: 28, height: 28 }}>
              <Download className="w-3 h-3" strokeWidth={1.75} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={handleImportPresets}
              title="Import presets" style={{ width: 28, height: 28 }}>
              <Upload className="w-3 h-3" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </Group>

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
              { value: 'hexagon', label: 'Hexagons' },
              { value: 'wave', label: 'Wave' },
              { value: 'outline', label: 'Outline' },
              { value: 'pixel', label: 'Pixel' },
              { value: 'lego', label: 'LEGO' },
              { value: 'mosaic', label: 'Mosaic' },
              { value: 'cube', label: 'Cube 3D' },
              { value: 'mixed', label: 'Mixed' },
              { value: 'halftone', label: 'Halftone' },
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

      {/* ANIMATION & EFFECTS */}
      <Group label="Animation" defaultOpen={false}>
        <Row label="Preset">
          <Select
            value={options.animPreset}
            onChange={v => set('animPreset', v as AnimPreset)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'wave', label: 'Wave' },
              { value: 'cascade', label: 'Cascade' },
              { value: 'pulse', label: 'Pulse' },
              { value: 'reveal', label: 'Reveal' },
            ]}
          />
        </Row>
        {options.animPreset !== 'none' && (
          <Row label="Speed">
            <SliderRow value={options.animPresetSpeed} min={1} max={10} step={1}
              onChange={v => set('animPresetSpeed', v)} />
          </Row>
        )}
        <Row label="Shape Mask">
          <Select
            value={options.shapeMask}
            onChange={v => set('shapeMask', v as ShapeMask)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'circle', label: 'Circle' },
              { value: 'heart', label: 'Heart' },
              { value: 'star', label: 'Star' },
              { value: 'diamond', label: 'Diamond' },
              { value: 'hexagon', label: 'Hexagon' },
            ]}
          />
        </Row>
        <Row label="Disco Mode">
          <Switch value={options.discoMode} onChange={v => set('discoMode', v)} />
        </Row>
        {options.discoMode && (
          <Row label="Disco Speed">
            <SliderRow value={options.discoSpeed} min={1} max={10} step={1}
              onChange={v => set('discoSpeed', v)} />
          </Row>
        )}
      </Group>

      {/* POINT LIGHTS */}
      <Group label="Point Lights" defaultOpen={false}>
        <Row label="Enabled">
          <Switch value={options.pointLightsEnabled} onChange={v => set('pointLightsEnabled', v)} />
        </Row>
        {options.pointLightsEnabled && (
          <>
            <LightPad
              lights={options.pointLights}
              onChange={lights => set('pointLights', lights)}
            />
            {options.pointLights.map((light, i) => (
              <div key={i} style={{ borderTop: '0.5px solid var(--separator)' }}>
                <Row label={`Light ${i + 1}`}>
                  <div className="flex items-center gap-2">
                    <label className="color-swatch" style={{ background: light.color }}>
                      <input type="color" value={light.color} onChange={e => {
                        const lights = [...options.pointLights];
                        lights[i] = { ...lights[i], color: e.target.value };
                        set('pointLights', lights);
                      }} />
                    </label>
                    {options.pointLights.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={() => set('pointLights', options.pointLights.filter((_, j) => j !== i))}>×</button>
                    )}
                  </div>
                </Row>
                <Row label="Radius">
                  <SliderRow value={light.radius} min={0.1} max={1} step={0.05}
                    onChange={v => {
                      const lights = [...options.pointLights];
                      lights[i] = { ...lights[i], radius: v };
                      set('pointLights', lights);
                    }} format={v => v.toFixed(2)} />
                </Row>
                <Row label="Intensity">
                  <SliderRow value={light.intensity} min={0.1} max={2} step={0.1}
                    onChange={v => {
                      const lights = [...options.pointLights];
                      lights[i] = { ...lights[i], intensity: v };
                      set('pointLights', lights);
                    }} format={v => v.toFixed(1)} />
                </Row>
              </div>
            ))}
            {options.pointLights.length < 4 && (
              <Row label="">
                <button type="button" className="btn btn-tinted btn-sm"
                  onClick={() => set('pointLights', [...options.pointLights, { x: 0.5, y: 0.5, radius: 0.3, intensity: 1, color: '#ffffff' }])}>
                  + Add Light
                </button>
              </Row>
            )}
          </>
        )}
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

      {/* WATERMARK */}
      <Group label="Watermark" defaultOpen={false}>
        <Row label="Text">
          <input type="text" className="input" value={options.watermark}
            onChange={e => set('watermark', e.target.value)}
            placeholder="Your text..."
            style={{ fontSize: 13, maxWidth: 120 }} />
        </Row>
        {options.watermark && (
          <>
            <Row label="Position">
              <Select
                value={options.watermarkPosition}
                onChange={v => set('watermarkPosition', v as AsciiOptions['watermarkPosition'])}
                options={[
                  { value: 'top-left', label: 'Top Left' },
                  { value: 'top-right', label: 'Top Right' },
                  { value: 'bottom-left', label: 'Bot Left' },
                  { value: 'bottom-right', label: 'Bot Right' },
                  { value: 'center', label: 'Center' },
                ]}
              />
            </Row>
            <Row label="Opacity">
              <SliderRow value={options.watermarkOpacity} min={10} max={100} step={1}
                onChange={v => set('watermarkOpacity', v)} unit="%" />
            </Row>
          </>
        )}
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
        <FxRow label="CRT Curve" value={options.fx_crt} onChange={v => set('fx_crt', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_crt_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_crt_intensity', v)} unit="%" />
          </Row>
        </FxRow>
        <FxRow label="Reeded Glass" value={options.fx_reeded} onChange={v => set('fx_reeded', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_reeded_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_reeded_intensity', v)} unit="%" />
          </Row>
          <Row label="Slices">
            <SliderRow value={options.fx_reeded_slices} min={5} max={80} step={1}
              onChange={v => set('fx_reeded_slices', v)} />
          </Row>
        </FxRow>
        <FxRow label="Light Rays" value={options.fx_lightrays} onChange={v => set('fx_lightrays', v)}>
          <Row label="Intensity">
            <SliderRow value={options.fx_lightrays_intensity} min={0} max={100} step={1}
              onChange={v => set('fx_lightrays_intensity', v)} unit="%" />
          </Row>
          <Row label="Source X">
            <SliderRow value={options.fx_lightrays_x} min={0} max={1} step={0.05}
              onChange={v => set('fx_lightrays_x', v)} format={v => v.toFixed(2)} />
          </Row>
          <Row label="Source Y">
            <SliderRow value={options.fx_lightrays_y} min={0} max={1} step={0.05}
              onChange={v => set('fx_lightrays_y', v)} format={v => v.toFixed(2)} />
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
        aria-expanded={open}
        aria-label={`${label} section`}
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
          role="region"
          aria-label={label}
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
      className="mobile-select"
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

function LightPad({ lights, onChange }: { lights: PointLight[]; onChange: (lights: PointLight[]) => void }) {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const getPos = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = padRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = idx;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging.current === null) return;
    const pos = getPos(e);
    const next = [...lights];
    next[dragging.current] = { ...next[dragging.current], x: pos.x, y: pos.y };
    onChange(next);
  }, [lights, onChange, getPos]);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const onPadClick = useCallback((e: React.MouseEvent) => {
    if (dragging.current !== null) return;
    const rect = padRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (lights.length < 4) {
      onChange([...lights, { x, y, radius: 0.35, intensity: 1.2, color: '#ffffff' }]);
    }
  }, [lights, onChange]);

  return (
    <div style={{ padding: '8px 12px' }}>
      <div
        ref={padRef}
        data-light-pad
        onClick={onPadClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/10',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
          border: '1px solid var(--separator)',
          overflow: 'hidden',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
      >
        {/* Grid lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="white" strokeWidth="0.5" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="0.5" />
          <line x1="25%" y1="0" x2="25%" y2="100%" stroke="white" strokeWidth="0.5" strokeDasharray="2,4" />
          <line x1="75%" y1="0" x2="75%" y2="100%" stroke="white" strokeWidth="0.5" strokeDasharray="2,4" />
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke="white" strokeWidth="0.5" strokeDasharray="2,4" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="white" strokeWidth="0.5" strokeDasharray="2,4" />
        </svg>

        {/* Light radius visualizations */}
        {lights.map((light, i) => (
          <div key={`glow-${i}`} style={{
            position: 'absolute',
            left: `${light.x * 100}%`,
            top: `${light.y * 100}%`,
            width: `${light.radius * 200}%`,
            height: `${light.radius * 200}%`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${light.color}${Math.round(light.intensity * 25).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Light handles */}
        {lights.map((light, i) => (
          <div
            key={i}
            onPointerDown={e => onPointerDown(e, i)}
            style={{
              position: 'absolute',
              left: `${light.x * 100}%`,
              top: `${light.y * 100}%`,
              width: 22,
              height: 22,
              marginLeft: -11,
              marginTop: -11,
              borderRadius: '50%',
              background: light.color,
              border: '2px solid white',
              boxShadow: `0 0 8px ${light.color}, 0 0 16px ${light.color}80`,
              cursor: 'grab',
              zIndex: 10,
              transition: dragging.current === i ? 'none' : 'box-shadow 0.2s',
            }}
          />
        ))}

        {/* Hint text */}
        {lights.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)', fontSize: 11,
          }}>
            Click to add lights
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--label-tertiary)', marginTop: 4, textAlign: 'center' }}>
        Drag to move · Click to add · Max 4
      </div>
    </div>
  );
}
