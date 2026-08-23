import type { APIRoute } from 'astro';
import { siteConfig } from '../config/site';
import { getPublishedPosts } from '../lib/content';
import { siteUrl } from '../lib/urls';

export const prerender = true;

export const GET: APIRoute = async () => {
  const homePageUrl = siteUrl('/');
  const posts = await getPublishedPosts();
  const newest = posts[0]?.data.updatedDate ?? posts[0]?.data.date;

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: siteConfig.title,
    home_page_url: homePageUrl,
    feed_url: siteUrl('/feed.json'),
    description: siteConfig.description,
    language: 'zh-CN',
    icon: siteUrl(siteConfig.author.avatar),
    favicon: siteUrl('/ico.ico'),
    authors: [{
      name: siteConfig.author.name,
      url: siteUrl('/about/'),
      avatar: siteUrl(siteConfig.author.avatar),
    }],
    ...(newest ? { expired: false, _updated: newest.toISOString() } : {}),
    items: posts.map((post) => {
      const url = siteUrl(`/posts/${post.slug}/`);
      return {
        id: url,
        url,
        external_url: post.data.canonical,
        title: post.data.title,
        content_text: post.data.description,
        summary: post.data.description,
        date_published: post.data.date.toISOString(),
        date_modified: (post.data.updatedDate ?? post.data.date).toISOString(),
        ...(post.data.cover ? { image: siteUrl(post.data.cover) } : {}),
        ...(post.data.tags.length > 0 ? { tags: post.data.tags } : {}),
        ...(post.data.category ? { _category: post.data.category } : {}),
      };
    }),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
