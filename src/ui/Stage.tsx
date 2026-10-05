import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Upload, Lightbulb, RefreshCw, Shuffle, LayoutGrid, Download, ImageIcon, Camera, Play, Pause, ArrowLeftRight } from 'lucide-react';
import { getOutputCanvas, setMouse, setPreviewLong, fps, needsClock, onFrame, designSize } from '../state/renderer';
import { getState, setUi, useStore } from '../state/store';
import { inspire, loadFile, startWebcam, setVideoPlaying } from '../state/source';
import { restyle, shuffle } from '../state/actions';
import { pickFile } from './filePicker';
import { ExportPopover } from './ExportPopover';
import { CropOverlay } from './overlays/CropOverlay';
import { TextOverlay } from './overlays/TextOverlay';
import { MaskOverlay } from './overlays/MaskOverlay';
import { outputAspect } from './overlays/geom';

export function Stage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const [dragging, setDragging] = useState(false);
  const [glError, setGlError] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const source = useStore((s) => s.source);
  const crop = useStore((s) => s.doc.crop);
  const transform = useStore((s) => s.doc.transform);
  const ui = useStore((s) => s.ui);
  const transparent = useStore((s) => s.doc.look.layers.some((l) => l.enabled && Number(l.params.bdMode) === 3));
  const animating = useStore(() => needsClock());
  const [, setTick] = useState(0);

  // Engine canvas (shared with Flow mode)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    try {
      const c = getOutputCanvas();
      host.appendChild(c);
      return () => {
        if (c.parentElement === host) host.removeChild(c);
      };
    } catch (e) {
      setGlError(String((e as Error).message || e));
    }
  }, []);

  // Stage size
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // HUD refresh (fps)
  useEffect(() => {
    if (!animating) return;
    let last = 0;
    return onFrame(() => {
      const now = performance.now();
      if (now - last > 1000) {
        last = now;
        setTick((t) => t + 1);
      }
    });
  }, [animating]);

  const aspect = outputAspect(source, crop, transform, ui.tool === 'crop');
  const mobile = box.w < 640;
  const padX = mobile ? 12 : 40;
  const padTop = ui.tool !== 'none' ? 64 : mobile ? 12 : 36;
  const padBottom = mobile ? 70 : 96;
  const availW = Math.max(50, box.w - padX * 2);
  const availH = Math.max(50, box.h - padTop - padBottom);
  let fitW = availW, fitH = availW / aspect;
  if (fitH > availH) {
    fitH = availH;
    fitW = availH * aspect;
  }
  const scale = ui.zoom === 0 ? 1 : ui.zoom / 100;
  const dispW = Math.round(fitW * scale);
  const dispH = Math.round(fitH * scale);

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    setPreviewLong(Math.max(dispW, dispH) * dpr);
  }, [dispW, dispH]);

  useEffect(() => {
    if (ui.zoom === 0) setPan({ x: 0, y: 0 });
  }, [ui.zoom]);

  // Space to pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement).closest('input,textarea,select')) {
        setSpace(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpace(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    if (!getState().source) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const z = getState().ui.zoom || 100;
      const next = Math.max(10, Math.min(800, Math.round(z * Math.exp(-e.deltaY * 0.0025))));
      setUi({ zoom: next === 100 ? 0 : next });
    } else if (getState().ui.zoom > 100) {
      e.preventDefault();
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const startPan = (e: React.PointerEvent) => {
    if (!(space || e.button === 1)) return false;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, p0 = pan;
    setPanning(true);
    const move = (ev: PointerEvent) => setPan({ x: p0.x + ev.clientX - sx, y: p0.y + ev.clientY - sy });
    const up = () => {
      setPanning(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return true;
  };

  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMouse((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  const togglePlay = () => {
    const playing = !getState().ui.playing;
    setUi({ playing });
    setVideoPlaying(playing);
  };

  const d = designSize();

  return (
    <section
      className={`stage ${dragging ? 'dragging' : ''} ${panning ? 'panning' : ''} ${space ? 'space-ready' : ''}`}
      ref={stageRef}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
      onPointerDown={(e) => {
        if (startPan(e)) return;
        if (ui.exportOpen && !(e.target as HTMLElement).closest('.popover,.bb-export')) setUi({ exportOpen: false });
      }}
    >
      <div className="stage-view" style={{ paddingTop: padTop - padBottom > 0 ? 0 : 0 }}>
        <div
          className={`canvas-wrap ${transparent ? 'checker' : ''}`}
          style={{
            width: dispW,
            height: dispH,
            transform: `translate(${pan.x}px, ${pan.y + (padTop - padBottom) / 2}px)`,
            visibility: source ? 'visible' : 'hidden',
          }}
          onPointerMove={onMove}
        >
          <div ref={hostRef} className="canvas-host" />
          {source && ui.compare && <CompareOverlay />}
          {source && ui.tool === 'crop' && <CropOverlay />}
          {source && <TextOverlay active={ui.tool === 'text'} />}
          {source && <MaskOverlay aspect={aspect} />}
        </div>
      </div>

      {!source && (
        <div className="empty" onClick={(e) => e.target === e.currentTarget && pickFile()}>
          <div className="empty-drop" />
          <div className="empty-icon"><ImageIcon size={58} strokeWidth={1} /></div>
          {glError && <div className="empty-title" style={{ color: '#ff8a8a', marginBottom: 8 }}>WebGL2 is not available — try a recent Chrome, Edge, Firefox or Safari.</div>}
          <div className="empty-title">Drop an image or video here</div>
          <div className="empty-sub">or click to browse / paste from clipboard</div>
          <div className="empty-row">
            <button className="btn-outline" onClick={() => inspire()}><Lightbulb size={15} /> Inspire Me</button>
            <button className="btn-outline" onClick={() => pickFile()}><Upload size={15} /> Upload</button>
            <button className="btn-outline" onClick={() => startWebcam()}><Camera size={15} /> Webcam</button>
          </div>
        </div>
      )}

      {source && animating && (
        <div className="hud">
          <span>{d.w}×{d.h}</span>
          <span>{fps} fps</span>
        </div>
      )}

      {source && (animating || source.kind === 'video') && (
        <button className="btn-outline play-btn" onClick={togglePlay} title="Play / pause (K)">
          {ui.playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      )}

      <div className="bottombar" role="toolbar" aria-label="Actions">
        <button className="bb-btn" onClick={() => pickFile()} title="Upload (O)"><Upload size={15} /><span className="lbl">Upload</span></button>
        <button className="bb-btn" onClick={() => inspire()} title="Random demo source (I)"><Lightbulb size={15} /><span className="lbl">Inspire</span></button>
        <button className="bb-btn" onClick={restyle} disabled={!source} title="Re-roll this style's settings (R)"><RefreshCw size={15} /><span className="lbl">Restyle</span></button>
        <button className="bb-btn" onClick={shuffle} disabled={!source} title="Random style (S)"><Shuffle size={15} /><span className="lbl">Shuffle</span></button>
        <button className="bb-btn" onClick={() => setUi({ modal: 'library' })} title="Library"><LayoutGrid size={15} /><span className="lbl">Library</span></button>
        <span className="bb-sep" />
        <button className={`bb-btn bb-export ${ui.exportOpen ? 'open' : ''}`} onClick={() => setUi({ exportOpen: !ui.exportOpen })} disabled={!source} title="Export (E)">
          <Download size={15} /><span className="lbl">Export</span>
        </button>
        {ui.exportOpen && <ExportPopover style={{ bottom: 'calc(100% + 10px)', right: 0 }} />}
      </div>
    </section>
  );
}

function CompareOverlay() {
  const x = useStore((s) => s.ui.compareX);
  const ref = useRef<HTMLDivElement>(null);
  const start = (e: React.PointerEvent) => {
    e.stopPropagation();
    const wrap = ref.current?.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const move = (ev: PointerEvent) => setUi({ compareX: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} className="compare-line" style={{ left: `${x * 100}%` }} onPointerDown={start}>
      <span className="compare-tag" style={{ right: 10 }}>ORIGINAL</span>
      <span className="compare-tag" style={{ left: 10 }}>EFFECT</span>
      <span className="compare-knob"><ArrowLeftRight size={14} /></span>
    </div>
  );
}

