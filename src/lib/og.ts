import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { siteConfig } from '../config/site';
import { getPublishedPosts, type Post } from './content';

/**
 * Build-time Open Graph cards (1200×630 PNG) for posts without a cover.
 *
 * Satori cannot read the site's woff2 fonts and a full CJK font is too large
 * to commit, so a Noto Sans SC subset containing exactly the characters the
 * cards use is fetched from Google Fonts once per build. If that request fails
 * (offline build, blocked network) `isOgAvailable()` turns false: no cards are
 * emitted and posts keep the default share image, so the build never breaks
 * because of it. Nothing in the generated HTML points at Google.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const siteHost = new URL(siteConfig.siteUrl).host;
const cardText = (post: Post) => [post.data.title, post.data.category ?? '', post.data.description];

let fontPromise: Promise<ArrayBuffer | null> | undefined;

const fetchFont = async (text: string): Promise<ArrayBuffer | null> => {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@800&text=${encodeURIComponent(text)}`;
    // Without a browser user agent Google serves TrueType, which Satori reads.
    const css = await (await fetch(cssUrl)).text();
    const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!fontUrl) return null;
    const response = await fetch(fontUrl);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
};

const loadFont = () => {
  fontPromise ??= (async () => {
    const posts = await getPublishedPosts();
    const text = [siteConfig.title, siteHost, '·', ...posts.flatMap(cardText)].join('');
    const unique = [...new Set(text)].join('');
    const font = await fetchFont(unique);
    if (!font) console.warn('[og] Could not load the card font; posts without a cover keep the default share image.');
    return font;
  })();
  return fontPromise;
};

export const isOgAvailable = async () => (await loadFont()) !== null;

// Noto Sans SC has no emoji glyphs, so Satori asks for them separately. Each
// emoji is drawn from a Twemoji SVG fetched at build time and embedded in the
// PNG; a failed fetch falls back to an empty image rather than breaking.
const EMPTY_SVG = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"/>').toString('base64')}`;
const emojiCache = new Map<string, Promise<string>>();

// Twemoji file names are the code points in hex, joined by "-". The variation
// selector U+FE0F is dropped unless the emoji is a ZWJ sequence.
const twemojiName = (emoji: string) => {
  const points = [...emoji].map((char) => char.codePointAt(0)!);
  const kept = emoji.includes('‍') ? points : points.filter((point) => point !== 0xfe0f);
  return kept.map((point) => point.toString(16)).join('-');
};

const loadEmoji = (emoji: string) => {
  let pending = emojiCache.get(emoji);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${twemojiName(emoji)}.svg`);
        if (!response.ok) return EMPTY_SVG;
        return `data:image/svg+xml;base64,${Buffer.from(await response.text()).toString('base64')}`;
      } catch {
        return EMPTY_SVG;
      }
    })();
    emojiCache.set(emoji, pending);
  }
  return pending;
};

/** Site-relative path of a post's generated card. */
export const ogImagePath = (slug: string) => `/og/${slug}.png`;

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });

export async function renderOgImage(post: Post): Promise<Uint8Array> {
  const font = await loadFont();
  if (!font) throw new Error('OG font unavailable');
  const title = post.data.title;
  const titleSize = title.length > 28 ? 60 : title.length > 16 ? 72 : 84;

  const tree = el('div', {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '72px 80px',
    background: 'linear-gradient(135deg, #fff8fa 0%, #fdf2f6 45%, #f6c3d6 100%)',
    color: '#291c23',
    fontFamily: 'Noto Sans SC',
  }, [
    el('div', { display: 'flex', alignItems: 'center', gap: '18px', fontSize: 30, color: '#b0406b' }, [
      el('div', { width: '56px', height: '8px', borderRadius: '8px', background: 'linear-gradient(90deg, #d94f81, #8764c5)' }),
      siteConfig.title,
    ]),
    el('div', { display: 'flex', flexDirection: 'column', gap: '26px' }, [
      el('div', { fontSize: titleSize, lineHeight: 1.2, letterSpacing: '-0.01em' }, title),
      el('div', { fontSize: 30, lineHeight: 1.5, color: '#755c68', maxHeight: '90px', overflow: 'hidden' }, post.data.description),
    ]),
    el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#755c68' }, [
      post.data.category ? `${post.data.category}` : '',
      siteHost,
    ]),
  ]);

  const svg = await satori(tree as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [{ name: 'Noto Sans SC', data: font, weight: 800, style: 'normal' }],
    // Only emoji are resolved here; any other missing script keeps Satori's fallback.
    loadAdditionalAsset: async (code: string, segment: string) => (code === 'emoji' ? loadEmoji(segment) : []),
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng();
}
