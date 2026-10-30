import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkWithBase from './plugins/remark-with-base.mjs';
import rehypeWrapTables from './plugins/rehype-wrap-tables.mjs';

const base = process.env.BASE_PATH || '/';

/**
 * Browser baseline for the CSS, expressed the way lightningcss wants it:
 * `(major << 16) | (minor << 8) | patch`. These four versions are Tailwind v4's
 * own baseline, so nothing here is stricter than the framework underneath.
 *
 * Handing them to lightningcss is what keeps vendor prefixes honest and
 * derived rather than hand-maintained: it emits `-webkit-backdrop-filter`
 * (unprefixed `backdrop-filter` only reached Safari 18), `-webkit-user-select`,
 * `-webkit-mask-image` and friends from this one list. `pnpm compat:audit`
 * checks the built CSS against the same baseline.
 */
const target = (major, minor = 0, patch = 0) => (major << 16) | (minor << 8) | patch;
const browserTargets = {
  chrome: target(111),
  edge: target(111),
  firefox: target(128),
  safari: target(16, 4),
};

export default defineConfig({
  site: 'https://bad0rang3.xyz',
  // Override BASE_PATH in CI to validate a project Pages deployment.
  base,
  output: 'static',
  markdown: {
    remarkPlugins: [[remarkWithBase, { base }]],
    rehypePlugins: [rehypeWrapTables],
  },
  integrations: [sitemap()],
  // With ClientRouter, prefetch same-origin links on hover/tap so navigation
  // feels instant without eagerly downloading the whole site.
  prefetch: true,
  vite: {
    plugins: [tailwindcss()],
    css: {
      transformer: 'lightningcss',
      lightningcss: { targets: browserTargets },
    },
  },
});
