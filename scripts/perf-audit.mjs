import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const posts = new URL('./posts/', dist);
// Long-form HTML is the product, so the cold budget includes the largest post
// plus its CSS and deferred module graph. Runtime work has separate invariants
// below so a smaller payload cannot hide scroll jank or eager third-party code.
// The ceiling tracks the largest post that is long on purpose: the maimai DX HDD
// reference used to hold this spot, and the beginner-oriented
// "vscode-mingw-c-setup" guide now does. Its critical payload — the HTML plus
// the shared CSS/module graph — measures 92.4 KiB gzip across 38k characters of
// prose and step-by-step setup walkthroughs. Getting it under the old 88 KiB
// would have meant deleting roughly a fifth of the article, so the ceiling moved
// with the post. The budget is still a regression gate: it catches accidental
// payload growth such as inlined assets or a runaway inline script, not the
// length of a deliberately exhaustive reference.
const MAX_ARTICLE_CRITICAL_GZIP = 96 * 1024;
const MAX_ARTICLE_INLINE_SCRIPT = 12 * 1024;

const entries = await readdir(posts, { withFileTypes: true });
const results = [];

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const htmlUrl = new URL(`./${entry.name}/index.html`, posts);
  const html = await readFile(htmlUrl, 'utf8');
  const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:css|js))(?:\?[^"']*)?["']/g)]
    .map((match) => match[1])
    .filter((asset, index, all) => all.indexOf(asset) === index);
  let critical = gzipSync(html).byteLength;
  const inlineScriptBytes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .reduce((total, match) => total + match[1].length, 0);

  for (const asset of assetUrls) {
    if (!asset.startsWith('/')) continue;
    // Every .css/.js an article references is emitted under `_astro/`. A
    // project-Pages build writes those URLs base-prefixed
    // (`/project-pages/_astro/x.css`) while the file itself still sits at the
    // root of `dist/`, so the prefix has to come off before resolving. Without
    // this the audit threw ENOENT on every non-root build, which is why it was
    // never run against one.
    const buildAsset = asset.indexOf('/_astro/');
    if (buildAsset < 0) throw new Error(`perf-audit cannot map ${asset} onto a file under dist/; the budget would silently under-count.`);
    const assetPath = new URL(`.${asset.slice(buildAsset)}`, dist);
    critical += gzipSync(await readFile(assetPath)).byteLength;
  }

  results.push({ slug: entry.name, critical, inlineScriptBytes, assetUrls });
}

results.sort((a, b) => b.critical - a.critical);
const worst = results[0];
console.log(`Article critical payload: ${(worst.critical / 1024).toFixed(1)} KiB gzip (${worst.slug}).`);

if (worst.critical > MAX_ARTICLE_CRITICAL_GZIP) {
  console.error(`Performance budget exceeded: article critical payload must stay under ${MAX_ARTICLE_CRITICAL_GZIP / 1024} KiB gzip.`);
  process.exitCode = 1;
}
if (worst.inlineScriptBytes > MAX_ARTICLE_INLINE_SCRIPT) {
  console.error(`Performance budget exceeded: article inline scripts must stay under ${MAX_ARTICLE_INLINE_SCRIPT / 1024} KiB.`);
  process.exitCode = 1;
}
if (results.some((result) => result.assetUrls.some((asset) => /atmosphere\.[\w-]+\.js/.test(asset)))) {
  console.error('Performance invariant failed: the decorative atmosphere must stay a deferred import, not a blocking <script>.');
  process.exitCode = 1;
}

// The BGA runs continuously on reading pages; it must stay cheap. It paces
// itself off the panel's own cadence (requestAnimationFrame + a learned
// interval), capped so a high-refresh display cannot multiply the per-frame
// fill count, and it must not freeze while the reader scrolls.
const atmosphere = await readFile(new URL('../src/scripts/atmosphere.ts', import.meta.url), 'utf8');
const cadenceCap = Number(/const TARGET_FPS = (\d+)/.exec(atmosphere)?.[1]);
if (!/requestAnimationFrame\(render\)/.test(atmosphere) || !/frameInterval/.test(atmosphere)) {
  console.error('Performance invariant failed: the atmosphere loop must stay cadence-throttled with requestAnimationFrame.');
  process.exitCode = 1;
}
if (!Number.isFinite(cadenceCap) || cadenceCap < 30 || cadenceCap > 120) {
  console.error('Performance invariant failed: the atmosphere cadence cap must stay declared between 30 and 120 fps.');
  process.exitCode = 1;
}
if (/pauseForScroll/.test(atmosphere)) {
  console.error('Performance invariant failed: the atmosphere must keep animating while the reader scrolls.');
  process.exitCode = 1;
}

// The player controller is chrome; it must stay an idle/interaction import.
if (results.some((result) => result.assetUrls.some((asset) => /player\.[\w-]+\.js/.test(asset)))) {
  console.error('Performance invariant failed: the music player controller must not be loaded from the document.');
  process.exitCode = 1;
}

const enhancements = await readFile(new URL('../src/scripts/article-enhancements.ts', import.meta.url), 'utf8');
if (!/onScrollFrame\(updateProgress\)/.test(enhancements)) {
  console.error('Performance invariant failed: article scroll progress is not on the shared animation-frame scheduler.');
  process.exitCode = 1;
}
if (/requestAnimationFrame/.test(enhancements)) {
  console.error('Performance invariant failed: article-enhancements must not schedule its own animation frames; it belongs on lib/scroll.ts.');
  process.exitCode = 1;
}
// The scroll callback itself must be layout-free. Scoped to the callback body
// on purpose: measuring the document height elsewhere in the module (on resize
// and on load) is the fix, not the bug.
const updateProgress = /const updateProgress = \(\) => \{([\s\S]*?)\n {2}\};/.exec(enhancements)?.[1] ?? '';
if (!updateProgress) {
  console.error('Performance invariant failed: perf-audit could not find the updateProgress callback to inspect; update the pattern with the source.');
  process.exitCode = 1;
} else if (/scrollHeight|getBoundingClientRect|offsetHeight|clientHeight|offsetTop/.test(updateProgress)) {
  console.error('Performance invariant failed: the article scroll callback reads layout, which forces a reflow on every scroll frame.');
  process.exitCode = 1;
}
if (!/setTimeout\(flushHistory,\s*4000\)/.test(enhancements)) {
  console.error('Performance invariant failed: reading-history writes are not throttled.');
  process.exitCode = 1;
}

// The shared scheduler is what makes the invariant above real: one
// requestAnimationFrame per scroll burst for every subscriber on the page.
const scrollScheduler = await readFile(new URL('../src/lib/scroll.ts', import.meta.url), 'utf8');
if (!/requestAnimationFrame\(flush\)/.test(scrollScheduler)) {
  console.error('Performance invariant failed: lib/scroll.ts no longer batches subscribers into one animation frame.');
  process.exitCode = 1;
}

const comments = await readFile(new URL('../src/scripts/comments.ts', import.meta.url), 'utf8');
if (!/IntersectionObserver/.test(comments)) {
  console.error('Performance invariant failed: comments are not deferred until near the viewport.');
  process.exitCode = 1;
}
