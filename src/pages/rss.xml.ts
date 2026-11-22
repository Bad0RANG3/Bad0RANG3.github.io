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

// Feed readers do not run the site's CSS, so the highlighter's markup is dead
// weight: every token arrived as its own `<span style="color:#…">`, and once
// XML-escaped the markup alone was 1.27 MB of a 1.28 MB document on the
// thirteen-post feed. The code text is what a reader needs, so the tags inside
// `<pre>` are dropped — the text is already entity-escaped, so what remains is
// the exact command the reader came for, and `<pre><code>` still renders as a
// code block everywhere.
const stripCodeMarkup = (html: string) => html.replace(
  /<pre\b[^>]*>([\s\S]*?)<\/pre>/g,
  (_match, body: string) => `<pre><code>${body.replace(/<[^>]*>/g, '')}</code></pre>`,
);

// The same argument applies to the rest of the article: `class`, `style`,
// `data-*`, `role`, `aria-*`, `loading`, `decoding` and `fetchpriority` all
// exist for this site's stylesheet or this site's scripts, and a feed reader
// ignores every one of them — while XML-escaping turns each pair of quotes into
// `&quot;`. Only attributes that still mean something without CSS survive.
// The list is an allowlist on purpose: an attribute nobody thought about drops
// out, which is the safe direction for a document consumed by other software.
const FEED_ATTRIBUTES = new Set([
  'href', 'src', 'srcset', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan', 'scope', 'start', 'reversed', 'datetime', 'lang', 'dir',
  'rel', 'target', 'type', 'value', 'checked', 'disabled',
]);

const ATTRIBUTE_PATTERN = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

// Matches one complete tag, including attribute values that contain `>`. The
// alternatives start with disjoint characters and are iterated greedily, so the
// pattern scans the document once: a lazy variant of this backtracked for
// seconds over the thirteen inlined articles. A trailing `/` (on the rare void
// element written as `<br/>` in Markdown) is moved back out of the attributes.
const TAG_PATTERN = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const tidyTag = (name: string, raw: string) => {
  const selfClose = raw.trimEnd().endsWith('/') ? '/' : '';
  const kept: string[] = [];
  for (const attribute of (selfClose ? raw.trimEnd().slice(0, -1) : raw).matchAll(ATTRIBUTE_PATTERN)) {
    const key = attribute[1].toLowerCase();
    if (!FEED_ATTRIBUTES.has(key)) continue;
    const value = attribute[2] ?? attribute[3] ?? attribute[4];
    kept.push(value === undefined ? key : `${key}="${value}"`);
  }
  return `<${name}${kept.length ? ` ${kept.join(' ')}` : ''}${selfClose}>`;
};

const stripPresentation = (html: string) => html.replace(
  TAG_PATTERN,
  (_match, name: string, raw: string) => tidyTag(name, raw),
);

/**
 * The article as it belongs in a feed: full text, no site chrome.
 *
 * Order matters — the code blocks are flattened first (while their highlight
 * spans are still real tags), then every remaining tag is reduced to the
 * attributes a reader can use, then the surviving `href`/`src` are made
 * absolute so a reader does not resolve them against the feed URL.
 */
const feedMarkup = (html: string) => absolutize(stripPresentation(stripCodeMarkup(html)));

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
      // <description> for readers that only show a preview. Everything the
      // site's CSS and scripts need is stripped (`feedMarkup`), which is the
      // difference between a 1.5 MB and a ~0.7 MB feed.
      content: feedMarkup(await container.renderToString(Content)),
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
