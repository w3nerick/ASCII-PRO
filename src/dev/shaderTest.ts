// Dev-only: renders every style on a sample photo into a contact sheet.
import { Engine } from '../engine/engine';
import { STYLES, makeLayer } from '../engine/styles';
import { defaultLook } from '../state/defaults';
import { loadGlyphFonts } from '../engine/glyphAtlas';

const out = document.getElementById('out')!;
const log = (s: string) => { out.textContent += s + '\n'; };
const params = new URLSearchParams(location.search);
const sample = params.get('img') || 'portrait';
const from = Number(params.get('from') || 0);
const count = Number(params.get('n') || 50);

(async () => {
  await loadGlyphFonts();
  const canvas = document.createElement('canvas');
  const eng = new Engine(canvas, { blockingCompile: true });
  const img = new Image();
  img.src = `/samples/${sample}.webp`;
  await img.decode();
  eng.setSource({ el: img, width: img.naturalWidth, height: img.naturalHeight, dynamic: false });
  const W = 300, H = 200, cols = 10;
  const list = STYLES.slice(from, from + count);
  const sheet = document.createElement('canvas');
  sheet.width = cols * W;
  sheet.height = Math.ceil(list.length / cols) * (H + 18);
  sheet.style.width = '100%';
  document.body.appendChild(sheet);
  const ctx = sheet.getContext('2d')!;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const fails: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const look = defaultLook(s.id);
    look.layers = [makeLayer(s.id)];
    eng.setLook(look);
    eng.setSize(W, H, 0.45);
    const ok = eng.render(1.5);
    if (!ok) fails.push(s.id);
    const x = (i % cols) * W, y = Math.floor(i / cols) * (H + 18);
    ctx.drawImage(canvas, x, y + 18, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    ctx.fillText(`${from + i} ${s.id}`, x + 4, y + 13);
  }
  log(`rendered ${list.length}, failed: ${fails.join(', ') || 'none'}`);
  (window as unknown as { __done: boolean }).__done = true;
})();
