import type { APIRoute } from 'astro';
import { siteConfig } from '../config/site';
import { getPublishedPosts } from '../lib/content';
import { siteUrl } from '../lib/urls';

export const prerender = true;

const xmlEscape = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export const GET: APIRoute = async () => {
  const homePageUrl = siteUrl('/');
  const posts = await getPublishedPosts();
  const updated = posts[0]?.data.updatedDate ?? posts[0]?.data.date ?? new Date();

  const entries = posts.map((post) => {
    const url = siteUrl(`/posts/${post.slug}/`);
    const published = post.data.date.toISOString();
    const modified = (post.data.updatedDate ?? post.data.date).toISOString();
    const categories = post.data.tags.map((tag) => `    <category term="${xmlEscape(tag)}" />`).join('\n');

    return `  <entry>
    <title>${xmlEscape(post.data.title)}</title>
    <id>${xmlEscape(url)}</id>
    <link href="${xmlEscape(url)}" />
    <published>${published}</published>
    <updated>${modified}</updated>
    <summary type="text">${xmlEscape(post.data.description)}</summary>
${categories}
    <author><name>${xmlEscape(siteConfig.author.name)}</name></author>
  </entry>`;
  }).join('\n');

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
  <title>${xmlEscape(siteConfig.title)}</title>
  <subtitle>${xmlEscape(siteConfig.description)}</subtitle>
  <id>${xmlEscape(homePageUrl)}</id>
  <link href="${xmlEscape(homePageUrl)}" rel="alternate" />
  <link href="${xmlEscape(siteUrl('/atom.xml'))}" rel="self" />
  <updated>${updated.toISOString()}</updated>
  <author><name>${xmlEscape(siteConfig.author.name)}</name><email>${xmlEscape(siteConfig.author.email)}</email></author>
${entries}
</feed>
`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
