/**
 * Reads a JSON array from `localStorage`.
 *
 * Every read site had the same two failure modes to defend against: the key is
 * absent (or removed between navigations), and the stored string is not valid
 * JSON or not an array. `localStorage` access also throws outright when the
 * browser disables storage. All of them resolve to an empty array, so callers
 * only ever see a well-formed list and keep their own key and default.
 */
export function readJsonArray<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}
