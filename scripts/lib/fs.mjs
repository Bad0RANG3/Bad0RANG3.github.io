import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/** Every file below `directory`, recursively, as absolute paths. */
export async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  }));
  return groups.flat();
}

export async function isFile(filename) {
  try { return (await stat(filename)).isFile(); } catch { return false; }
}

export async function isDirectory(directory) {
  try { return (await stat(directory)).isDirectory(); } catch { return false; }
}
