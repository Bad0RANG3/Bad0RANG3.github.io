import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import remarkWithBase from './src/lib/remark-with-base.mjs';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: 'https://bad0rang3.github.io',
  // Override BASE_PATH in CI to validate a project Pages deployment.
  base,
  output: 'static',
  markdown: {
    remarkPlugins: [[remarkWithBase, { base }]],
  },
  integrations: [tailwind(), sitemap()],
});
