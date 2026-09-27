import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { siteConfig } from '../config/site';
import { postPath } from '../config/routes';
import { getPublishedPosts } from '../lib/content';
import { withBase, siteUrl } from '../lib/urls';

// Feed readers resolve relative URLs inconsistently (many against the feed
// URL, some not at all), so root-relative links and images in the rendered
// article are made absolute. Markdown already carries the base prefix.
const siteOrigin = new URL(siteUrl('/')).origin;
const absolutize = (html: string) => html.replace(/\s(href|src|poster)=(["'])\/(?!\/)/g, ` $1=$2${siteOrigin}/`);

export async function GET(_context: APIContext) {
  const posts = await getPublishedPosts();
  const container = await AstroContainer.create();

  const items = await Promise.all(posts.map(async (post) => {
    const { Content } = await post.render();
    return {
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: withBase(postPath(post.slug)),
      categories: post.data.tags,
      // Full article so readers need not open the site; the summary stays in
      // <description> for readers that only show a preview.
      content: absolutize(await container.renderToString(Content)),
    };
  }));

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: siteUrl('/'),
    items,
    customData: '<language>zh-cn</language>',
  });
}
