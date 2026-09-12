/** Today's date as YYYY-MM-DD in the machine's local timezone. */
export function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** True when `value` is a real YYYY-MM-DD calendar date (2024-02-31 fails). */
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Normalizes a slug into a safe single path segment. */
export function normalizeSlug(value) {
  const slug = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\.(?:md|mdx)$/i, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  if (!slug || slug === '.' || slug === '..' || /[\\/\0]/.test(slug) || slug.includes('..')) {
    throw new Error('Slug must be a simple file name and cannot contain path separators or "..".');
  }
  return slug;
}
