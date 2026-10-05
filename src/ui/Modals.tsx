import { useEffect, useMemo, useState } from 'react';
import { X, Zap, Share2, Sparkles, Link2, Save, Trash2, Search } from 'lucide-react';
import { CATEGORIES, getStyle, stylesIn, STYLES } from '../engine/styles';
import { activeLayer, getState, replaceLook, setUi, toast, useStore } from '../state/store';
import { decodeRecipe, encodeRecipe, recipeUrl } from '../state/recipes';
import { deleteLibrary, listLibrary, saveLibrary, type LibraryItem } from '../state/library';
import { exportStill } from '../state/renderer';
import { getSourceBlob, loadImageBlob, loadSample, SAMPLES } from '../state/source';
import { StyleCard } from './StylesPanel';

function Modal({ children, wide, onClose, label }: { children: React.ReactNode; wide?: boolean; onClose: () => void; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

const close = () => setUi({ modal: null });

async function copy(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    toast('Clipboard not available');
  }
}

export function RecipesModal() {
  const look = useStore((s) => s.doc.look);
  const [code, setCode] = useState('');
  const [apply, setApply] = useState('');
  const [showApply, setShowApply] = useState(false);
  const styleName = useStore((s) => getStyle(activeLayer(s).styleId).name);
  useEffect(() => {
    let alive = true;
    encodeRecipe(look).then((c) => alive && setCode(c));
    return () => {
      alive = false;
    };
  }, [look]);
  const doApply = async () => {
    const l = await decodeRecipe(apply);
    if (!l) return toast('That recipe code is not valid');
    replaceLook(l);
    toast('Recipe applied');
    close();
  };
  return (
    <Modal onClose={close} label="Recipes">
      <div className="modal-head">
        <span className="eyebrow">Your look, one link</span>
        <h3>Recipes</h3>
        <p>Bottle your current settings and pass them on.</p>
      </div>
      <div className="modal-body">
        <div className="muted" style={{ marginBottom: 12 }}>How it works:</div>
        <div className="how">
          <div><Zap size={16} /> Copy your recipe link or code</div>
          <div><Share2 size={16} /> Share it anywhere — a chat, a DM, a gist</div>
          <div><Sparkles size={16} /> Whoever opens it gets your exact settings; their image stays theirs</div>
        </div>
        <button className="btn-solid" style={{ width: '100%' }} disabled={!code} onClick={() => copy(recipeUrl(code), 'Recipe link copied')}>
          <Link2 size={15} /> Copy recipe link
        </button>
        <div className="modal-actions" style={{ marginTop: 8 }}>
          <button className="btn-outline" style={{ flex: 1, justifyContent: 'center', height: 36 }} disabled={!code} onClick={() => copy(code, 'Recipe code copied')}>Copy code</button>
        </div>
        <div className="muted" style={{ marginTop: 12 }}>Captured: {styleName}{look.layers.length > 1 ? ` + ${look.layers.length - 1} layer(s)` : ''}.</div>
        {code && <div className="code-box">{code}</div>}
        <div style={{ marginTop: 16 }}>
          {showApply ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="text-input" placeholder="Paste a recipe code or link" value={apply} onChange={(e) => setApply(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') doApply(); }} />
              <button className="btn-solid" style={{ height: 32 }} onClick={doApply}>Apply</button>
            </div>
          ) : (
            <button className="link-btn" onClick={() => setShowApply(true)}>Have a recipe code? Apply one →</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function LibraryModal() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const source = useStore((s) => s.source);
  const refresh = async () => {
    const list = await listLibrary();
    setItems(list);
    const u: Record<string, string> = {};
    list.forEach((it) => (u[it.id] = URL.createObjectURL(it.thumb)));
    setUrls((old) => {
      Object.values(old).forEach((x) => URL.revokeObjectURL(x));
      return u;
    });
  };
  useEffect(() => {
    refresh();
    return () => setUrls((old) => {
      Object.values(old).forEach((x) => URL.revokeObjectURL(x));
      return {};
    });
  }, []);
  const save = async () => {
    const s = getState();
    const thumb = await exportStill('jpg', 0.3);
    if (!thumb) return toast('Add an image first');
    const blob = getSourceBlob();
    await saveLibrary({
      id: `w${Date.now().toString(36)}`,
      name: `${getStyle(activeLayer(s).styleId).name} · ${s.source?.name || 'image'}`,
      created: Date.now(),
      thumb,
      look: s.doc.look,
      source: blob && blob.size < 15e6 && s.source?.kind === 'image' ? blob : undefined,
      sourceName: s.source?.name,
    });
    toast('Saved to library');
    refresh();
  };
  const open = async (it: LibraryItem) => {
    if (it.source) await loadImageBlob(it.source, it.sourceName || 'image');
    replaceLook(it.look);
    close();
  };
  return (
    <Modal onClose={close} wide label="Library">
      <div className="modal-head">
        <span className="eyebrow">Stored on this device</span>
        <h3>Library</h3>
        <p>Your saved looks. Images stay in your browser — nothing is uploaded.</p>
      </div>
      <div className="modal-body">
        <div className="cat-label" style={{ marginTop: 0 }}>Sample images</div>
        <div className="lib-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', marginBottom: 22 }}>
          {SAMPLES.map((sm) => (
            <div key={sm.id} className="lib-item card" role="button" tabIndex={0} onClick={() => { loadSample(sm.id); close(); }}>
              <img src={sm.url} alt="" loading="lazy" />
              <div className="card-name">{sm.label}</div>
            </div>
          ))}
        </div>
        <div className="cat-label">Saved works</div>
        <button className="btn-solid" disabled={!source} onClick={save} style={{ marginBottom: 18 }}><Save size={15} /> Save current work</button>
        {items === null ? (
          <div className="muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-note">Nothing saved yet.</div>
        ) : (
          <div className="lib-grid">
            {items.map((it) => (
              <div key={it.id} className="lib-item card" role="button" tabIndex={0} onClick={() => open(it)}>
                <img src={urls[it.id]} alt="" />
                <div className="card-name">{it.name}</div>
                <div className="card-tags">{new Date(it.created).toLocaleString()}{it.source ? '' : ' · look only'}</div>
                <button className="icon-btn sm del" title="Delete" onClick={async (e) => { e.stopPropagation(); await deleteLibrary(it.id); refresh(); }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Upload image / video', 'O'],
  ['Paste image', '⌘V'],
  ['Inspire (random source)', 'I'],
  ['Restyle (re-roll settings)', 'R'],
  ['Shuffle (random style)', 'S'],
  ['Previous / next style', '[  ]'],
  ['Export', 'E'],
  ['Undo / Redo', '⌘Z  ⇧⌘Z'],
  ['Compare before/after', 'B'],
  ['Crop & rotate', 'C'],
  ['Add text', 'T'],
  ['Mask painting', 'M'],
  ['Play / pause animation', 'K'],
  ['Zoom in / out / fit', '+  −  F'],
  ['Pan', 'Space + drag'],
  ['Toggle panels', '⌘\\'],
  ['Close tool / popover', 'Esc'],
];

export function HelpModal() {
  return (
    <Modal onClose={close} label="Shortcuts">
      <div className="modal-head">
        <h3>Shortcuts</h3>
        <p>Everything runs locally on your GPU. Shift+click a style to stack it as a layer.</p>
      </div>
      <div className="modal-body">
        <div className="help-grid">
          {SHORTCUTS.map(([a, b]) => (
            <div key={a} style={{ display: 'contents' }}>
              <span>{a}</span>
              <span className="kbd">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function AllStylesModal() {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? STYLES.filter((x) => x.name.toLowerCase().includes(s) || x.tags.some((t) => t.includes(s))) : null;
  }, [q]);
  return (
    <Modal onClose={close} wide label="All styles">
      <div className="modal-head">
        <h3>All styles</h3>
        <p>{STYLES.length} realtime styles. Click to apply — Shift+click to add as a layer.</p>
        <label className="search" style={{ margin: '14px 0 0', maxWidth: 360 }}>
          <Search size={15} />
          <input autoFocus placeholder="Search name or tag" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        </label>
      </div>
      <div className="modal-body all-styles">
        {list ? (
          <div className="grid-all">{list.map((s) => <StyleCard key={s.id} style={s} />)}</div>
        ) : (
          CATEGORIES.map((c) => (
            <div key={c.id}>
              <div className="cat-title" style={{ marginTop: 6 }}>{c.label}</div>
              <div className="grid-all">{stylesIn(c.id).map((s) => <StyleCard key={s.id} style={s} />)}</div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

export function Toast() {
  const t = useStore((s) => s.ui.toast);
  if (!t) return null;
  return <div className="toast" role="status" key={t.id}>{t.text}</div>;
}
