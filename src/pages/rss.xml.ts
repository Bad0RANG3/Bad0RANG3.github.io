import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { siteConfig } from '../config/site';
import { getPublishedPosts } from '../lib/content';
import { withBase, siteUrl } from '../lib/urls';

export async function GET(_context: APIContext) {
  const posts = await getPublishedPosts();

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: siteUrl('/'),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: withBase(`/posts/${post.slug}/`),
      categories: post.data.tags,
    })),
    customData: '<language>zh-cn</language>',
  });
}
