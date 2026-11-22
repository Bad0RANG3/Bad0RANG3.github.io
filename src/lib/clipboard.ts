/**
 * One clipboard write for the whole site.
 *
 * `navigator.clipboard` only exists in a secure context, and even there it
 * rejects when the document is not focused or the permission was denied, so
 * three call sites had each grown (or forgotten) their own fallback: the code
 * copy button reported failure on `http://` and in Safari without a user
 * gesture, the share button did the same, and the sushi bill carried the only
 * working fallback. Routing all of them here means one decision instead of
 * three, and the deprecated `execCommand` call sits in a single place.
 *
 * The fallback keeps the classic selection trick: a hidden, read-only textarea,
 * select, `execCommand('copy')`, remove. It is reached only after the async API
 * failed, which is exactly the unfocused-document case where it still works.
 */

/**
 * The pre-`navigator.clipboard` path: a hidden, read-only textarea, select,
 * `execCommand('copy')`, remove.
 */
const legacyCopy = (text: string): boolean => {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // `position: fixed` keeps the page from scrolling to the textarea, and
  // `opacity: 0` keeps it invisible without `display: none` (which would make
  // the selection impossible).
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);

  // `execCommand` is deprecated in lib.dom but remains the only option on http
  // and in older WebKit. Reading it through a cast keeps the deprecation
  // diagnostic out of `pnpm check` without pretending the call is gone.
  const execCommand = (document as Document & { execCommand?: (command: string) => boolean }).execCommand;
  let copied = false;
  try {
    copied = typeof execCommand === 'function' && execCommand.call(document, 'copy');
  } catch {
    copied = false;
  }

  area.remove();
  active?.focus();
  return copied;
};

/**
 * Copies `text`, resolving `true` when it reached the clipboard.
 *
 * Never rejects: callers only need to decide which status message to show, and
 * a thrown permission error at a button click is not something to surface.
 */
export const copyText = async (text: string): Promise<boolean> => {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied permission, unfocused document, or an insecure context that still
    // exposes the API: the fallback below handles all three.
  }
  return legacyCopy(text);
};
