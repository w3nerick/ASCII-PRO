// Verifies the style registry without a GPU: unique ids, reserved keys, valid defaults,
// showIf references, sample assets. Usage: npm run check   (also prints the catalog with --catalog)
import { build } from 'esbuild';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(mkdtempSync(join(tmpdir(), 'asciipro-')), 'registry.mjs');
await build({
  entryPoints: ['src/engine/styles/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});
const reg = await import(pathToFileURL(out).href);
const { STYLES, CATEGORIES } = reg;
const { RESERVED_KEYS } = await (async () => {
  const o2 = out.replace('registry', 'shader');
  await build({ entryPoints: ['src/engine/shaderLib.ts'], bundle: true, platform: 'node', format: 'esm', outfile: o2, logLevel: 'error' });
  return import(pathToFileURL(o2).href);
})();

const errors = [];
const ids = new Set();
const cats = new Set(CATEGORIES.map((c) => c.id));
for (const s of STYLES) {
  if (ids.has(s.id)) errors.push(`duplicate style id: ${s.id}`);
  ids.add(s.id);
  if (!cats.has(s.category)) errors.push(`${s.id}: unknown category ${s.category}`);
  if (!/vec4\s+effect\s*\(\s*vec2/.test(s.glsl)) errors.push(`${s.id}: glsl has no "vec4 effect(vec2 ...)"`);
  const keys = new Set();
  for (const p of s.params) {
    if (keys.has(p.key)) errors.push(`${s.id}: duplicate param ${p.key}`);
    keys.add(p.key);
    if (!p.noUniform && p.type !== 'text' && RESERVED_KEYS.has(p.key)) errors.push(`${s.id}: reserved param key "${p.key}"`);
    if (p.type === 'range' && (p.default < p.min || p.default > p.max)) errors.push(`${s.id}.${p.key}: default ${p.default} outside [${p.min}, ${p.max}]`);
    if (p.type === 'select' && !p.options.some((o) => o.value === p.default)) errors.push(`${s.id}.${p.key}: default ${p.default} not in options`);
    if (p.type === 'color' && !/^#[0-9a-f]{6}$/i.test(p.default)) errors.push(`${s.id}.${p.key}: bad color ${p.default}`);
    const viaCtr = (p.key === 'cx' || p.key === 'cy') && s.glsl.includes('ctr()');
    if (!p.noUniform && p.type !== 'text' && !viaCtr && !s.glsl.includes(`u_${p.key}`)) {
      errors.push(`${s.id}.${p.key}: param is never used in GLSL (u_${p.key})`);
    }
  }
  for (const p of s.params) for (const k of Object.keys(p.showIf || {})) if (!keys.has(k)) errors.push(`${s.id}.${p.key}: showIf references missing "${k}"`);
  if (s.glyphs && !s.params.some((p) => p.type === 'text' && p.atlas)) errors.push(`${s.id}: glyph style without an atlas text param`);
  if (s.glsl.includes('ctr()') && !keys.has('cx')) errors.push(`${s.id}: uses ctr() without cx/cy params`);
}
for (const f of ['public/samples/portrait.webp', 'public/fonts/geist-mono.woff2', 'public/fonts/geist-pixel-square.woff2']) {
  if (!existsSync(f)) errors.push(`missing asset ${f}`);
}

if (process.argv.includes('--catalog')) {
  const lines = ['# Catálogo de estilos', '', `${STYLES.length} estilos en ${CATEGORIES.length} categorías. Generado con \`npm run catalog\`.`, ''];
  for (const c of CATEGORIES) {
    const list = STYLES.filter((s) => s.category === c.id);
    lines.push(`## ${c.label} (${list.length})`, '', '| Estilo | id | Etiquetas | Parámetros |', '|---|---|---|---|');
    for (const s of list) lines.push(`| ${s.icon} ${s.name} | \`${s.id}\` | ${s.tags.join(', ')} | ${s.params.length} |`);
    lines.push('');
  }
  writeFileSync('docs/estilos.md', lines.join('\n'));
  console.log('docs/estilos.md written');
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ ${STYLES.length} styles, ${CATEGORIES.length} categories — registry OK`);
