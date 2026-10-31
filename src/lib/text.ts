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
