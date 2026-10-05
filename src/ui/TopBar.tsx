import { ZoomIn, ZoomOut, Crop, Columns2, Type, Undo2, Redo2, Layers3, Camera, HelpCircle, PanelLeft, PanelRight, X } from 'lucide-react';
import { redo, setUi, undo, useStore } from '../state/store';
import { startWebcam, clearSource } from '../state/source';
import { addText } from './overlays/TextOverlay';

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 1.5l1.9 5.2 5.6.3-4.4 3.4 1.6 5.4L10 12.7l-4.7 3.1 1.6-5.4L2.5 7l5.6-.3z" fill="#f5d36b" />
      <rect x="15" y="1.5" width="3" height="3" fill="#fff" />
      <rect x="2" y="15.5" width="2.4" height="2.4" fill="#fff" opacity="0.8" />
    </svg>
  );
}

export function TopBar() {
  const ui = useStore((s) => s.ui);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const source = useStore((s) => s.source);
  const zoom = ui.zoom || 100;
  const setZoom = (z: number) => setUi({ zoom: Math.abs(z - 100) < 1 ? 0 : Math.max(10, Math.min(800, Math.round(z))) });
  return (
    <header className="topbar">
      <div className="tb-left">
        <div className="logo"><LogoMark /> ASCII PRO</div>
        <div className="seg mode" role="tablist">
          <button className={ui.mode === 'studio' ? 'on' : ''} onClick={() => setUi({ mode: 'studio' })}>Studio</button>
          <button className={ui.mode === 'flow' ? 'on' : ''} onClick={() => setUi({ mode: 'flow', tool: 'none' })}>Flow</button>
        </div>
        {source && (
          <span className="src-name" title={source.name}>
            {source.name} · {source.width}×{source.height}
          </span>
        )}
      </div>
      <div className="tb-center">
        <button className="tb-btn tip below" data-tip="Zoom out" onClick={() => setZoom(zoom / 1.25)} disabled={!source}><ZoomOut size={16} /></button>
        <button className="tb-zoom" title="Fit to screen (F)" onClick={() => setUi({ zoom: 0 })}>{Math.round(zoom)}%</button>
        <button className="tb-btn tip below" data-tip="Zoom in" onClick={() => setZoom(zoom * 1.25)} disabled={!source}><ZoomIn size={16} /></button>
        <span className="tb-sep" />
        <button className={`tb-btn tip below ${ui.tool === 'crop' ? 'on' : ''}`} data-tip="Crop & rotate (C)" disabled={!source || ui.mode === 'flow'} onClick={() => setUi({ tool: ui.tool === 'crop' ? 'none' : 'crop' })}><Crop size={16} /></button>
        <button className={`tb-btn tip below ${ui.compare ? 'on' : ''}`} data-tip="Compare before / after (B)" disabled={!source} onClick={() => setUi({ compare: !ui.compare })}><Columns2 size={16} /></button>
        <span className="tb-sep" />
        <button className={`tb-btn tip below ${ui.tool === 'text' ? 'on' : ''}`} data-tip="Add text (T)" disabled={!source || ui.mode === 'flow'} onClick={() => (ui.tool === 'text' ? setUi({ tool: 'none' }) : addText())}><Type size={16} /></button>
        <span className="tb-sep" />
        <button className="tb-btn tip below" data-tip="Undo (⌘Z)" disabled={!canUndo} onClick={undo}><Undo2 size={16} /></button>
        <button className="tb-btn tip below" data-tip="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo}><Redo2 size={16} /></button>
        <span className="tb-sep" />
        <button className="tb-btn tip below" data-tip="Recipes — share your look" onClick={() => setUi({ modal: 'recipes' })}><Layers3 size={16} /></button>
      </div>
      <div className="tb-right">
        <button className="icon-btn tip below" data-tip="Webcam" onClick={() => startWebcam()}><Camera size={16} /></button>
        {source && <button className="icon-btn tip below" data-tip="Close image" onClick={() => clearSource()}><X size={16} /></button>}
        <button className="icon-btn tip below panel-toggle" data-tip="Toggle styles panel" onClick={() => setUi({ leftOpen: !ui.leftOpen })}><PanelLeft size={16} /></button>
        <button className="icon-btn tip below panel-toggle" data-tip="Toggle settings panel" onClick={() => setUi({ rightOpen: !ui.rightOpen })}><PanelRight size={16} /></button>
        <button className="tb-chip" onClick={() => setUi({ modal: 'help' })}><HelpCircle size={14} /> Shortcuts</button>
      </div>
    </header>
  );
}
