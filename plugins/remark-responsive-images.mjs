import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { normalizeBase } from '../scripts/lib/paths.mjs';

/**
 * Adds `srcset`/`sizes` to images authored in Markdown.
 *
 * The variant convention matches `src/lib/images.ts` (used by the .astro
 * templates): next to `cover.webp` the build also publishes `cover-480.webp`,
 * `cover-736.webp`, and so on. Only widths whose file exists are emitted, so a
 * post with a single-resolution image renders exactly as before.
 *
 * Without this, a post's cover (which does get a srcset from its template) and
 * the same file used again in the body would resolve to two different URLs and
 * download twice.
 */

const publicDir = path.resolve(process.cwd(), 'public');
const fileCache = new Map();
const sizeCache = new Map();

const webpWidth = (buffer) => {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return undefined;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return 1 + buffer.readUIntLE(24, 3);
  if (chunk === 'VP8 ') return buffer.readUInt16LE(26) & 0x3fff;
  if (chunk === 'VP8L') return 1 + (buffer.readUInt32LE(21) & 0x3fff);
  return undefined;
};

const pngWidth = (buffer) => (buffer.readUInt32BE(0) === 0x89504e47 ? buffer.readUInt32BE(16) : undefined);

const jpegWidth = (buffer) => {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return buffer.readUInt16BE(offset + 7);
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return undefined;
};

const localPath = (sitePath) => path.join(publicDir, decodeURIComponent(sitePath.slice(1)));

const exists = (sitePath) => {
  const cached = fileCache.get(sitePath);
  if (cached !== undefined) return cached;
  let present = false;
  try {
    present = statSync(localPath(sitePath)).isFile();
  } catch {
    present = false;
  }
  fileCache.set(sitePath, present);
  return present;
};

const widthOf = (sitePath) => {
  const cached = sizeCache.get(sitePath);
  if (cached !== undefined) return cached;
  let width;
  try {
    const buffer = readFileSync(localPath(sitePath));
    width = webpWidth(buffer) ?? pngWidth(buffer) ?? jpegWidth(buffer);
  } catch {
    width = undefined;
  }
  sizeCache.set(sitePath, width);
  return width;
};

function buildSrcSet(sitePath, widths, prefix) {
  if (!sitePath || !sitePath.startsWith('/') || sitePath.startsWith('//')) return undefined;
  const dot = sitePath.lastIndexOf('.');
  if (dot <= sitePath.lastIndexOf('/')) return undefined;
  const stem = sitePath.slice(0, dot);
  const extension = sitePath.slice(dot);

  const entries = [];
  for (const width of widths) {
    const variant = `${stem}-${width}${extension}`;
    if (exists(variant)) entries.push(`${prefix}${variant} ${width}w`);
  }
  if (entries.length === 0) return undefined;

  const intrinsic = widthOf(sitePath);
  entries.push(`${prefix}${sitePath}${intrinsic ? ` ${intrinsic}w` : ''}`);
  return entries.join(', ');
}

export default function remarkResponsiveImages({ base = '/', widths = [480, 736], sizes = '(max-width: 768px) 100vw, 736px' } = {}) {
  const normalizedBase = normalizeBase(base);
  const prefix = normalizedBase === '/' ? '' : normalizedBase.slice(0, -1);

  return (tree) => {
    const visit = (node) => {
      if (node.type === 'image' && typeof node.url === 'string') {
        const srcSet = buildSrcSet(node.url, widths, prefix);
        if (srcSet) {
          node.data = node.data ?? {};
          node.data.hProperties = { ...node.data.hProperties, srcset: srcSet, sizes };
        }
      }
      if (node.type === 'html' && typeof node.value === 'string' && node.value.includes('<img')) {
        node.value = node.value.replace(/<img\b[^>]*>/gi, (tag) => {
          if (/\bsrcset\s*=/i.test(tag)) return tag;
          const match = tag.match(/\bsrc\s*=\s*(?:(['"])([^'"]+)\1|([^\s>]+))/i);
          if (!match) return tag;
          const src = match[2] ?? match[3];
          if (!src || !src.startsWith('/') || src.startsWith('//')) return tag;
          // `src` may already carry the base prefix from an earlier pass.
          const sitePath = normalizedBase !== '/' && src.startsWith(prefix) ? src.slice(prefix.length) : src;
          const srcSet = buildSrcSet(sitePath, widths, prefix);
          if (!srcSet) return tag;
          const attributes = `srcset="${srcSet}" sizes="${sizes}"`;
          return tag.replace(/\s*\/?>$/, (tail) => ` ${attributes}${tail}`);
        });
      }
      if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(tree);
  };
}
