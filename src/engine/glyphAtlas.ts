// Renders a character ramp into a texture atlas (white glyphs on transparent).

export const ATLAS_CELL = 64;

export const GLYPH_FONTS = [
  { label: 'Mono', css: '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace', weight: 500 },
  { label: 'Mono Bold', css: '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace', weight: 800 },
  { label: 'Pixel', css: '"Geist Pixel", "Geist Mono", ui-monospace, monospace', weight: 400 },
  { label: 'Sans', css: '"Geist", -apple-system, "Segoe UI", sans-serif', weight: 600 },
  { label: 'Serif', css: 'Georgia, "Times New Roman", serif', weight: 600 },
];

export interface GlyphAtlas {
  canvas: HTMLCanvasElement;
  count: number;
  cols: number;
  rows: number;
  key: string;
  chars: string[];
}

const cache = new Map<string, GlyphAtlas>();

export function splitGlyphs(text: string): string[] {
  // Keep grapheme-ish units (handles emoji + surrogate pairs reasonably).
  const seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (seg) return Array.from(new seg(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  return Array.from(text);
}

export function buildAtlas(text: string, fontIdx = 0): GlyphAtlas {
  const key = fontIdx + '|' + text;
  const hit = cache.get(key);
  if (hit) return hit;
  let chars = splitGlyphs(text || ' ');
  if (chars.length === 0) chars = [' '];
  if (chars.length > 256) chars = chars.slice(0, 256);
  const count = chars.length;
  const cols = Math.min(16, count);
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * ATLAS_CELL;
  canvas.height = rows * ATLAS_CELL;
  const ctx = canvas.getContext('2d')!;
  const font = GLYPH_FONTS[fontIdx] || GLYPH_FONTS[0];
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.round(ATLAS_CELL * 0.86);
  ctx.font = `${font.weight} ${size}px ${font.css}`;
  for (let i = 0; i < count; i++) {
    const cx = (i % cols) * ATLAS_CELL + ATLAS_CELL / 2;
    const cy = Math.floor(i / cols) * ATLAS_CELL + ATLAS_CELL / 2;
    const ch = chars[i];
    // Shrink very wide glyphs (emoji, CJK) to fit the cell.
    const w = ctx.measureText(ch).width;
    if (w > ATLAS_CELL * 0.98) {
      const s = (ATLAS_CELL * 0.98) / w;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.fillText(ch, 0, ATLAS_CELL * 0.04);
      ctx.restore();
    } else {
      ctx.fillText(ch, cx, cy + ATLAS_CELL * 0.04);
    }
  }
  const atlas = { canvas, count, cols, rows, key, chars };
  cache.set(key, atlas);
  if (cache.size > 40) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  return atlas;
}

export async function loadGlyphFonts() {
  try {
    await Promise.all([
      document.fonts.load('500 48px "Geist Mono"'),
      document.fonts.load('400 48px "Geist Pixel"'),
      document.fonts.load('600 48px "Geist"'),
    ]);
  } catch {
    /* fonts are optional */
  }
  cache.clear();
}
