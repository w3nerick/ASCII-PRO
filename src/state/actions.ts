import { STYLES, getStyle, makeLayer, randomParams } from '../engine/styles';
import { activeLayer, getState, setLayerParam, updateDoc, updateLook } from './store';
import { DEFAULT_POST } from './defaults';
import type { PostSettings } from '../engine/types';

/** Re-roll the parameters of the current style. */
export function restyle() {
  const layer = activeLayer();
  const style = getStyle(layer.styleId);
  const params = randomParams(style, layer.params);
  updateDoc((d) => ({
    ...d,
    look: { ...d.look, layers: d.look.layers.map((l) => (l.id === layer.id ? { ...l, params } : l)) },
  }));
}

const FX_POOL: (keyof PostSettings)[] = ['bloom', 'vignette', 'grain', 'scanlines', 'chromatic', 'glow', 'crt', 'rgbSplit'];

/** Random style + params + a sprinkle of post FX. */
export function shuffle() {
  const cur = activeLayer().styleId;
  let style = STYLES[Math.floor(Math.random() * STYLES.length)];
  if (style.id === cur) style = STYLES[(STYLES.indexOf(style) + 7) % STYLES.length];
  const params = randomParams(style, undefined);
  const layer = { ...makeLayer(style.id, params) };
  const post: PostSettings = JSON.parse(JSON.stringify(DEFAULT_POST));
  const n = Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const k = FX_POOL[Math.floor(Math.random() * FX_POOL.length)];
    (post[k] as { on: boolean }).on = true;
  }
  updateDoc((d) => {
    const layers = d.look.layers.map((l) => (l.id === d.activeLayer ? { ...layer, id: l.id } : l));
    return { ...d, look: { ...d.look, layers, post } };
  });
}

/** Step through styles with [ and ]. */
export function stepStyle(dir: 1 | -1) {
  const cur = activeLayer().styleId;
  const i = STYLES.findIndex((s) => s.id === cur);
  const next = STYLES[(i + dir + STYLES.length) % STYLES.length];
  const layer = activeLayer();
  updateDoc((d) => ({
    ...d,
    look: { ...d.look, layers: d.look.layers.map((l) => (l.id === layer.id ? { ...makeLayer(next.id), id: l.id, opacity: l.opacity, blend: l.blend } : l)) },
  }));
}

export function resetLook() {
  const s = getState();
  const layer = activeLayer(s);
  updateLook((l) => ({ ...l, layers: l.layers.map((x) => (x.id === layer.id ? { ...makeLayer(x.styleId), id: x.id } : x)) }));
}

export { setLayerParam };
