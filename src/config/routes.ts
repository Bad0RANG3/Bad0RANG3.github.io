/**
 * Site-relative route table.
 *
 * Every internal URL is declared here so pages, feeds, and the web manifest
 * share one source of truth. Values stay site-relative on purpose; pass them
 * through `withBase` from src/lib/urls.ts at the point where a URL is rendered
 * so project Pages deployments keep working.
 */
export const ROUTES = {
  HOME: '/',
  POSTS: '/posts',
  PROJECTS: '/projects',
  THOUGHTS: '/thoughts',
  TOOLS: '/tools',
  ARCHIVE: '/archive',
  ABOUT: '/about',
  TAGS: '/tags',
  SERIES: '/series',
  EXPLORE: '/explore',
  PRIVACY: '/privacy',
  SEARCH_INDEX: '/search-index.json',
  RSS: '/rss.xml',
  ATOM: '/atom.xml',
  JSON_FEED: '/feed.json',
} as const;
