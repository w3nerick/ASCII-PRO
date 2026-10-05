import { useMemo } from 'react';
import { ChevronLeft, Maximize2, Search, Star, X } from 'lucide-react';
import { CATEGORIES, STYLES, stylesIn } from '../engine/styles';
import type { StyleDef } from '../engine/types';
import { activeLayer, addLayer, replaceLook, setStyle, setUi, toggleFavorite, useStore } from '../state/store';
import { styleThumbLook } from '../state/renderer';
import { CURATED, type CuratedRecipe } from '../state/recipes';
import { GENERATORS, loadGenerator } from '../state/source';
import { Thumb, GenThumb } from './Thumb';

export function StyleCard({ style, size = 'md' }: { style: StyleDef; size?: 'sm' | 'md' | 'lg' }) {
  const active = useStore((s) => activeLayer(s).styleId === style.id);
  const fav = useStore((s) => s.ui.favorites.includes(style.id));
  const look = styleThumbLook(style.id);
  return (
    <div
      role="button"
      tabIndex={0}
      className={`card ${active ? 'on' : ''} ${size === 'lg' ? 'featured' : ''}`}
      onClick={(e) => (e.shiftKey || e.altKey ? addLayer(style.id) : setStyle(style.id))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setStyle(style.id);
        }
      }}
      title={`${style.name} — click to apply, Shift+click to add as a layer`}
    >
      <div style={{ position: 'relative' }}>
        <Thumb thumbKey={`style:${style.id}`} look={look} icon={style.icon} />
        {size === 'lg' ? <span className="card-badge">New this week</span> : style.isNew ? <span className="card-badge">New</span> : null}
        <button
          className={`card-fav ${fav ? 'on' : ''}`}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(style.id);
          }}
        >
          <Star size={13} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="card-name">{style.name}</div>
      {size !== 'sm' && <div className="card-tags">{style.tags.join(' · ')}</div>}
    </div>
  );
}

function RecipeCard({ r }: { r: CuratedRecipe }) {
  const look = useMemo(() => r.build(), [r]);
  return (
    <div role="button" tabIndex={0} className="card" onClick={() => replaceLook(r.build())} title={`Apply recipe: ${r.name}`}>
      <Thumb thumbKey={`recipe:${r.id}`} look={look} icon="✦" />
      <div className="card-name">{r.name}</div>
      <div className="card-tags">{r.tags}</div>
    </div>
  );
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SUGGEST_POOL = ['lego', 'ascii-studio', 'neon-grid', 'halftone', 'dither', 'pixel-art', 'risograph', 'edge-glow', 'voxel', 'braille', 'crt-screen', 'vitrine', 'comic', 'dots', 'fluted-glass'];

export function StylesPanel() {
  const ui = useStore((s) => s.ui);
  const sourceName = useStore((s) => s.source?.name || 'demo');
  const q = ui.search.trim().toLowerCase();

  const suggested = useMemo(() => {
    const h = hashStr(sourceName);
    const out: StyleDef[] = [];
    for (let i = 0; out.length < 3 && i < 20; i++) {
      const id = SUGGEST_POOL[(h + i * 7) % SUGGEST_POOL.length];
      const s = STYLES.find((x) => x.id === id);
      if (s && !out.includes(s)) out.push(s);
    }
    return out;
  }, [sourceName]);

  const featured = useMemo(() => {
    const news = STYLES.filter((s) => s.isNew);
    return news[Math.floor(Date.now() / (7 * 864e5)) % Math.max(1, news.length)] || STYLES[0];
  }, []);

  const filtered = useMemo(() => {
    if (!q) return null;
    return STYLES.filter((s) => s.name.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q)) || CATEGORIES.find((c) => c.id === s.category)!.label.toLowerCase().includes(q));
  }, [q]);

  const favorites = STYLES.filter((s) => ui.favorites.includes(s.id));

  return (
    <aside className="left" aria-label="Styles">
      <div className="left-head">
        <h2>Styles</h2>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" title="Browse all styles" onClick={() => setUi({ modal: 'allStyles' })}>
            <Maximize2 size={15} />
          </button>
          <button className="icon-btn" title="Collapse panel" onClick={() => setUi({ leftOpen: false })}>
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>
      <div className="seg-wide">
        <button className={ui.stylesTab === 'realtime' ? 'on' : ''} onClick={() => setUi({ stylesTab: 'realtime' })}>Realtime</button>
        <button className={ui.stylesTab === 'generative' ? 'on' : ''} onClick={() => setUi({ stylesTab: 'generative' })}>Generative</button>
      </div>
      {ui.stylesTab === 'realtime' ? (
        <>
          <label className="search">
            <Search size={15} />
            <input
              placeholder="Search name or tag"
              value={ui.search}
              onChange={(e) => setUi({ search: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
            {ui.search && (
              <button className="icon-btn sm" onClick={() => setUi({ search: '' })} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </label>
          <div className="tabs">
            {(['explore', 'favorites', 'recipes'] as const).map((t) => (
              <button key={t} className={ui.exploreTab === t ? 'on' : ''} onClick={() => setUi({ exploreTab: t })}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="left-scroll scroll">
            {filtered ? (
              filtered.length ? (
                <>
                  <div className="cat-label">{filtered.length} results</div>
                  <div className="grid2">{filtered.map((s) => <StyleCard key={s.id} style={s} />)}</div>
                </>
              ) : (
                <div className="empty-note">No styles match “{ui.search}”.</div>
              )
            ) : ui.exploreTab === 'explore' ? (
              <>
                <div className="cat-label">Suggested for this image</div>
                <div className="grid3">{suggested.map((s) => <StyleCard key={s.id} style={s} size="sm" />)}</div>
                <div style={{ height: 14 }} />
                <StyleCard style={featured} size="lg" />
                {CATEGORIES.map((c) => (
                  <div key={c.id}>
                    <div className="cat-title">{c.label}</div>
                    <div className="grid2">{stylesIn(c.id).map((s) => <StyleCard key={s.id} style={s} />)}</div>
                  </div>
                ))}
              </>
            ) : ui.exploreTab === 'favorites' ? (
              favorites.length ? (
                <>
                  <div className="cat-label">Your favorites</div>
                  <div className="grid2">{favorites.map((s) => <StyleCard key={s.id} style={s} />)}</div>
                </>
              ) : (
                <div className="empty-note">Tap the ☆ on any style to keep it here.</div>
              )
            ) : (
              <>
                <div className="cat-label">Curated recipes</div>
                <div className="grid2">{CURATED.map((r) => <RecipeCard key={r.id} r={r} />)}</div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="left-scroll scroll" style={{ paddingTop: 10 }}>
          <div className="cat-label">Animated generators</div>
          <div className="grid2">
            {GENERATORS.filter((g) => g.kind === 'lumen').map((g) => (
              <div key={g.id} role="button" tabIndex={0} className="card" onClick={() => loadGenerator(g)} title={`Use ${g.label} as the source`}>
                <GenThumb gen={g} />
                <div className="card-name">{g.label}</div>
                <div className="card-tags">Shader · Animated</div>
              </div>
            ))}
          </div>
          <div className="cat-title">Procedural scenes</div>
          <div className="grid2">
            {GENERATORS.filter((g) => g.kind === 'canvas').map((g) => (
              <div key={g.id} role="button" tabIndex={0} className="card" onClick={() => loadGenerator(g)}>
                <GenThumb gen={g} />
                <div className="card-name">{g.label}</div>
                <div className="card-tags">Canvas · Still</div>
              </div>
            ))}
          </div>
          <div className="empty-note">Generators become the source image — every style and effect works on top of them.</div>
        </div>
      )}
    </aside>
  );
}
