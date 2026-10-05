import { useState } from 'react';
import { getStyle } from '../engine/styles';
import { activeLayer, getState, setUi, toast, useStore } from '../state/store';
import { asciiGrid, designSize, exportGif, exportStill, needsClock, recordVideo, bestVideoMime } from '../state/renderer';
import { download, stamp } from './filePicker';

type Fmt = 'png' | 'jpg' | 'webp' | 'gif' | 'video' | 'txt' | 'html';

export function ExportPopover({ style }: { style?: React.CSSProperties }) {
  const source = useStore((s) => s.source);
  const st = useStore((s) => getStyle(activeLayer(s).styleId));
  const animated = useStore(() => needsClock());
  const [fmt, setFmt] = useState<Fmt>('png');
  const [scale, setScale] = useState(2);
  const [secs, setSecs] = useState(3);
  const [gifW, setGifW] = useState(640);
  const [gifFps, setGifFps] = useState(15);
  const [cols, setCols] = useState(120);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const d = designSize();
  const isVideo = source?.kind === 'video';
  const ext = bestVideoMime().ext;

  const name = (e: string) => `ascii-pro-${getStyle(activeLayer(getState()).styleId).id}-${stamp()}.${e}`;

  const run = async () => {
    if (!source || busy) return;
    setBusy(true);
    setProgress(0);
    try {
      if (fmt === 'png' || fmt === 'jpg' || fmt === 'webp') {
        await new Promise((r) => setTimeout(r, 20));
        const blob = await exportStill(fmt, scale);
        if (blob) download(blob, name(fmt));
      } else if (fmt === 'gif') {
        const blob = await exportGif({ seconds: secs, fps: gifFps, width: gifW, onProgress: setProgress });
        if (blob) download(blob, name('gif'));
      } else if (fmt === 'video') {
        const res = await recordVideo({ seconds: secs, fps: 30, onProgress: setProgress });
        if (res) download(res.blob, name(res.ext));
      } else {
        const grid = asciiGrid(cols);
        if (grid) {
          if (fmt === 'txt') download(new Blob([grid.lines.join('\n')], { type: 'text/plain' }), name('txt'));
          else {
            const esc = (c: string) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c);
            const body = grid.lines.map((line, y) => Array.from(line).map((c, x) => (c === ' ' ? ' ' : `<span style="color:${grid.colors[y][x]}">${esc(c)}</span>`)).join('')).join('\n');
            const html = `<!doctype html><html><head><meta charset="utf-8"><title>ASCII PRO</title><style>body{margin:0;background:#000;display:grid;place-items:center;min-height:100vh}pre{font:10px/1 "Geist Mono",ui-monospace,Menlo,monospace;letter-spacing:0}</style></head><body><pre>${body}</pre></body></html>`;
            download(new Blob([html], { type: 'text/html' }), name('html'));
          }
        }
      }
      toast('Exported');
      setUi({ exportOpen: false });
    } catch (e) {
      console.error(e);
      toast('Export failed');
    } finally {
      setBusy(false);
    }
  };

  const textOk = !!st.glyphs;
  const label = fmt === 'video' ? `Record ${ext.toUpperCase()}` : `Export ${fmt.toUpperCase()}`;

  return (
    <div className="popover" style={style} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Export">
      <h4>Export</h4>
      <div className="pop-label">Format</div>
      <div className="chip-row">
        {(['png', 'jpg', 'webp'] as Fmt[]).map((f) => (
          <button key={f} className={`chip ${fmt === f ? 'on' : ''}`} onClick={() => setFmt(f)}>{f.toUpperCase()}</button>
        ))}
        <button className={`chip ${fmt === 'gif' ? 'on' : ''}`} onClick={() => setFmt('gif')}>GIF</button>
        <button className={`chip ${fmt === 'video' ? 'on' : ''}`} onClick={() => setFmt('video')}>{ext.toUpperCase()}</button>
        {textOk && (
          <>
            <button className={`chip ${fmt === 'txt' ? 'on' : ''}`} onClick={() => setFmt('txt')}>TXT</button>
            <button className={`chip ${fmt === 'html' ? 'on' : ''}`} onClick={() => setFmt('html')}>HTML</button>
          </>
        )}
      </div>
      {(fmt === 'png' || fmt === 'jpg' || fmt === 'webp') && (
        <>
          <div className="pop-label">Resolution</div>
          <div className="chip-row">
            {[1, 2, 3, 4].map((s) => (
              <button key={s} className={`chip ${scale === s ? 'on' : ''}`} onClick={() => setScale(s)}>{s}×</button>
            ))}
          </div>
          <div className="pop-note">{d.w * scale} × {d.h * scale} px</div>
        </>
      )}
      {fmt === 'gif' && (
        <>
          <div className="pop-label">Duration</div>
          <div className="chip-row">{[2, 3, 5, 8].map((s) => <button key={s} className={`chip ${secs === s ? 'on' : ''}`} onClick={() => setSecs(s)}>{s}s</button>)}</div>
          <div className="pop-label">Width · FPS</div>
          <div className="chip-row">
            {[480, 640, 800].map((w) => <button key={w} className={`chip ${gifW === w ? 'on' : ''}`} onClick={() => setGifW(w)}>{w}</button>)}
            {[10, 15, 24].map((f) => <button key={f} className={`chip ${gifFps === f ? 'on' : ''}`} onClick={() => setGifFps(f)}>{f}fps</button>)}
          </div>
          {!animated && <div className="pop-note">Tip: turn on Animation for a moving GIF.</div>}
        </>
      )}
      {fmt === 'video' && (
        <>
          {isVideo ? (
            <div className="pop-note">Records the full video (max 60 s) in real time.</div>
          ) : (
            <>
              <div className="pop-label">Duration</div>
              <div className="chip-row">{[3, 5, 10, 15].map((s) => <button key={s} className={`chip ${secs === s ? 'on' : ''}`} onClick={() => setSecs(s)}>{s}s</button>)}</div>
              {!animated && <div className="pop-note">Static look — enable Animation to get motion.</div>}
            </>
          )}
        </>
      )}
      {(fmt === 'txt' || fmt === 'html') && (
        <>
          <div className="pop-label">Columns</div>
          <div className="chip-row">{[80, 120, 160, 220].map((c) => <button key={c} className={`chip ${cols === c ? 'on' : ''}`} onClick={() => setCols(c)}>{c}</button>)}</div>
          <div className="pop-note">Plain characters using the current character set.</div>
        </>
      )}
      <button className="btn-solid" disabled={!source || busy} onClick={run}>{busy ? 'Working…' : label}</button>
      {busy && fmt !== 'png' && fmt !== 'jpg' && fmt !== 'webp' && (
        <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      )}
      {!source && <div className="pop-note">Add an image first.</div>}
    </div>
  );
}
