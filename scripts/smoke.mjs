import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(rootDir, 'src', 'content', 'posts');
const sourceDir = path.join(rootDir, 'src');
// Raised to 16 MB: the PJSK sticker tool bundles a 739-image WEBP library and
// subsetted CJK fonts (YurukaStd + 上首方糖体). Still far below Pages limits.
const MAX_DIST_BYTES = 40 * 1024 * 1024;
const MAX_SINGLE_ASSET_BYTES = 1024 * 1024;

function normalizeBase(value = '/') {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

function parseArgs(argv) {
  let distDir = path.join(rootDir, 'dist');
  let base = '/';
  for (const argument of argv) {
    if (argument === '--help') return { help: true };
    if (argument.startsWith('--dist=')) distDir = path.resolve(rootDir, argument.slice('--dist='.length));
    else if (argument.startsWith('--base=')) base = normalizeBase(argument.slice('--base='.length));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return { distDir, base };
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  }));
  return groups.flat();
}

async function isFile(filename) {
  try { return (await stat(filename)).isFile(); } catch { return false; }
}

async function existingTextFiles(directory, extensions) {
  const files = await walk(directory);
  return files.filter((filename) => extensions.has(path.extname(filename).toLowerCase()));
}

function attributes(markup) {
  return Object.fromEntries([...markup.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '']));
}

function postId(filename) {
  // Astro normalizes content collection slugs to lowercase; mirror that here
  // so the smoke test behaves the same on case-sensitive and case-insensitive filesystems.
  return path.relative(postsDir, filename).replace(/\\/g, '/').replace(/\.(md|mdx)$/i, '').toLowerCase();
}

function draft(source) {
  const match = source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? /^draft:\s*true\s*$/mi.test(match[1]) : false;
}

function parseJson(label, source, fail) {
  try { return JSON.parse(source); } catch (error) { fail(`${label} is not valid JSON: ${error.message}`); return null; }
}

function extractJsonLd(source, fail, label) {
  const matches = [...source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!matches.length) {
    fail(`${label} has no JSON-LD script.`);
    return [];
  }
  return matches.flatMap((match) => {
    try { return [JSON.parse(match[1])]; } catch (error) { fail(`${label} has invalid JSON-LD: ${error.message}`); return []; }
  });
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log('Usage: pnpm smoke [-- --dist=dist] [--base=/repository/]');
  process.exit(0);
}

const failures = [];
const fail = (message) => failures.push(message);
const prefixed = (sitePath) => `${options.base === '/' ? '' : options.base.slice(0, -1)}${sitePath}`;

try {
  if (!await isFile(path.join(options.distDir, 'index.html'))) {
    throw new Error('dist/index.html is missing; run pnpm build first.');
  }

  const required = [
    'index.html', '404.html', 'about/index.html', 'archive/index.html',
    'posts/index.html', 'projects/index.html', 'thoughts/index.html',
    'tags/index.html', 'series/index.html', 'explore/index.html', 'privacy/index.html',
    'tools/index.html', 'atom.xml', 'feed.json', 'manifest.webmanifest', 'offline/index.html', 'sw.js',
    'rss.xml', 'robots.txt', 'sitemap-index.xml', 'sitemap-0.xml', 'search-index.json',
  ];
  for (const relative of required) if (!await isFile(path.join(options.distDir, relative))) fail(`Missing dist/${relative}`);

  const homepage = await readFile(path.join(options.distDir, 'index.html'), 'utf8');
  if (!/<!doctype html>/i.test(homepage) || !/<main\b/i.test(homepage)) fail('Homepage is not a complete HTML document with <main>.');
  if (!/<link\b[^>]*rel=["']canonical["']/i.test(homepage)) fail('Homepage is missing a canonical link.');
  const homepageLd = extractJsonLd(homepage, fail, 'Homepage');
  if (!homepageLd.some((item) => Array.isArray(item['@graph']) && item['@graph'].some((node) => node['@type'] === 'WebSite'))) fail('Homepage JSON-LD is missing a WebSite node.');
  if (/<script\b[^>]*src=["'][^"']*giscus/i.test(homepage)) fail('Homepage eagerly loads Giscus.');
  if (/<link\b[^>]*rel=["']preload["'][^>]*search-index\.json/i.test(homepage)) fail('Homepage preloads the search index.');
  if (options.base !== '/') {
    for (const requiredUrl of [prefixed('/manifest.webmanifest'), prefixed('/rss.xml'), prefixed('/sw.js')]) {
      if (!homepage.includes(requiredUrl)) fail(`Project-base homepage is missing base-prefixed URL: ${requiredUrl}`);
    }
    if (/\b(?:href|src)=["']\/(?!project-pages\/|_astro\/)/i.test(homepage)) fail('Project-base homepage still contains an unprefixed root-relative URL.');
  }

  const rss = await readFile(path.join(options.distDir, 'rss.xml'), 'utf8');
  if (!/<rss\b/i.test(rss) || !/<channel>/i.test(rss)) fail('RSS output is invalid or empty.');
  const atom = await readFile(path.join(options.distDir, 'atom.xml'), 'utf8');
  if (!/<feed\b[^>]*http:\/\/www\.w3\.org\/2005\/Atom/i.test(atom)) fail('Atom output is invalid or empty.');
  const feed = parseJson('feed.json', await readFile(path.join(options.distDir, 'feed.json'), 'utf8'), fail);
  if (feed && (feed.version !== 'https://jsonfeed.org/version/1.1' || !Array.isArray(feed.items))) fail('feed.json lacks JSON Feed version or items.');
  if (feed && options.base !== '/' && !feed.home_page_url.includes(options.base)) fail('feed.json home_page_url does not include the configured base path.');
  const manifest = parseJson('manifest.webmanifest', await readFile(path.join(options.distDir, 'manifest.webmanifest'), 'utf8'), fail);
  if (manifest) {
    if (!manifest.start_url || !manifest.scope || !Array.isArray(manifest.icons) || manifest.icons.length === 0) fail('manifest.webmanifest is missing install metadata.');
    if (options.base !== '/' && (manifest.start_url !== options.base || manifest.scope !== options.base)) fail('manifest.webmanifest does not use the configured base path.');
  }
  const searchIndex = parseJson('search-index.json', await readFile(path.join(options.distDir, 'search-index.json'), 'utf8'), fail);
  if (!Array.isArray(searchIndex) || searchIndex.length === 0) fail('search-index.json is empty or not an array.');
  if (Array.isArray(searchIndex) && options.base !== '/' && searchIndex.some((item) => typeof item.url === 'string' && !item.url.startsWith(options.base))) fail('Search index contains URLs missing the configured base path.');

  const robots = await readFile(path.join(options.distDir, 'robots.txt'), 'utf8');
  if (!/^Sitemap:\s*https?:\/\//mi.test(robots)) fail('robots.txt has no absolute Sitemap entry.');
  const sitemapIndex = await readFile(path.join(options.distDir, 'sitemap-index.xml'), 'utf8');
  if (!/<sitemapindex\b/i.test(sitemapIndex) || !/sitemap-0\.xml/i.test(sitemapIndex)) fail('Sitemap index is incomplete.');
  const sitemap = await readFile(path.join(options.distDir, 'sitemap-0.xml'), 'utf8');
  if (!/<urlset\b/i.test(sitemap)) fail('sitemap-0.xml is not a urlset.');

  const files = (await walk(postsDir)).filter((filename) => /\.(md|mdx)$/i.test(filename));
  let published = 0;
  for (const filename of files) {
    const source = await readFile(filename, 'utf8');
    if (draft(source)) continue;
    published += 1;
    const id = postId(filename);
    const route = path.join(options.distDir, 'posts', ...id.split('/'), 'index.html');
    if (!await isFile(route)) {
      fail(`Missing generated route for published post: /posts/${id}/`);
      continue;
    }
    if (!sitemap.toLocaleLowerCase('en-US').includes(`/posts/${id}`.toLocaleLowerCase('en-US'))) fail(`Published post missing from sitemap: /posts/${id}`);
    const article = await readFile(route, 'utf8');
    if (!/<article\b/i.test(article)) fail(`Article route has no <article>: /posts/${id}/`);
    const articleLd = extractJsonLd(article, fail, `Article /posts/${id}/`);
    if (!articleLd.some((item) => Array.isArray(item['@graph']) && item['@graph'].some((node) => node['@type'] === 'BlogPosting'))) fail(`Article JSON-LD has no BlogPosting node: /posts/${id}/`);
    if (/<script\b[^>]*src=["'][^"']*giscus/i.test(article)) fail(`Article eagerly loads Giscus: /posts/${id}/`);
  }

  const tagEntries = await readdir(path.join(options.distDir, 'tags'), { withFileTypes: true }).catch(() => []);
  if (published > 0 && !tagEntries.some((entry) => entry.isDirectory())) fail('No generated tag routes found.');

  const serviceWorker = await readFile(path.join(options.distDir, 'sw.js'), 'utf8');
  if (!/self\.registration\.scope/.test(serviceWorker) || /const OFFLINE_URL = ['"]\//.test(serviceWorker)) fail('Service worker is not base-path aware.');

  const projectsPage = await readFile(path.join(options.distDir, 'projects', 'index.html'), 'utf8');
  if (!/data-project-filters/.test(projectsPage) || !/data-project-filter="type"/.test(projectsPage) || !/data-project-filter="status"/.test(projectsPage) || !/data-project-filter="tag"/.test(projectsPage)) fail('Projects overview is missing the progressive-enhancement filters.');
  const projectConfig = await readFile(path.join(sourceDir, 'config', 'projects.ts'), 'utf8');
  const projectSlugs = [...projectConfig.matchAll(/slug:\s*'([^']+)'/g)].map((match) => match[1]);
  if (!projectSlugs.length) fail('Project configuration has no case-study slugs.');
  for (const slug of projectSlugs) {
    const projectRoute = path.join(options.distDir, 'projects', slug, 'index.html');
    if (!await isFile(projectRoute)) fail(`Missing generated project case study: /projects/${slug}/`);
    if (projectsPage.includes(prefixed(`/projects/${slug}/`))) fail(`Projects overview still links to a case study: /projects/${slug}/`);
  }

  const renderedTextFiles = await existingTextFiles(options.distDir, new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.webmanifest']));
  let distBytes = 0;
  let largest = { size: 0, file: '' };
  for (const filename of await walk(options.distDir)) {
    const size = (await stat(filename)).size;
    distBytes += size;
    if (size > largest.size) largest = { size, file: path.relative(options.distDir, filename).replace(/\\/g, '/') };
    if (size > MAX_SINGLE_ASSET_BYTES) fail(`Generated asset exceeds ${MAX_SINGLE_ASSET_BYTES} bytes: ${path.relative(options.distDir, filename)}`);
  }
  if (distBytes > MAX_DIST_BYTES) fail(`Generated site exceeds ${MAX_DIST_BYTES} bytes (${distBytes} bytes).`);

  for (const filename of renderedTextFiles) {
    const source = await readFile(filename, 'utf8');
    const relative = path.relative(options.distDir, filename).replace(/\\/g, '/');
    if (source.includes('\uFFFD')) fail(`Replacement character found in generated output: ${relative}`);
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/i.test(source)) fail(`Forbidden font or CDN host found in generated output: ${relative}`);
    if (relative.endsWith('.html')) {
      for (const match of source.matchAll(/<img\b([^>]*)>/gi)) {
        const attrs = attributes(match[1]);
        if (!Object.hasOwn(attrs, 'alt')) fail(`Image has no alt attribute: ${relative}`);
      }

      if (options.base !== '/') {
        for (const match of source.matchAll(/\b(?:href|src|poster)=(['"])(\/[^'"]*)\1/gi)) {
          const url = match[2];
          if (url === '/' || url.startsWith(`${options.base}_astro/`) || url.startsWith(`${options.base}project-pages/`)) continue;
          if (!url.startsWith(options.base)) fail(`Project-base HTML has an unprefixed root-relative URL (${url}): ${relative}`);
        }
      }
    }
  }

  const styles = await existingTextFiles(path.join(options.distDir, '_astro'), new Set(['.css']));
  const combinedStyles = (await Promise.all(styles.map((filename) => readFile(filename, 'utf8')))).join('\n');
  if (!/:focus-visible/.test(combinedStyles)) fail('Built CSS has no :focus-visible rule.');
  if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(combinedStyles)) fail('Built CSS has no reduced-motion rule.');

  const sourceFiles = await existingTextFiles(sourceDir, new Set(['.astro', '.ts', '.css', '.md', '.mdx', '.js', '.mjs']));
  for (const filename of sourceFiles) {
    if ((await readFile(filename, 'utf8')).includes('\uFFFD')) fail(`Replacement character found in source file: ${path.relative(rootDir, filename)}`);
  }

  console.log(`Static budget: ${(distBytes / 1024 / 1024).toFixed(2)} MiB total; largest ${largest.file} (${Math.ceil(largest.size / 1024)} KiB).`);
} catch (error) {
  console.error(`smoke failed: ${error.message}`);
  if (process.env.CI) console.log(`::error title=Smoke test failed::${error.message}`);
  process.exit(1);
}

for (const failure of failures) {
  console.error(`ERROR ${failure}`);
  if (process.env.CI) console.log(`::error title=Smoke test failure::${failure}`);
}
if (failures.length) {
  console.error(`Smoke test failed with ${failures.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(`Smoke test passed (base: ${options.base}).`);
}
