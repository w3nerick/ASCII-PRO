import { ChevronRight, Copy, Eye, EyeOff, Layers as LayersIcon, Play, Pause, Plus, RotateCcw, Sun, Droplet, Sparkles, Box, SquareDashed, Type, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { CATEGORIES, STYLES, getStyle } from '../engine/styles';
import { BLEND_MODES, type ParamDef } from '../engine/types';
import { GRADIENTS, PHOTO_FILTERS, CHARSET_OPTIONS } from '../engine/palettes';
import {
  activeLayer, addLayer, duplicateLayer, moveLayer, patchLook, patchPost, removeLayer, setActiveLayer, setLayerParam, setLayerProps,
  setStyle, setUi, updateLook, useStore, type RightTab,
} from '../state/store';
import { DEFAULT_BLUR, DEFAULT_COLOR } from '../state/defaults';
import { resetClock, styleThumbLook } from '../state/renderer';
import { clearMask, fillMask } from '../state/mask';
import { ParamGroups, Section, SelectBox, SelectRow, Slider, ToggleRow, ColorRow, Toggle, GradientPreview } from './controls';
import { Thumb } from './Thumb';

const TABS: { id: RightTab; label: string; icon: typeof Type }[] = [
  { id: 'style', label: 'Style', icon: Type },
  { id: 'layers', label: 'Layers', icon: LayersIcon },
  { id: 'depth', label: 'Depth', icon: Box },
  { id: 'animation', label: 'Animation', icon: Play },
  { id: 'lights', label: 'Lights', icon: Sun },
  { id: 'color', label: 'Color', icon: Droplet },
  { id: 'post', label: 'Post FX', icon: Sparkles },
  { id: 'mask', label: 'Mask', icon: SquareDashed },
];

export function RightRail() {
  const tab = useStore((s) => s.ui.rightTab);
  const open = useStore((s) => s.ui.rightOpen);
  const look = useStore((s) => s.doc.look);
  const style = useStore((s) => getStyle(activeLayer(s).styleId));
  const active: Partial<Record<RightTab, boolean>> = {
    layers: look.layers.length > 1,
    depth: style.depth && (look.depth.wave + look.depth.splay + look.depth.colorSplit + look.depth.etch > 0),
    animation: look.animation.animated || look.animation.matrix,
    lights: look.lights.enabled,
    color: JSON.stringify(look.color) !== JSON.stringify(DEFAULT_COLOR),
    post: Object.values(look.post).some((v) => v.on),
    mask: look.mask.enabled,
  };
  return (
    <nav className="rail" aria-label="Settings">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`rail-btn tip ${tab === t.id && open ? 'on' : ''}`}
          data-tip={t.id === 'style' ? style.name : t.label}
          aria-label={t.label}
          onClick={() => {
            const patch: Parameters<typeof setUi>[0] = { rightTab: t.id, rightOpen: tab === t.id ? !open : true };
            if (t.id === 'mask' && look.mask.enabled) patch.tool = 'mask';
            setUi(patch);
          }}
        >
          {t.id === 'style' ? <span style={{ fontSize: 15, fontFamily: 'var(--font-mono)' }}>{style.icon}</span> : <t.icon size={17} strokeWidth={1.6} />}
          {active[t.id] && <span className="dot" />}
        </button>
      ))}
    </nav>
  );
}

const styleOptions = CATEGORIES.flatMap((c) => STYLES.filter((s) => s.category === c.id).map((s) => ({ label: s.name, value: s.id })));

export function Dock() {
  const tab = useStore((s) => s.ui.rightTab);
  const layer = useStore((s) => activeLayer(s));
  const title = TABS.find((t) => t.id === tab)?.label || 'Style';
  return (
    <aside className="dock" aria-label="Properties">
      <div className="dock-head">
        <span className="dock-title">/ {tab === 'style' ? getStyle(layer.styleId).name : title}</span>
        <SelectBox value={layer.styleId} options={styleOptions} onChange={(v) => setStyle(v)} ariaLabel="Style" />
        <button className="icon-btn sm" title="Collapse" onClick={() => setUi({ rightOpen: false })}>
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="dock-body scroll">
        {tab === 'style' && <StyleTab />}
        {tab === 'layers' && <LayersTab />}
        {tab === 'depth' && <DepthTab />}
        {tab === 'animation' && <AnimationTab />}
        {tab === 'lights' && <LightsTab />}
        {tab === 'color' && <ColorTab />}
        {tab === 'post' && <PostTab />}
        {tab === 'mask' && <MaskTab />}
      </div>
    </aside>
  );
}

const BLUR_TYPES = ['Off', 'Gaussian', 'Lens', 'Tilt-Shift', 'Directional', 'Radial', 'Zoom', 'Glassy', 'Perspective', 'Progressive'];

function StyleTab() {
  const layer = useStore((s) => activeLayer(s));
  const color = useStore((s) => s.doc.look.color);
  const blur = useStore((s) => s.doc.look.blur);
  const style = getStyle(layer.styleId);
  const intensityDefs = style.params.filter((p) => p.section === 'Intensity');
  const onParam = (k: string, v: unknown) => setLayerParam(layer.id, k, v as never);
  return (
    <>
      <ParamGroups
        defs={style.params}
        params={layer.params}
        onChange={onParam}
        skip={(d: ParamDef) => d.section === 'Intensity'}
        defaultTitle={undefined}
      />
      <Section title="Intensity">
        {intensityDefs.map((d) => d.type === 'range' && (
          <Slider key={d.key} label={d.label} value={Number(layer.params[d.key] ?? d.default)} min={d.min} max={d.max} step={d.step} unit={d.unit} onChange={(v) => onParam(d.key, v)} />
        ))}
        <Slider label="Brightness" value={color.brightness} min={-100} max={100} onChange={(v) => patchLook('color', { brightness: v })} />
        <Slider label="Contrast" value={color.contrast} min={0} max={200} onChange={(v) => patchLook('color', { contrast: v })} />
      </Section>
      <Section title="Blur" onReset={blur.type ? () => patchLook('blur', { ...DEFAULT_BLUR }) : undefined}>
        <SelectRow label="Type" value={blur.type} options={BLUR_TYPES.map((l, i) => ({ label: l, value: i }))} onChange={(v) => patchLook('blur', { type: v })} />
        {blur.type > 0 && (
          <>
            <Slider label="Amount" value={blur.amount} min={0} max={60} unit="px" onChange={(v) => patchLook('blur', { amount: v })} />
            {[3, 4, 9].includes(blur.type) && <Slider label="Angle" value={blur.angle} min={0} max={360} unit="°" onChange={(v) => patchLook('blur', { angle: v })} />}
            {[3, 8, 9].includes(blur.type) && <Slider label="Focus" value={blur.focus} min={0} max={100} unit="%" onChange={(v) => patchLook('blur', { focus: v })} />}
            {[2, 3, 8, 9].includes(blur.type) && <Slider label="Sharp Area" value={blur.spread} min={0} max={100} unit="%" onChange={(v) => patchLook('blur', { spread: v })} />}
            {[2, 5, 6].includes(blur.type) && (
              <>
                <Slider label="Center X" value={blur.centerX} min={0} max={100} unit="%" onChange={(v) => patchLook('blur', { centerX: v })} />
                <Slider label="Center Y" value={blur.centerY} min={0} max={100} unit="%" onChange={(v) => patchLook('blur', { centerY: v })} />
              </>
            )}
          </>
        )}
      </Section>
    </>
  );
}

function LayersTab() {
  const layers = useStore((s) => s.doc.look.layers);
  const activeId = useStore((s) => s.doc.activeLayer);
  const act = layers.find((l) => l.id === activeId) || layers[0];
  return (
    <>
      <Section title="Layers" sub="Layers render top to bottom; each one processes the output of the one above it.">
        <div className="layer-list">
          {layers.map((l, i) => {
            const st = getStyle(l.styleId);
            return (
              <div key={l.id} className={`layer-item ${l.id === activeId ? 'on' : ''} ${l.enabled ? '' : 'off'}`} onClick={() => setActiveLayer(l.id)}>
                <div className="lthumb" style={{ overflow: 'hidden' }}>
                  <Thumb thumbKey={`style:${st.id}`} look={styleThumbLook(st.id)} icon={st.icon} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="layer-name">{i + 1}. {st.name}</div>
                  <div className="layer-meta">{l.opacity}% · {BLEND_MODES.find((b) => b.value === l.blend)?.label}</div>
                </div>
                <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn sm" title={l.enabled ? 'Hide' : 'Show'} onClick={() => setLayerProps(l.id, { enabled: !l.enabled })}>
                    {l.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button className="icon-btn sm" title="Move up" disabled={i === 0} onClick={() => moveLayer(l.id, -1)}><ChevronUp size={13} /></button>
                  <button className="icon-btn sm" title="Move down" disabled={i === layers.length - 1} onClick={() => moveLayer(l.id, 1)}><ChevronDown size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn-outline" onClick={() => addLayer('characters')}><Plus size={14} /> Add layer</button>
          <button className="btn-ghost" onClick={() => duplicateLayer(act.id)}><Copy size={13} /> Duplicate</button>
          <button className="btn-ghost" disabled={layers.length <= 1} onClick={() => removeLayer(act.id)}><Trash2 size={13} /> Delete</button>
        </div>
      </Section>
      <Section title="Selected layer">
        <SelectRow label="Style" value={act.styleId} options={styleOptions} onChange={(v) => { setActiveLayer(act.id); setStyle(v); }} />
        <Slider label="Opacity" value={act.opacity} min={0} max={100} unit="%" onChange={(v) => setLayerProps(act.id, { opacity: v })} />
        <SelectRow label="Blend" value={act.blend} options={BLEND_MODES} onChange={(v) => setLayerProps(act.id, { blend: v })} />
      </Section>
      <Section sub="Tip: Shift+click any style in the left panel to stack it as a new layer." />
    </>
  );
}

function DepthTab() {
  const depth = useStore((s) => s.doc.look.depth);
  const style = useStore((s) => getStyle(activeLayer(s).styleId));
  return (
    <Section
      title="Depth"
      sub={style.depth ? 'Character-level depth effects.' : `“${style.name}” has no characters — Depth works with ASCII-type styles (Characters, ASCII Studio, Block, Mixed, Disco).`}
      onReset={() => patchLook('depth', { wave: 0, splay: 0, colorSplit: 0, etch: 0 })}
    >
      <Slider label="Wave" value={depth.wave} min={0} max={100} unit="%" onChange={(v) => patchLook('depth', { wave: v })} />
      <Slider label="Splay" value={depth.splay} min={0} max={100} unit="%" onChange={(v) => patchLook('depth', { splay: v })} />
      <Slider label="Color Split" value={depth.colorSplit} min={0} max={100} unit="%" onChange={(v) => patchLook('depth', { colorSplit: v })} />
      <Slider label="Etch" value={depth.etch} min={0} max={100} unit="%" onChange={(v) => patchLook('depth', { etch: v })} />
    </Section>
  );
}

const MATRIX_DIRS = ['→ Right', '← Left', '↓ Down', '↑ Up', '↘ Down-right', '↙ Down-left', '↗ Up-right', '↖ Up-left'];

function AnimationTab() {
  const a = useStore((s) => s.doc.look.animation);
  const playing = useStore((s) => s.ui.playing);
  return (
    <>
      <Section title="Animation">
        <ToggleRow label="Animated" value={a.animated} onChange={(v) => patchLook('animation', { animated: v })} />
        {a.animated && <Slider label="Speed" value={a.speed} min={0} max={300} unit="%" onChange={(v) => patchLook('animation', { speed: v })} />}
        <ToggleRow label="Animate Matrix" value={a.matrix} onChange={(v) => patchLook('animation', { matrix: v, animated: v ? true : a.animated })} />
        {a.matrix && (
          <>
            <SelectRow label="Matrix Direction" value={a.matrixDir} options={MATRIX_DIRS.map((l, i) => ({ label: l, value: i }))} onChange={(v) => patchLook('animation', { matrixDir: v })} />
            <Slider label="Matrix Speed" value={a.matrixSpeed} min={10} max={300} unit="%" onChange={(v) => patchLook('animation', { matrixSpeed: v })} />
          </>
        )}
        <Slider label="Matrix Shimmer" value={a.shimmer} min={0} max={100} unit="%" onChange={(v) => patchLook('animation', { shimmer: v, animated: v > 0 ? true : a.animated })} />
      </Section>
      <Section title="Playback">
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-outline" onClick={() => setUi({ playing: !playing })}>{playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : 'Play'}</button>
          <button className="btn-ghost" onClick={resetClock}><RotateCcw size={13} /> Restart</button>
        </div>
        <div className="section-sub" style={{ marginTop: 12 }}>Animated looks export as GIF or video from the Export menu.</div>
      </Section>
    </>
  );
}

function LightsTab() {
  const L = useStore((s) => s.doc.look.lights);
  return (
    <>
      <Section title="Lights">
        <ToggleRow label="Enable Lights" value={L.enabled} onChange={(v) => patchLook('lights', { enabled: v })} />
        {L.enabled && (
          <>
            <SelectRow label="Mode" value={L.mode} options={[{ label: 'Spotlight (cursor)', value: 0 }, { label: 'Fixed lights', value: 1 }]} onChange={(v) => patchLook('lights', { mode: v })} />
            <Slider label="Spotlight Radius" value={L.radius} min={2} max={100} unit="%" onChange={(v) => patchLook('lights', { radius: v })} />
            <Slider label="Intensity" value={L.intensity} min={0} max={300} unit="%" onChange={(v) => patchLook('lights', { intensity: v })} />
            <Slider label="Ambient" value={L.ambient} min={0} max={100} unit="%" onChange={(v) => patchLook('lights', { ambient: v })} />
            {L.mode === 0 && <ColorRow label="Color" value={L.color} onChange={(v) => patchLook('lights', { color: v })} />}
            <ToggleRow label="Flicker" value={L.flicker} onChange={(v) => patchLook('lights', { flicker: v })} />
          </>
        )}
      </Section>
      {L.enabled && L.mode === 1 && (
        <Section title="Light Points">
          {L.points.map((p, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <ColorRow label={`Light ${i + 1}`} value={p.color} onChange={(v) => patchLook('lights', { points: L.points.map((q, j) => (j === i ? { ...q, color: v } : q)) })} />
              <Slider label="X" value={Math.round(p.x * 100)} min={0} max={100} unit="%" onChange={(v) => patchLook('lights', { points: L.points.map((q, j) => (j === i ? { ...q, x: v / 100 } : q)) })} />
              <Slider label="Y" value={Math.round(p.y * 100)} min={0} max={100} unit="%" onChange={(v) => patchLook('lights', { points: L.points.map((q, j) => (j === i ? { ...q, y: v / 100 } : q)) })} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost" disabled={L.points.length >= 4} onClick={() => patchLook('lights', { points: [...L.points, { x: 0.5, y: 0.5, color: '#ffffff' }] })}><Plus size={13} /> Add light</button>
            <button className="btn-ghost" disabled={L.points.length <= 1} onClick={() => patchLook('lights', { points: L.points.slice(0, -1) })}><Trash2 size={13} /> Remove</button>
          </div>
        </Section>
      )}
    </>
  );
}

const QUICK_FILTERS = ['None', 'B&W', 'Sepia', 'Warm', 'Cool', 'Vintage', 'Fade', 'Cyber'];

function ColorTab() {
  const c = useStore((s) => s.doc.look.color);
  const set = (p: Partial<typeof c>) => patchLook('color', p);
  return (
    <>
      <Section title="Color" onReset={() => set({ ...DEFAULT_COLOR })}>
        <div className="chips" style={{ marginBottom: 14 }}>
          {QUICK_FILTERS.map((f) => {
            const idx = PHOTO_FILTERS.indexOf(f);
            return <button key={f} className={c.filter === idx ? 'on' : ''} onClick={() => set({ filter: idx })}>{f}</button>;
          })}
        </div>
        <SelectRow label="Photo Filter" value={c.filter} options={PHOTO_FILTERS.map((l, i) => ({ label: i === 0 ? 'Choose a filter…' : l, value: i }))} onChange={(v) => set({ filter: v })} />
        <ColorRow label="Tint" value={c.tint} onChange={(v) => set({ tint: v, tintOpacity: c.tintOpacity || 30 })} />
        <Slider label="Tint Opacity" value={c.tintOpacity} min={0} max={100} unit="%" onChange={(v) => set({ tintOpacity: v })} />
        <SelectRow label="Blend" value={c.tintBlend} options={['Multiply', 'Screen', 'Overlay', 'Color'].map((l, i) => ({ label: l, value: i }))} onChange={(v) => set({ tintBlend: v })} />
        <Slider label="Saturation" value={c.saturation} min={0} max={200} unit="%" onChange={(v) => set({ saturation: v })} />
        <Slider label="Vibrance" value={c.vibrance} min={-100} max={100} onChange={(v) => set({ vibrance: v })} />
        <Slider label="Hue" value={c.hue} min={-180} max={180} unit="°" onChange={(v) => set({ hue: v })} />
        <Slider label="Temperature" value={c.temperature} min={-100} max={100} onChange={(v) => set({ temperature: v })} />
        <Slider label="Exposure" value={c.exposure} min={-100} max={100} onChange={(v) => set({ exposure: v })} />
        <div className="ctl">
          <div className="ctl-row">
            <span className="ctl-label">Gradient Map</span>
            <SelectBox value={c.gradientMap} options={[{ label: 'None', value: 0 }, ...GRADIENTS.map((g, i) => ({ label: g.label, value: i + 1 }))]} onChange={(v) => set({ gradientMap: v })} />
          </div>
          {c.gradientMap > 0 && <GradientPreview stops={GRADIENTS[c.gradientMap - 1].stops} />}
        </div>
        <Slider label="Grayscale" value={c.grayscale} min={0} max={100} unit="%" onChange={(v) => set({ grayscale: v })} />
        <ToggleRow label="Invert Image" value={c.invert} onChange={(v) => set({ invert: v })} />
      </Section>
    </>
  );
}

function FxRow({ label, on, onToggle, children }: { label: string; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <>
      <div className="fx-row">
        <span className="ctl-label" onClick={() => onToggle(!on)}>{label}</span>
        <Toggle on={on} onChange={onToggle} label={label} />
      </div>
      {on && children && <div className="fx-body">{children}</div>}
    </>
  );
}

const CURVES = ['S-Curve', 'Lift Shadows', 'Brighten', 'Darken', 'Fade Highlights'];

function PostTab() {
  const p = useStore((s) => s.doc.look.post);
  return (
    <Section title="Post FX" onReset={() => updateLook((l) => ({ ...l, post: Object.fromEntries(Object.entries(l.post).map(([k, v]) => [k, { ...v, on: false }])) as typeof l.post }))}>
      <FxRow label="Levels" on={p.levels.on} onToggle={(on) => patchPost('levels', { on })}>
        <Slider label="Input black point" value={p.levels.inBlack} min={0} max={254} onChange={(v) => patchPost('levels', { inBlack: v })} />
        <Slider label="Input white point" value={p.levels.inWhite} min={1} max={255} onChange={(v) => patchPost('levels', { inWhite: v })} />
        <Slider label="Midtone gamma" value={p.levels.gamma} min={10} max={300} unit="%" onChange={(v) => patchPost('levels', { gamma: v })} />
        <Slider label="Output black point" value={p.levels.outBlack} min={0} max={255} onChange={(v) => patchPost('levels', { outBlack: v })} />
        <Slider label="Output white point" value={p.levels.outWhite} min={0} max={255} onChange={(v) => patchPost('levels', { outWhite: v })} />
      </FxRow>
      <FxRow label="Curves" on={p.curves.on} onToggle={(on) => patchPost('curves', { on })}>
        <SelectRow label="Preset" value={p.curves.preset} options={CURVES.map((l, i) => ({ label: l, value: i }))} onChange={(v) => patchPost('curves', { preset: v })} />
        <Slider label="Amount" value={p.curves.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('curves', { amount: v })} />
      </FxRow>
      <FxRow label="Vignette" on={p.vignette.on} onToggle={(on) => patchPost('vignette', { on })}>
        <Slider label="Amount" value={p.vignette.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('vignette', { amount: v })} />
        <Slider label="Softness" value={p.vignette.softness} min={0} max={100} unit="%" onChange={(v) => patchPost('vignette', { softness: v })} />
      </FxRow>
      <FxRow label="Scan Lines" on={p.scanlines.on} onToggle={(on) => patchPost('scanlines', { on })}>
        <Slider label="Amount" value={p.scanlines.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('scanlines', { amount: v })} />
        <Slider label="Spacing" value={p.scanlines.density} min={1} max={12} unit="px" onChange={(v) => patchPost('scanlines', { density: v })} />
      </FxRow>
      <FxRow label="CRT Curvature" on={p.crt.on} onToggle={(on) => patchPost('crt', { on })}>
        <Slider label="Amount" value={p.crt.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('crt', { amount: v })} />
      </FxRow>
      <FxRow label="Chromatic" on={p.chromatic.on} onToggle={(on) => patchPost('chromatic', { on })}>
        <Slider label="Amount" value={p.chromatic.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('chromatic', { amount: v })} />
      </FxRow>
      <FxRow label="Bloom" on={p.bloom.on} onToggle={(on) => patchPost('bloom', { on })}>
        <Slider label="Intensity" value={p.bloom.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('bloom', { amount: v })} />
        <Slider label="Threshold" value={p.bloom.threshold} min={0} max={100} unit="%" onChange={(v) => patchPost('bloom', { threshold: v })} />
        <Slider label="Radius" value={p.bloom.radius} min={2} max={60} unit="px" onChange={(v) => patchPost('bloom', { radius: v })} />
      </FxRow>
      <FxRow label="Character Bloom" on={p.glow.on} onToggle={(on) => patchPost('glow', { on })}>
        <Slider label="Intensity" value={p.glow.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('glow', { amount: v })} />
      </FxRow>
      <FxRow label="Tint" on={p.tint.on} onToggle={(on) => patchPost('tint', { on })}>
        <ColorRow label="Tint" value={p.tint.color} onChange={(v) => patchPost('tint', { color: v })} />
        <Slider label="Tint Amount" value={p.tint.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('tint', { amount: v })} />
      </FxRow>
      <FxRow label="Film Grain" on={p.grain.on} onToggle={(on) => patchPost('grain', { on })}>
        <Slider label="Intensity" value={p.grain.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('grain', { amount: v })} />
        <ToggleRow label="Colour" value={p.grain.colour} onChange={(v) => patchPost('grain', { colour: v })} />
      </FxRow>
      <FxRow label="Glitch" on={p.glitch.on} onToggle={(on) => patchPost('glitch', { on })}>
        <Slider label="Intensity" value={p.glitch.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('glitch', { amount: v })} />
        <Slider label="Slice Size" value={p.glitch.slice} min={2} max={60} unit="px" onChange={(v) => patchPost('glitch', { slice: v })} />
      </FxRow>
      <FxRow label="RGB Split" on={p.rgbSplit.on} onToggle={(on) => patchPost('rgbSplit', { on })}>
        <Slider label="Offset" value={p.rgbSplit.amount} min={0} max={40} unit="px" onChange={(v) => patchPost('rgbSplit', { amount: v })} />
        <Slider label="Angle" value={p.rgbSplit.angle} min={0} max={360} unit="°" onChange={(v) => patchPost('rgbSplit', { angle: v })} />
      </FxRow>
      <FxRow label="Pixelate" on={p.pixelate.on} onToggle={(on) => patchPost('pixelate', { on })}>
        <Slider label="Size" value={p.pixelate.size} min={2} max={64} unit="px" onChange={(v) => patchPost('pixelate', { size: v })} />
      </FxRow>
      <FxRow label="Halftone" on={p.halftone.on} onToggle={(on) => patchPost('halftone', { on })}>
        <Slider label="Size" value={p.halftone.size} min={3} max={40} unit="px" onChange={(v) => patchPost('halftone', { size: v })} />
        <SelectRow label="Shape" value={p.halftone.shape} options={['Dots', 'Squares', 'Lines'].map((l, i) => ({ label: l, value: i }))} onChange={(v) => patchPost('halftone', { shape: v })} />
        <SelectRow label="Colour" value={p.halftone.mono ? 1 : 0} options={[{ label: 'From image', value: 0 }, { label: 'Mono', value: 1 }]} onChange={(v) => patchPost('halftone', { mono: v === 1 })} />
      </FxRow>
      <FxRow label="ASCII" on={p.ascii.on} onToggle={(on) => patchPost('ascii', { on })}>
        <Slider label="Size" value={p.ascii.size} min={4} max={40} unit="px" onChange={(v) => patchPost('ascii', { size: v })} />
        <SelectRow label="Character Set" value={p.ascii.charset} options={CHARSET_OPTIONS} onChange={(v) => patchPost('ascii', { charset: v })} />
        <SelectRow label="Colour" value={p.ascii.mono ? 1 : 0} options={[{ label: 'From image', value: 0 }, { label: 'Mono', value: 1 }]} onChange={(v) => patchPost('ascii', { mono: v === 1 })} />
      </FxRow>
      <FxRow label="Sharpen" on={p.sharpen.on} onToggle={(on) => patchPost('sharpen', { on })}>
        <Slider label="Amount" value={p.sharpen.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('sharpen', { amount: v })} />
      </FxRow>
      <FxRow label="Threshold" on={p.threshold.on} onToggle={(on) => patchPost('threshold', { on })}>
        <Slider label="Cutoff" value={p.threshold.level} min={1} max={99} unit="%" onChange={(v) => patchPost('threshold', { level: v })} />
      </FxRow>
      <FxRow label="Noise" on={p.noise.on} onToggle={(on) => patchPost('noise', { on })}>
        <Slider label="Amount" value={p.noise.amount} min={0} max={100} unit="%" onChange={(v) => patchPost('noise', { amount: v })} />
      </FxRow>
    </Section>
  );
}

const MASK_TOOLS = ['Freehand', 'Rectangle', 'Ellipse', 'Eraser'];

function MaskTab() {
  const m = useStore((s) => s.doc.look.mask);
  const tool = useStore((s) => s.ui.tool);
  return (
    <Section title="Mask" sub={m.enabled ? 'Paint on the image where the effect should appear. Outside the mask you see the original photo.' : undefined}>
      <ToggleRow label="Enable Mask" value={m.enabled} onChange={(v) => { patchLook('mask', { enabled: v }); setUi({ tool: v ? 'mask' : 'none' }); }} />
      {m.enabled && (
        <>
          <SelectRow label="Tool" value={m.tool} options={MASK_TOOLS.map((l, i) => ({ label: l, value: i }))} onChange={(v) => { patchLook('mask', { tool: v }); setUi({ tool: 'mask' }); }} />
          {(m.tool === 0 || m.tool === 3) && <Slider label="Brush Size" value={m.brushSize} min={4} max={300} unit="px" onChange={(v) => patchLook('mask', { brushSize: v })} />}
          <Slider label="Feather" value={m.feather} min={0} max={40} unit="px" onChange={(v) => patchLook('mask', { feather: v })} />
          <ToggleRow label="Invert Mask" value={m.invert} onChange={(v) => patchLook('mask', { invert: v })} />
          <ToggleRow label="Show Overlay" value={m.showOverlay} onChange={(v) => patchLook('mask', { showOverlay: v })} />
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button className={`btn-outline ${tool === 'mask' ? '' : ''}`} onClick={() => setUi({ tool: tool === 'mask' ? 'none' : 'mask' })}>{tool === 'mask' ? 'Done painting' : 'Paint'}</button>
            <button className="btn-ghost" onClick={fillMask}>Fill all</button>
            <button className="btn-ghost" onClick={clearMask}>Clear</button>
          </div>
        </>
      )}
    </Section>
  );
}
