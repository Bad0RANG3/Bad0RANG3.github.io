import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Build-time intrinsic size of an image in public/, so <img> tags can reserve
 * their box and the page does not jump when the file arrives. Reads only the
 * header bytes of WebP, PNG, and JPEG; returns undefined for anything else
 * (or a missing file) and the caller simply omits width/height.
 */
export interface ImageSize { width: number; height: number }

// Resolved from the project root: during a build this module is bundled into
// another directory, so import.meta.url would not point next to public/.
const publicDir = path.resolve(process.cwd(), 'public');
const cache = new Map<string, ImageSize | undefined>();

const webpSize = (buffer: Buffer): ImageSize | undefined => {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return undefined;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return undefined;
};

const pngSize = (buffer: Buffer): ImageSize | undefined => (
  buffer.readUInt32BE(0) === 0x89504e47 ? { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) } : undefined
);

const jpegSize = (buffer: Buffer): ImageSize | undefined => {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1];
    // SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return undefined;
};

/**
 * Responsive variants of a `public/` image, by the naming convention the build
 * relies on: `cover.webp` also ships `cover-480.webp`, `cover-736.webp`, and so
 * on. Only widths whose file actually exists are emitted, so an image without
 * variants simply renders a plain `src` and nothing else changes.
 *
 * The source file itself stays in the set (at its intrinsic width) so a large
 * viewport can still pick the original.
 *
 * Paths stay site-relative; run the result through `withBaseSrcSet` before it
 * reaches the markup.
 */
export function imageSrcSet(sitePath: string | undefined, widths: number[]): string | undefined {
  if (!sitePath || !sitePath.startsWith('/') || sitePath.startsWith('//')) return undefined;
  const dot = sitePath.lastIndexOf('.');
  if (dot <= sitePath.lastIndexOf('/')) return undefined;
  const stem = sitePath.slice(0, dot);
  const extension = sitePath.slice(dot);

  const entries: string[] = [];
  for (const width of widths) {
    const variant = `${stem}-${width}${extension}`;
    if (hasPublicFile(variant)) entries.push(`${variant} ${width}w`);
  }
  if (entries.length === 0) return undefined;

  const intrinsic = getPublicImageSize(sitePath);
  entries.push(`${sitePath}${intrinsic ? ` ${intrinsic.width}w` : ''}`);
  return entries.join(', ');
}

/** `path` is site-relative, e.g. `/cyanotype.webp`. */
export function getPublicImageSize(sitePath: string | undefined): ImageSize | undefined {
  if (!sitePath || !sitePath.startsWith('/') || sitePath.startsWith('//')) return undefined;
  if (cache.has(sitePath)) return cache.get(sitePath);
  let size: ImageSize | undefined;
  try {
    const buffer = readFileSync(path.join(publicDir, decodeURIComponent(sitePath.slice(1))));
    size = webpSize(buffer) ?? pngSize(buffer) ?? jpegSize(buffer);
    if (size && (!size.width || !size.height)) size = undefined;
  } catch {
    size = undefined;
  }
  cache.set(sitePath, size);
  return size;
}

const fileCache = new Map<string, boolean>();

function hasPublicFile(sitePath: string): boolean {
  const cached = fileCache.get(sitePath);
  if (cached !== undefined) return cached;
  let exists = false;
  try {
    exists = statSync(path.join(publicDir, decodeURIComponent(sitePath.slice(1)))).isFile();
  } catch {
    exists = false;
  }
  fileCache.set(sitePath, exists);
  return exists;
}
