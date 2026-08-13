import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(rootDir, 'src', 'content');
const publicDir = path.join(rootDir, 'public');
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const defaultMaxImageSize = 5 * 1024 * 1024;

function usage() {
  console.log(`
Validate Astro content frontmatter and local Markdown assets.

Usage:
  pnpm validate:content
  pnpm validate:content -- --max-image-size=5242880 [--warn-as-error]

The default local-image limit is 5 MiB.
`);
}

function parseArgs(argv) {
  const options = { maxImageSize: defaultMaxImageSize, warnAsError: false };
  for (const argument of argv) {
    if (argument === '--help') options.help = true;
    else if (argument === '--warn-as-error') options.warnAsError = true;
    else if (argument.startsWith('--max-image-size=')) options.maxImageSize = Number(argument.slice('--max-image-size='.length));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isSafeInteger(options.maxImageSize) || options.maxImageSize < 1) {
    throw new Error('--max-image-size must be a positive integer measured in bytes.');
  }
  return options;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  }));
  return paths.flat();
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replace(/''/g, "'");
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed); } catch { return trimmed.slice(1, -1); }
  }
  return trimmed;
}

function parseInlineArray(value) {
  const inner = value.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((entry) => unquote(entry));
}

function parseFrontmatter(source) {
  const text = source.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { error: 'Frontmatter must begin with a standalone --- line.' };
  const closingIndex = lines.findIndex((line, index) => index > 0 && line === '---');
  if (closingIndex === -1) return { error: 'Frontmatter is missing its closing --- line.' };

  const data = {};
  let activeArray;
  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const itemMatch = line.match(/^\s+-\s+(.*)$/);
    if (itemMatch) {
      if (!activeArray) return { error: `Unexpected list item on frontmatter line ${index + 1}.` };
      data[activeArray].push(unquote(itemMatch[1]));
      continue;
    }
    const fieldMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (!fieldMatch) return { error: `Unsupported frontmatter syntax on line ${index + 1}: ${line}` };
    const [, key, rawValue = ''] = fieldMatch;
    if (Object.hasOwn(data, key)) return { error: `Duplicate frontmatter key "${key}" on line ${index + 1}.` };
    if (!rawValue.trim()) {
      data[key] = [];
      activeArray = key;
    } else {
      data[key] = rawValue.trim().startsWith('[') && rawValue.trim().endsWith(']') ? parseInlineArray(rawValue) : unquote(rawValue);
      activeArray = undefined;
    }
  }
  return { data, body: lines.slice(closingIndex + 1).join('\n') };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function asBoolean(value) { return value === true || value === 'true'; }
function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function collectionId(collection, filename) {
  return path.relative(path.join(contentDir, collection), filename).replace(/\\/g, '/').replace(/\.(md|mdx)$/i, '');
}
function stripTarget(target) { return target.trim().replace(/^<|>$/g, '').split(/[?#]/, 1)[0]; }
function isExternal(target) { return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target); }
function resolveLocalAsset(target, sourceFile) {
  const cleaned = stripTarget(target);
  if (!cleaned || cleaned.startsWith('#') || isExternal(cleaned) || cleaned.startsWith('data:')) return undefined;
  if (cleaned.startsWith('/')) return path.resolve(publicDir, `.${cleaned}`);
  return path.resolve(path.dirname(sourceFile), cleaned);
}
async function existsAsFile(filename) {
  try { return (await stat(filename)).isFile(); } catch { return false; }
}
function collectMarkdownTargets(source) {
  const targets = [];
  for (const match of source.matchAll(/!\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g)) targets.push({ target: match[1], kind: 'image' });
  for (const match of source.matchAll(/(?<!!)\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g)) targets.push({ target: match[1], kind: 'link' });
  for (const match of source.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)) targets.push({ target: match[2], kind: 'image' });
  return targets;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

const errors = [];
const warnings = [];
const posts = [];
const seriesOrders = new Map();
function addError(file, message) { errors.push(`${path.relative(rootDir, file)}: ${message}`); }
function addWarning(file, message) { warnings.push(`${path.relative(rootDir, file)}: ${message}`); }

try {
  const records = [];
  for (const collection of ['posts', 'thoughts']) {
    const directory = path.join(contentDir, collection);
    const filenames = (await walk(directory)).filter((filename) => /\.(md|mdx)$/i.test(filename));
    for (const filename of filenames) {
      const source = await readFile(filename, 'utf8');
      const parsed = parseFrontmatter(source);
      const id = collectionId(collection, filename);
      const record = { collection, filename, id, source, parsed };
      records.push(record);
      if (source.includes('\uFFFD')) addWarning(filename, 'Contains a Unicode replacement character (possible encoding damage).');
      if (parsed.error) {
        addError(filename, parsed.error);
        continue;
      }
      const { data } = parsed;
      if (!isValidDate(data.date)) addError(filename, 'date is required and must be a real YYYY-MM-DD date.');
      if (collection === 'thoughts') continue;

      for (const field of ['title', 'description']) if (!isNonEmptyString(data[field])) addError(filename, `${field} is required and cannot be empty.`);
      if (!Array.isArray(data.tags) || data.tags.length === 0 || data.tags.some((tag) => !isNonEmptyString(tag))) addError(filename, 'tags is required and must contain at least one non-empty tag.');
      else if (new Set(data.tags.map((tag) => tag.trim())).size !== data.tags.length) addError(filename, 'tags must not contain duplicates.');

      if (data.updatedDate !== undefined) {
        if (!isValidDate(data.updatedDate)) addError(filename, 'updatedDate must be a real YYYY-MM-DD date.');
        else if (isValidDate(data.date) && data.updatedDate < data.date) addError(filename, 'updatedDate cannot be earlier than date.');
      }
      if (data.canonical !== undefined && (!isNonEmptyString(data.canonical) || !/^https?:\/\//i.test(data.canonical))) addError(filename, 'canonical must be an absolute http(s) URL.');
      if (data.lang !== undefined && !isNonEmptyString(data.lang)) addError(filename, 'lang cannot be empty.');

      if (data.cover !== undefined) {
        if (!isNonEmptyString(data.cover)) addError(filename, 'cover cannot be empty.');
        if (!isNonEmptyString(data.coverAlt)) addWarning(filename, 'cover has no coverAlt; add one for accessibility.');
        const coverFile = resolveLocalAsset(data.cover, filename);
        if (coverFile && !await existsAsFile(coverFile)) addError(filename, `cover file does not exist: ${data.cover}`);
      } else if (data.coverAlt !== undefined) addError(filename, 'coverAlt requires cover.');

      const hasSeries = isNonEmptyString(data.series);
      if (data.seriesOrder !== undefined) {
        const order = Number(data.seriesOrder);
        if (!hasSeries) addError(filename, 'seriesOrder requires series.');
        if (!Number.isInteger(order) || order < 1) addError(filename, 'seriesOrder must be a positive integer.');
        if (hasSeries && Number.isInteger(order) && order > 0) {
          const key = `${data.series}\u0000${order}`;
          if (seriesOrders.has(key)) addError(filename, `seriesOrder ${order} duplicates ${path.relative(rootDir, seriesOrders.get(key))} in series "${data.series}".`);
          else seriesOrders.set(key, filename);
        }
      }
      posts.push({ ...record, data, draft: asBoolean(data.draft) });
    }
  }

  const publicSlugFiles = new Map();
  for (const post of posts.filter((post) => !post.draft)) {
    const key = post.id.toLocaleLowerCase('en-US');
    if (publicSlugFiles.has(key)) addError(post.filename, `Duplicate public post slug "${post.id}"; first used by ${path.relative(rootDir, publicSlugFiles.get(key))}.`);
    else publicSlugFiles.set(key, post.filename);
  }

  const publicPostIds = new Set(posts.filter((post) => !post.draft).map((post) => post.id));
  for (const record of records) {
    if (record.parsed.error) continue;
    for (const { target, kind } of collectMarkdownTargets(record.source)) {
      const cleaned = stripTarget(target);
      if (!cleaned || cleaned.startsWith('#') || isExternal(cleaned) || cleaned.startsWith('data:')) continue;
      const localAsset = resolveLocalAsset(target, record.filename);
      if (kind === 'image') {
        if (!localAsset || !await existsAsFile(localAsset)) {
          addError(record.filename, `Local image does not exist: ${target}`);
          continue;
        }
        const info = await stat(localAsset);
        if (info.size > options.maxImageSize) addError(record.filename, `Local image exceeds ${options.maxImageSize} bytes: ${target} (${info.size} bytes).`);
        continue;
      }
      const postMatch = cleaned.match(/^\/posts\/([^/]+)\/?$/i);
      if (postMatch) {
        const slug = decodeURIComponent(postMatch[1]);
        if (!publicPostIds.has(slug)) addError(record.filename, `Internal post link points to no public post: ${target}`);
      } else if (/\.(?:md|mdx)$/i.test(cleaned)) {
        if (!localAsset || !await existsAsFile(localAsset)) addError(record.filename, `Relative Markdown link does not exist: ${target}`);
      } else if (cleaned.startsWith('/') && imageExtensions.has(path.extname(cleaned).toLowerCase())) {
        if (!localAsset || !await existsAsFile(localAsset)) addError(record.filename, `Local asset link does not exist: ${target}`);
      }
    }
  }
} catch (error) {
  console.error(`validate:content failed before validation completed: ${error.message}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
console.log(`Validated ${posts.length} post(s). ${errors.length} error(s), ${warnings.length} warning(s).`);
if (errors.length > 0 || (options.warnAsError && warnings.length > 0)) process.exitCode = 1;