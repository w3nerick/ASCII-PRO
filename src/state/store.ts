// Tiny external store (useSyncExternalStore) with undo/redo for the document.
import { useSyncExternalStore } from 'react';
import type { CropRect, Layer, Look, ParamValue, TextItem, Transform } from '../engine/types';
import { getStyle, makeLayer, normalizeParams } from '../engine/styles';
import { defaultLook } from './defaults';

export interface Doc {
  look: Look;
  activeLayer: string;
  crop: CropRect | null;
  transform: Transform;
  texts: TextItem[];
}

export type RightTab = 'style' | 'layers' | 'depth' | 'animation' | 'lights' | 'color' | 'post' | 'mask';
export type Tool = 'none' | 'crop' | 'text' | 'mask';

export interface SourceMeta {
  kind: 'image' | 'video' | 'webcam' | 'generative';
  name: string;
  width: number;
  height: number;
  generator?: number;
}

export interface Ui {
  mode: 'studio' | 'flow';
  rightTab: RightTab;
  leftOpen: boolean;
  rightOpen: boolean;
  stylesTab: 'realtime' | 'generative';
  exploreTab: 'explore' | 'favorites' | 'recipes';
  search: string;
  zoom: number; // 0 = fit
  compare: boolean;
  compareX: number;
  tool: Tool;
  selectedText: string | null;
  exportOpen: boolean;
  modal: null | 'recipes' | 'library' | 'help' | 'allStyles' | 'webcam';
  favorites: string[];
  playing: boolean;
  mobilePanel: null | 'styles' | 'settings';
  toast: { id: number; text: string } | null;
}

export interface State {
  doc: Doc;
  ui: Ui;
  source: SourceMeta | null;
  past: Doc[];
  future: Doc[];
}

const FAV_KEY = 'asciipro.favorites.v2';

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : ['characters', 'dither', 'halftone'];
  } catch {
    return ['characters', 'dither', 'halftone'];
  }
}

function initialDoc(): Doc {
  const look = defaultLook('characters');
  return { look, activeLayer: look.layers[0].id, crop: null, transform: { rotate: 0, flipX: false, flipY: false }, texts: [] };
}

let state: State = {
  doc: initialDoc(),
  ui: {
    mode: 'studio',
    rightTab: 'style',
    leftOpen: true,
    rightOpen: true,
    stylesTab: 'realtime',
    exploreTab: 'explore',
    search: '',
    zoom: 0,
    compare: false,
    compareX: 0.5,
    tool: 'none',
    selectedText: null,
    exportOpen: false,
    modal: null,
    favorites: loadFavorites(),
    playing: true,
    mobilePanel: null,
    toast: null,
  },
  source: null,
  past: [],
  future: [],
};

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((l) => l());

export const getState = () => state;
export const subscribeStore = subscribe;

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

/* ───────── History ───────── */

const HISTORY_MAX = 80;
let lastKey = '';
let lastTime = 0;

/**
 * Update the document. Changes with the same `key` within 700 ms merge into one
 * history entry (e.g. dragging a slider).
 */
export function updateDoc(fn: (d: Doc) => Doc, key = '', history = true) {
  const prev = state.doc;
  const next = fn(prev);
  if (next === prev) return;
  const now = performance.now();
  let past = state.past;
  if (history) {
    const merge = key && key === lastKey && now - lastTime < 700;
    if (!merge) past = [...past.slice(-HISTORY_MAX + 1), prev];
    lastKey = key;
    lastTime = now;
  }
  state = { ...state, doc: next, past, future: history ? [] : state.future };
  emit();
}

export function undo() {
  if (!state.past.length) return;
  const prev = state.past[state.past.length - 1];
  state = { ...state, doc: prev, past: state.past.slice(0, -1), future: [state.doc, ...state.future] };
  lastKey = '';
  emit();
}

export function redo() {
  if (!state.future.length) return;
  const [next, ...rest] = state.future;
  state = { ...state, doc: next, past: [...state.past, state.doc], future: rest };
  lastKey = '';
  emit();
}

export function setUi(patch: Partial<Ui>) {
  state = { ...state, ui: { ...state.ui, ...patch } };
  emit();
}

export function setSourceMeta(meta: SourceMeta | null) {
  state = { ...state, source: meta };
  emit();
}

let toastId = 0;
export function toast(text: string) {
  toastId += 1;
  const id = toastId;
  setUi({ toast: { id, text } });
  setTimeout(() => {
    if (state.ui.toast?.id === id) setUi({ toast: null });
  }, 2600);
}

export function toggleFavorite(styleId: string) {
  const favs = state.ui.favorites.includes(styleId) ? state.ui.favorites.filter((f) => f !== styleId) : [...state.ui.favorites, styleId];
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch {
    /* storage unavailable */
  }
  setUi({ favorites: favs });
}

/* ───────── Look helpers ───────── */

export function updateLook(fn: (l: Look) => Look, key = '') {
  updateDoc((d) => ({ ...d, look: fn(d.look) }), key);
}

export function patchLook<K extends keyof Look>(section: K, patch: Partial<Look[K]>, key = '') {
  updateLook((l) => ({ ...l, [section]: { ...(l[section] as object), ...(patch as object) } }), key || `${String(section)}:${Object.keys(patch).join(',')}`);
}

export function patchPost<K extends keyof Look['post']>(fx: K, patch: Partial<Look['post'][K]>) {
  updateLook((l) => ({ ...l, post: { ...l.post, [fx]: { ...l.post[fx], ...patch } } }), `post:${String(fx)}:${Object.keys(patch).join(',')}`);
}

export function activeLayer(s: State = state): Layer {
  return s.doc.look.layers.find((l) => l.id === s.doc.activeLayer) || s.doc.look.layers[0];
}

function mapLayer(id: string, fn: (l: Layer) => Layer) {
  updateLook((look) => ({ ...look, layers: look.layers.map((l) => (l.id === id ? fn(l) : l)) }), `layer:${id}`);
}

export function setLayerParam(layerId: string, key: string, value: ParamValue) {
  const layer = state.doc.look.layers.find((l) => l.id === layerId);
  if (!layer) return;
  const style = getStyle(layer.styleId);
  const def = style.params.find((p) => p.key === key);
  const params = { ...layer.params, [key]: value };
  if (def && def.type === 'select' && def.sets) {
    const idx = def.options.findIndex((o) => o.value === value);
    for (const [k, vals] of Object.entries(def.sets)) if (idx >= 0 && vals[idx] !== undefined) params[k] = vals[idx];
  }
  updateDoc((d) => ({
    ...d,
    look: { ...d.look, layers: d.look.layers.map((l) => (l.id === layerId ? { ...l, params } : l)) },
  }), `param:${layerId}:${key}`);
}

export function setLayerProps(layerId: string, patch: Partial<Layer>) {
  mapLayer(layerId, (l) => ({ ...l, ...patch }));
}

/** Change the style of the active layer, keeping backdrop settings when possible. */
export function setStyle(styleId: string, params?: Record<string, ParamValue>) {
  const cur = activeLayer();
  const style = getStyle(styleId);
  let next = params ? normalizeParams(style, params) : makeLayer(styleId).params;
  if (!params && cur) {
    const keep: Record<string, ParamValue> = {};
    for (const k of ['bdMode', 'bdSoftness', 'bdOpacity', 'bdColor']) if (k in cur.params && style.params.some((p) => p.key === k)) keep[k] = cur.params[k];
    if (getStyle(cur.styleId).backdrop && style.backdrop) next = { ...next, ...keep };
  }
  updateDoc((d) => ({
    ...d,
    look: { ...d.look, layers: d.look.layers.map((l) => (l.id === cur.id ? { ...l, styleId: style.id, params: next } : l)) },
  }), '');
}

export function addLayer(styleId: string) {
  const layer = makeLayer(styleId);
  updateDoc((d) => ({ ...d, activeLayer: layer.id, look: { ...d.look, layers: [...d.look.layers, layer] } }));
  setUi({ rightTab: 'style' });
}

export function removeLayer(id: string) {
  const layers = state.doc.look.layers;
  if (layers.length <= 1) return;
  const rest = layers.filter((l) => l.id !== id);
  updateDoc((d) => ({ ...d, activeLayer: d.activeLayer === id ? rest[rest.length - 1].id : d.activeLayer, look: { ...d.look, layers: rest } }));
}

export function moveLayer(id: string, dir: -1 | 1) {
  const layers = [...state.doc.look.layers];
  const i = layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layers.length) return;
  [layers[i], layers[j]] = [layers[j], layers[i]];
  updateDoc((d) => ({ ...d, look: { ...d.look, layers } }));
}

export function duplicateLayer(id: string) {
  const l = state.doc.look.layers.find((x) => x.id === id);
  if (!l) return;
  const copy = { ...makeLayer(l.styleId, l.params), opacity: l.opacity, blend: l.blend };
  updateDoc((d) => ({ ...d, activeLayer: copy.id, look: { ...d.look, layers: [...d.look.layers, copy] } }));
}

export function setActiveLayer(id: string) {
  state = { ...state, doc: { ...state.doc, activeLayer: id } };
  emit();
}

export function replaceLook(look: Look) {
  updateDoc((d) => ({ ...d, look, activeLayer: look.layers[0].id }));
}
