import type { APIRoute, GetStaticPaths } from 'astro';
import { getPublishedPosts, type Post } from '../../lib/content';
import { isOgAvailable, renderOgImage } from '../../lib/og';

export const prerender = true;

// Only posts without their own cover get a generated card, and none at all
// when the card font could not be loaded (see src/lib/og.ts).
export const getStaticPaths = (async () => {
  if (!await isOgAvailable()) return [];
  const posts = await getPublishedPosts();
  return posts
    .filter((post) => !post.data.cover)
    .map((post) => ({ params: { slug: post.slug }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage((props as { post: Post }).post);
  // A plain ArrayBuffer keeps Response's BodyInit typing happy across TS lib versions.
  const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  return new Response(body, { headers: { 'Content-Type': 'image/png' } });
};
