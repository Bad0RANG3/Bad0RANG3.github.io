import { readFileSync } from 'node:fs';
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
