export const ANIMATION = {
  PAGE_EXIT_DURATION: 140,
  PAGE_ENTER_DURATION: 400,
  PAGE_ENTER_MOBILE: 300,
  REVEAL_DURATION: 450,
  REVEAL_MOBILE: 350,
} as const;

export const LAYOUT = {
  MAX_WIDTH: 'max-w-6xl',
  BACK_TO_TOP_THRESHOLD: 300,
  HERO_POSTS_COUNT: 3,
  RECENT_POSTS_COUNT: 6,
  SEARCH_DEFAULT_COUNT: 5,
  SEARCH_FOCUS_DELAY: 100,
} as const;

export const STAGGER = {
  BASE: 80,
  HEADING: 80,
  SUBTITLE: 150,
  CARD_START: 120,
  CARD_STEP: 80,
  LIST_START: 120,
  LIST_STEP: 60,
  POST_HEADING: 90,
  POST_META: 210,
  POST_TAGS: 260,
  POST_CONTENT: 220,
  POST_COVER: 320,
  POST_GUIDE: 300,
} as const;

export const ROUTES = {
  HOME: '/',
  POSTS: '/posts',
  THOUGHTS: '/thoughts',
  ARCHIVE: '/archive',
  ABOUT: '/about',
  TAGS: '/tags',
  RSS: '/rss.xml',
} as const;

export const SITE = {
  LANG: 'zh',
  LOCALE: 'zh_CN',
  THEME: 'dark',
  THEME_COLOR: '#1e1e2e',
} as const;
