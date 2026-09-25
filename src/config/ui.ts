/**
 * Presentation constants shared by layouts, components, and inline scripts.
 *
 * STAGGER drives the reveal cascade defined in src/styles/global.css; keep the
 * values in sync with that stylesheet. LAYOUT holds sizing and count thresholds
 * used while rendering.
 */
export const LAYOUT = {
  BACK_TO_TOP_THRESHOLD: 300,
  RECENT_POSTS_COUNT: 6,
  SEARCH_DEFAULT_COUNT: 5,
  SEARCH_FOCUS_DELAY: 100,
} as const;

export const STAGGER = {
  CARD_START: 120,
  CARD_STEP: 80,
  LIST_START: 120,
  LIST_STEP: 60,
  POST_HEADING: 90,
  POST_META: 210,
  POST_TAGS: 260,
  POST_CONTENT: 220,
  POST_COVER: 320,
} as const;
