import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the repository root.
 *
 * Resolved from this module rather than from process.cwd(), so every script
 * behaves the same no matter which directory it is invoked from.
 */
export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Joins path segments onto the repository root. */
export function fromRoot(...segments) {
  return path.join(rootDir, ...segments);
}

/**
 * Normalizes a Pages base path such as 'repo' or '/repo/' into '/repo/'.
 * The root base stays '/'.
 */
export function normalizeBase(value = '/') {
  if (!value || value === '/') return '/';
  return `/${String(value).replace(/^\/+|\/+$/g, '')}/`;
}
