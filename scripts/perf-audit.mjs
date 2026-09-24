import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const posts = new URL('./posts/', dist);
// Long-form HTML is the product, so the cold budget includes the largest post
// plus its CSS and deferred module graph. Runtime work has separate invariants
// below so a smaller payload cannot hide scroll jank or eager third-party code.
const MAX_ARTICLE_CRITICAL_GZIP = 72 * 1024;
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
    const assetPath = new URL(`.${asset}`, dist);
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

// The BGA is allowed on reading pages, but only as a loop that yields to scroll.
const atmosphere = await readFile(new URL('../src/scripts/atmosphere.ts', import.meta.url), 'utf8');
if (!/addEventListener\('scroll', pauseForScroll/.test(atmosphere)) {
  console.error('Performance invariant failed: the atmosphere loop must pause while the reader scrolls.');
  process.exitCode = 1;
}

// The player controller is chrome; it must stay an idle/interaction import.
if (results.some((result) => result.assetUrls.some((asset) => /player\.[\w-]+\.js/.test(asset)))) {
  console.error('Performance invariant failed: the music player controller must not be loaded from the document.');
  process.exitCode = 1;
}

const enhancements = await readFile(new URL('../src/scripts/article-enhancements.ts', import.meta.url), 'utf8');
if (!/requestAnimationFrame\(updateProgress\)/.test(enhancements)) {
  console.error('Performance invariant failed: article scroll progress is not animation-frame throttled.');
  process.exitCode = 1;
}
if (!/setTimeout\(flushHistory,\s*4000\)/.test(enhancements)) {
  console.error('Performance invariant failed: reading-history writes are not throttled.');
  process.exitCode = 1;
}

const comments = await readFile(new URL('../src/scripts/comments.ts', import.meta.url), 'utf8');
if (!/IntersectionObserver/.test(comments)) {
  console.error('Performance invariant failed: comments are not deferred until near the viewport.');
  process.exitCode = 1;
}
