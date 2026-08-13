import type { APIRoute } from 'astro';
import { SITE } from '../constants';
import { siteConfig } from '../config/site';
import { withBase } from '../lib/urls';

export const prerender = true;

const manifest = {
  name: siteConfig.title,
  short_name: 'Bad0RANG3',
  description: siteConfig.description,
  start_url: withBase('/'),
  scope: withBase('/'),
  display: 'standalone',
  background_color: SITE.THEME_COLOR,
  theme_color: SITE.THEME_COLOR,
  lang: 'zh-CN',
  dir: 'ltr',
  icons: [
    {
      src: withBase('/HP.webp'),
      sizes: '1868x1868',
      type: 'image/webp',
      purpose: 'any maskable',
    },
    {
      src: withBase('/ico.ico'),
      sizes: 'any',
      type: 'image/x-icon',
      purpose: 'any',
    },
  ],
  shortcuts: [
    {
      name: '文章',
      short_name: '文章',
      url: withBase('/posts/'),
    },
    {
      name: '项目',
      short_name: '项目',
      url: withBase('/projects/'),
    },
  ],
} as const;

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
