import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Plus, Maximize, Download, Trash2, ChevronLeft, ChevronRight, Image as ImageIcon, Camera, Upload } from 'lucide-react';
import { CATEGORIES, STYLES, getStyle } from '../engine/styles';
import { BLEND_MODES } from '../engine/types';
import { addLayer, moveLayer, removeLayer, setActiveLayer, setLayerParam, setLayerProps, setUi, updateDoc, useStore } from '../state/store';
import { getOutputCanvas, setPreviewLong, designSize } from '../state/renderer';
import { GENERATORS, loadGenerator, snapshotSource, startWebcam } from '../state/source';
import { makeLayer } from '../engine/styles';
import { ParamGroups, SelectBox, Slider, SelectRow } from './controls';
import { ExportPopover } from './ExportPopover';
import { pickFile } from './filePicker';

const NODE_W = 288;
const GAP = 90;

type Pos = Record<string, { x: number; y: number }>;
let savedPos: Pos = {};
let savedView = { x: 40, y: 60, z: 1 };

const styleOptions = CATEGORIES.flatMap((c) => STYLES.filter((s) => s.category === c.id).map((s) => ({ label: s.name, value: s.id })));

function SourceNode() {
  const source = useStore((s) => s.source);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const c = snapshotSource(560);
    setUrl(c ? c.toDataURL('image/jpeg', 0.8) : null);
  }, [source]);
  const kind = source?.kind === 'generative' ? `gen:${source.generator}` : source?.kind || 'image';
  const options = [
    { label: 'Image / Video', value: 'image' },
    { label: 'Webcam', value: 'webcam' },
    ...GENERATORS.map((g, i) => ({ label: `Generator · ${g.label}`, value: `gen:${i}` })),
  ];
  return (
    <>
      <div className="node-body">
        {url ? <img src={url} alt="" className="node-preview" /> : (
          <div className="empty-note" style={{ padding: 18 }}>
            <ImageIcon size={28} strokeWidth={1} /><br />No source yet
          </div>
        )}
      </div>
      <div className="node-foot">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source ? source.name : '—'}</span>
        <span style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn sm" title="Upload" onClick={() => pickFile()}><Upload size={13} /></button>
          <button className="icon-btn sm" title="Webcam" onClick={() => startWebcam()}><Camera size={13} /></button>
        </span>
      </div>
      <SourcePicker value={kind === 'video' ? 'image' : kind} options={options} />
    </>
  );
}

function SourcePicker({ value, options }: { value: string; options: { label: string; value: string }[] }) {
  return (
    <div style={{ padding: '0 10px 10px' }}>
      <SelectBox
        className="full"
        value={value}
        options={options}
        onChange={(v) => {
          if (v === 'image') pickFile();
          else if (v === 'webcam') startWebcam();
          else if (v.startsWith('gen:')) loadGenerator(GENERATORS[Number(v.slice(4))]);
        }}
      />
    </div>
  );
}

function StyleNode({ layerId, index, total }: { layerId: string; index: number; total: number }) {
  const layer = useStore((s) => s.doc.look.layers.find((l) => l.id === layerId));
  const [tab, setTab] = useState<'options' | 'layer'>('options');
  if (!layer) return null;
  const style = getStyle(layer.styleId);
  return (
    <>
      <div className="node-tabs">
        <button className={tab === 'options' ? 'on' : ''} onClick={() => setTab('options')}>Options</button>
        <button className={tab === 'layer' ? 'on' : ''} onClick={() => setTab('layer')}>Blend</button>
      </div>
      <div className="node-body scroll" onWheel={(e) => e.stopPropagation()}>
        {tab === 'options' ? (
          <div className="flow-params">
            <ParamGroups defs={style.params} params={layer.params} onChange={(k, v) => setLayerParam(layer.id, k, v)} defaultTitle={style.name} />
          </div>
        ) : (
          <>
            <Slider label="Opacity" value={layer.opacity} min={0} max={100} unit="%" onChange={(v) => setLayerProps(layer.id, { opacity: v })} />
            <SelectRow label="Blend" value={layer.blend} options={BLEND_MODES} onChange={(v) => setLayerProps(layer.id, { blend: v })} />
          </>
        )}
      </div>
      <div className="node-foot">
        <span>Layer {index + 1} / {total}</span>
        <span style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn sm" title="Move earlier" disabled={index === 0} onClick={() => moveLayer(layer.id, -1)}><ChevronLeft size={13} /></button>
          <button className="icon-btn sm" title="Move later" disabled={index === total - 1} onClick={() => moveLayer(layer.id, 1)}><ChevronRight size={13} /></button>
          <button className="icon-btn sm" title="Delete node" disabled={total <= 1} onClick={() => removeLayer(layer.id)}><Trash2 size={13} /></button>
        </span>
      </div>
    </>
  );
}

function OutputNode() {
  const host = useRef<HTMLDivElement>(null);
  const d = designSize();
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const c = getOutputCanvas();
    h.appendChild(c);
    setPreviewLong(Math.max(720, NODE_W * 2 * (window.devicePixelRatio || 1)));
    return () => {
      if (c.parentElement === h) h.removeChild(c);
    };
  }, []);
  return (
    <>
      <div className="node-body" style={{ padding: 0, maxHeight: 'none' }}>
        <div ref={host} style={{ background: '#000' }} />
      </div>
      <div className="node-foot"><span>Output</span><span>{d.w} × {d.h}</span></div>
    </>
  );
}

export function FlowView() {
  const layers = useStore((s) => s.doc.look.layers);
  const activeId = useStore((s) => s.doc.activeLayer);
  const exportOpen = useStore((s) => s.ui.exportOpen);
  const [view, setView] = useState(savedView);
  const [pos, setPos] = useState<Pos>(savedPos);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const [, force] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const ids = useMemo(() => ['source', ...layers.map((l) => l.id), 'output'], [layers]);

  // Default layout: a horizontal chain.
  const getPos = (id: string, i: number) => pos[id] || { x: i * (NODE_W + GAP), y: id === 'source' || id === 'output' ? 40 : 0 };

  useEffect(() => {
    savedPos = pos;
    savedView = view;
  }, [pos, view]);

  // Re-render wires once node heights are known.
  useEffect(() => {
    const id = requestAnimationFrame(() => force((x) => x + 1));
    return () => cancelAnimationFrame(id);
  }, [layers, pos]);

  const fit = () => {
    const el = rootRef.current;
    if (!el) return;
    const n = ids.length;
    const totalW = n * NODE_W + (n - 1) * GAP;
    const z = Math.min(1, (el.clientWidth - 80) / totalW);
    setPos({});
    setView({ x: Math.max(20, (el.clientWidth - totalW * z) / 2), y: 60, z });
  };

  const dragNode = (id: string, i: number) => (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('select,button,input')) return;
    e.preventDefault();
    e.stopPropagation();
    const p0 = getPos(id, i);
    const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => setPos((p) => ({ ...p, [id]: { x: p0.x + (ev.clientX - sx) / view.z, y: p0.y + (ev.clientY - sy) / view.z } }));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const panBg = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('flow-canvas')) return;
    setMenu(false);
    const sx = e.clientX, sy = e.clientY, v0 = view;
    const move = (ev: PointerEvent) => setView({ ...v0, x: v0.x + ev.clientX - sx, y: v0.y + ev.clientY - sy });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        setView((v) => {
          const z = Math.max(0.3, Math.min(1.6, v.z * Math.exp(-e.deltaY * 0.003)));
          return { z, x: mx - ((mx - v.x) * z) / v.z, y: my - ((my - v.y) * z) / v.z };
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const wires = ids.slice(0, -1).map((id, i) => {
    const a = getPos(id, i), b = getPos(ids[i + 1], i + 1);
    const ha = nodeRefs.current[id]?.offsetHeight || 200;
    const hb = nodeRefs.current[ids[i + 1]]?.offsetHeight || 200;
    const x1 = a.x + NODE_W, y1 = a.y + ha / 2, x2 = b.x, y2 = b.y + hb / 2;
    const dx = Math.max(40, (x2 - x1) / 2);
    return <path key={id} d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`} />;
  });

  const results = STYLES.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.tags.some((t) => t.includes(q.toLowerCase())));

  return (
    <section className="stage flow" ref={rootRef} onPointerDown={panBg}>
      <div className="flow-canvas" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        <svg className="wires">{wires}</svg>
        {ids.map((id, i) => {
          const p = getPos(id, i);
          const layer = layers.find((l) => l.id === id);
          return (
            <div
              key={id}
              ref={(el) => (nodeRefs.current[id] = el)}
              className={`node ${layer && layer.id === activeId ? 'sel' : ''}`}
              style={{ left: p.x, top: p.y }}
              onPointerDown={() => layer && setActiveLayer(layer.id)}
            >
              <div className="node-head" onPointerDown={dragNode(id, i)}>
                <GripVertical size={13} className="grip" />
                {id === 'source' && <span className="node-kind">Source</span>}
                {id === 'output' && <span className="node-kind">Output</span>}
                {layer && (
                  <>
                    <span className="node-kind">Style</span>
                    <SelectBox
                      value={layer.styleId}
                      options={styleOptions}
                      onChange={(v) => updateDoc((d) => ({ ...d, look: { ...d.look, layers: d.look.layers.map((l) => (l.id === layer.id ? { ...makeLayer(v), id: l.id, opacity: l.opacity, blend: l.blend } : l)) } }))}
                    />
                    <button
                      className="toggle"
                      style={{ background: layer.enabled ? '#fff' : '#3a3a3f' }}
                      title={layer.enabled ? 'Bypass' : 'Enable'}
                      onClick={() => setLayerProps(layer.id, { enabled: !layer.enabled })}
                    />
                  </>
                )}
              </div>
              {id !== 'source' && <span className="port in" />}
              {id !== 'output' && <span className="port out" />}
              {id === 'source' && <SourceNode />}
              {layer && <StyleNode layerId={layer.id} index={i - 1} total={layers.length} />}
              {id === 'output' && <OutputNode />}
            </div>
          );
        })}
      </div>
      {menu && (
        <div className="add-menu" onPointerDown={(e) => e.stopPropagation()}>
          <input className="text-input" autoFocus placeholder="Search styles…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setMenu(false); }} />
          <div className="scroll">
            {results.map((s) => (
              <button key={s.id} className="item" onClick={() => { addLayer(s.id); setMenu(false); setQ(''); setUi({ mode: 'flow' }); }}>
                <span className="ico mono">{s.icon}</span>{s.name}
                <span style={{ marginLeft: 'auto', color: 'var(--text-40)', fontSize: 11 }}>{CATEGORIES.find((c) => c.id === s.category)?.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flow-bar" onPointerDown={(e) => e.stopPropagation()}>
        <button className="bb-btn" onClick={() => setMenu((m) => !m)}><Plus size={15} /> Add node</button>
        <button className="bb-btn" onClick={fit}><Maximize size={14} /> Fit content</button>
        <span className="bb-sep" />
        <button className={`bb-btn bb-export ${exportOpen ? 'open' : ''}`} onClick={() => setUi({ exportOpen: !exportOpen })}><Download size={15} /> Export</button>
        {exportOpen && <ExportPopover style={{ bottom: 'calc(100% + 10px)', right: 0 }} />}
      </div>
    </section>
  );
}
