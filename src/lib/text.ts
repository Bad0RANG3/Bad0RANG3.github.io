/**
 * Text helpers shared by components.
 *
 * The design system reserves wide letter-spacing for uppercase Latin display
 * labels: a CJK glyph already fills its em box, so `0.3em` of tracking pulls a
 * Chinese label apart and reads as a rendering bug. Components therefore ask
 * this module whether a label may take the Latin treatment instead of every
 * caller having to remember.
 */

/** True when the string is printable ASCII only (so it is safe to track wide). */
export const isLatinOnly = (value: string) => /^[\x20-\x7E]+$/.test(value.trim());

/**
 * Serializes structured data for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` leaves `<` alone, so a frontmatter title that contains
 * `</script>` closes the element early and everything after it is parsed as
 * markup — one post title was all that stood between the site and a broken
 * page. Escaping `<`, `>` and `&` as `\uXXXX` keeps the value identical for a
 * JSON parser while making the payload markup-inert. U+2028 and U+2029 are
 * escaped as well: they are legal in JSON but not inside a JavaScript string,
 * and some consumers eval the block.
 */
export const serializeJsonLd = (value: unknown): string => (JSON.stringify(value) ?? '')
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
