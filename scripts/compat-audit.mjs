/**
 * Browser-compatibility gate for the built site.
 *
 * The site targets Tailwind v4's own baseline:
 *   Chrome/Edge 111 · Firefox 128 · Safari 16.4
 * (the same numbers astro.config.mjs hands to lightningcss, which is where the
 * vendor prefixes come from). Anything the built CSS or JS needs beyond that
 * baseline is either a bug or a documented, deliberate exception.
 *
 * Feature versions below come from @mdn/browser-compat-data (checked 2026-10-30)
 * and are inlined on purpose: pulling the whole BCD package in as a dependency
 * would cost more than this table does.
 *
 * Severity:
 *   hard     — without support the declaration is dropped or the colour is
 *              invalid, so the page visibly breaks. Fails the gate.
 *   graceful — the browser simply skips a nicety (no text balancing, no entry
 *              animation, no view transition). Reported, never fatal.
 *
 * Usage: node scripts/compat-audit.mjs [--json]
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { fromRoot } from './lib/paths.mjs';

const BASELINE = { chrome: 111, edge: 111, firefox: 128, safari: 16.4 };

/** Newest version each feature needs. `null` = no support in that engine. */
const FEATURES = [
  { name: 'oklch()', pattern: /oklch\(\s*[\d.]+%?/g, min: { chrome: 111, edge: 111, firefox: 113, safari: 15.4 }, severity: 'hard' },
  { name: 'color-mix()', pattern: /color-mix\(/g, min: { chrome: 111, edge: 111, firefox: 113, safari: 16.2 }, severity: 'hard' },
  {
    name: 'relative colour syntax (oklch(from …))',
    pattern: /oklch\(\s*from\s/g,
    min: { chrome: 122, edge: 122, firefox: 128, safari: 18 },
    severity: 'hard',
    hint: 'write color-mix(in srgb, var(--token) N%, transparent) instead',
  },
  { name: 'light-dark()', pattern: /light-dark\(/g, min: { chrome: 123, edge: 123, firefox: 120, safari: 17.5 }, severity: 'hard' },
  { name: '@property', pattern: /@property/g, min: { chrome: 85, edge: 85, firefox: 128, safari: 16.4 }, severity: 'hard' },
  { name: ':has()', pattern: /:has\(/g, min: { chrome: 105, edge: 105, firefox: 121, safari: 15.4 }, severity: 'hard' },
  { name: 'container-type', pattern: /container-type\s*:/g, min: { chrome: 105, edge: 105, firefox: 110, safari: 16 }, severity: 'hard' },
  { name: 'container units (cqw…)', pattern: /\b\d[\d.]*cq[wibh]\b/g, min: { chrome: 105, edge: 105, firefox: 110, safari: 16 }, severity: 'hard' },
  { name: 'aspect-ratio', pattern: /aspect-ratio\s*:/g, min: { chrome: 88, edge: 88, firefox: 89, safari: 15 }, severity: 'hard' },
  { name: '@layer', pattern: /@layer/g, min: { chrome: 99, edge: 99, firefox: 97, safari: 15.4 }, severity: 'hard' },
  { name: 'text-wrap: balance', pattern: /text-wrap\s*:\s*balance/g, min: { chrome: 114, edge: 114, firefox: 121, safari: 17.5 }, severity: 'graceful' },
  { name: 'text-wrap: pretty', pattern: /text-wrap\s*:\s*pretty/g, min: { chrome: 117, edge: 117, firefox: null, safari: 26 }, severity: 'graceful' },
  { name: 'text-autospace', pattern: /text-autospace\s*:/g, min: { chrome: 140, edge: 140, firefox: 145, safari: 18.4 }, severity: 'graceful' },
  { name: '@starting-style', pattern: /@starting-style/g, min: { chrome: 117, edge: 117, firefox: 129, safari: 17.5 }, severity: 'graceful' },
  { name: 'scrollbar-gutter', pattern: /scrollbar-gutter\s*:/g, min: { chrome: 94, edge: 94, firefox: 97, safari: 18.2 }, severity: 'graceful' },
  { name: 'view transitions', pattern: /view-transition/g, min: { chrome: 111, edge: 111, firefox: 144, safari: 18 }, severity: 'graceful' },
];

/** Properties that still need a -webkit- prefix on the older end of the baseline. */
const PREFIXES = [
  { name: 'backdrop-filter', unprefixed: /(?<![-\w])backdrop-filter\s*:/g, prefixed: /(?<![-\w])-webkit-backdrop-filter\s*:/g, reason: 'unprefixed only from Safari 18' },
  { name: 'mask-image', unprefixed: /(?<![-\w])mask-image\s*:/g, prefixed: /(?<![-\w])-webkit-mask-image\s*:/g, reason: 'unprefixed only from Safari 15.4+' },
  { name: 'user-select', unprefixed: /(?<![-\w])user-select\s*:/g, prefixed: /(?<![-\w])-webkit-user-select\s*:/g, reason: 'Safari needs the prefix' },
];

/**
 * Declarations whose property name lost its leading dash somewhere upstream.
 * Browsers drop them as unknown properties, so they are noise rather than a
 * break — but they mean a minifier along the way is mangling something, and it
 * is worth knowing which property.
 */
const MALFORMED = [
  { name: 'webkit-user-select (missing leading dash)', pattern: /(?<![-\w])webkit-user-select\s*:/g, note: 'emitted by the Tailwind v4 / Lightning CSS pass from daisyUI’s .btn; harmless, reported for visibility' },
];

/** Runtime APIs that do not exist across the whole baseline. */
const APIS = [
  'structuredClone', 'Object.groupBy', 'Array.prototype.groupBy', 'Promise.withResolvers',
  'Array.fromAsync', 'Object.hasOwn', 'findLast', 'findLastIndex', 'replaceAll', 'toSorted', 'toReversed',
];

const walk = async (dir, out = []) => {
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    if ((await stat(full)).isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
};

const above = (min, browser) => {
  const need = min[browser];
  if (need === null) return true;                 // no support at all
  return typeof need === 'number' && need > BASELINE[browser];
};

const count = (text, pattern) => (text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')) ?? []).length;

const distDir = fromRoot('dist');
const files = await walk(distDir);
const cssFiles = files.filter((f) => f.endsWith('.css'));
const jsFiles = files.filter((f) => f.endsWith('.js'));

if (!cssFiles.length) {
  console.error('compat:audit — no CSS in dist/. Run `pnpm build` first.');
  process.exit(1);
}

const css = (await Promise.all(cssFiles.map((f) => readFile(f, 'utf8')))).join('\n');
const js = (await Promise.all(jsFiles.map((f) => readFile(f, 'utf8')))).join('\n');

const failures = [];
const notes = [];

console.log(`compat:audit — baseline Chrome/Edge ${BASELINE.chrome}, Firefox ${BASELINE.firefox}, Safari ${BASELINE.safari}`);
console.log(`  scanning ${cssFiles.length} css + ${jsFiles.length} js files\n`);

for (const feature of FEATURES) {
  const hits = count(css, feature.pattern);
  if (!hits) continue;
  const offenders = ['chrome', 'edge', 'firefox', 'safari'].filter((b) => above(feature.min, b));
  const label = `${feature.name} ×${hits}`;
  if (!offenders.length) {
    console.log(`  ok        ${label}`);
  } else if (feature.severity === 'hard') {
    console.log(`  FAIL      ${label} — needs ${offenders.map((b) => `${b} ${feature.min[b] ?? 'never'}`).join(', ')}`);
    if (feature.hint) console.log(`            ${feature.hint}`);
    failures.push(`${feature.name} is used ${hits}× but needs ${offenders.join(', ')} above the baseline`);
  } else {
    console.log(`  degraded  ${label} — ${offenders.join(', ')} skip it (cosmetic)`);
    notes.push(`${feature.name} ×${hits}: skipped by ${offenders.join(', ')}`);
  }
}

for (const prefix of PREFIXES) {
  const unprefixed = count(css, prefix.unprefixed);
  if (!unprefixed) continue;
  const prefixed = count(css, prefix.prefixed);
  if (prefixed >= unprefixed) {
    console.log(`  ok        ${prefix.name} prefixed (${prefixed}/${unprefixed})`);
  } else {
    console.log(`  FAIL      ${prefix.name}: ${unprefixed} unprefixed, only ${prefixed} prefixed — ${prefix.reason}`);
    failures.push(`${prefix.name} needs a -webkit- prefix for the baseline (${prefix.reason})`);
  }
}

for (const api of APIS) {
  if (js.includes(api)) {
    console.log(`  FAIL      JS API ${api} is not available across the baseline`);
    failures.push(`${api} is used in client JS but is missing on part of the baseline`);
  }
}

for (const oddity of MALFORMED) {
  const hits = count(css, oddity.pattern);
  if (!hits) continue;
  console.log(`  note      ${oddity.name} ×${hits} — ${oddity.note}`);
  notes.push(`${oddity.name} ×${hits}: ${oddity.note}`);
}

console.log('');
if (failures.length) {
  console.error(`compat:audit failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
if (notes.length) {
  console.log('Graceful degradations (not failures):');
  for (const n of notes) console.log(`  - ${n}`);
}
console.log('compat:audit passed — nothing in the output needs a newer browser than the baseline.');
