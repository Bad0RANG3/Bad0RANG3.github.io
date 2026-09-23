import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkWithBase from './plugins/remark-with-base.mjs';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: 'https://bad0rang3.xyz',
  // Override BASE_PATH in CI to validate a project Pages deployment.
  base,
  output: 'static',
  markdown: {
    remarkPlugins: [[remarkWithBase, { base }]],
  },
  integrations: [sitemap({ filter: (page) => !page.includes('/about-alt') })],
  // With ClientRouter, prefetch same-origin links on hover/tap so navigation
  // feels instant without eagerly downloading the whole site.
  prefetch: true,
  vite: {
    plugins: [tailwindcss()],
  },
});
