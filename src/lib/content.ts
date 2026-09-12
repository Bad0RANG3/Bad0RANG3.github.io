import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** Newest first, preferring `updatedDate` when a post has been revised. */
export const byDateDesc = (a: Post, b: Post) => {
  const left = a.data.updatedDate ?? a.data.date;
  const right = b.data.updatedDate ?? b.data.date;
  return right.valueOf() - left.valueOf();
};

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort(byDateDesc);
}

export async function getFeaturedPosts(): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.featured);
}

export async function getThoughts() {
  const thoughts = await getCollection('thoughts');
  return thoughts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function getPostWordCount(post: Post): number {
  const body = post.body ?? '';
  return body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '').trim().replace(/\s+/g, '').length;
}

export function getPostReadingMinutes(post: Post): number {
  return Math.max(1, Math.ceil(getPostWordCount(post) / 420));
}

export async function getRelatedPosts(post: Post, limit = 3): Promise<Post[]> {
  const posts = await getPublishedPosts();
  const scored = posts
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => {
      const sharedTags = candidate.data.tags.filter((tag) => post.data.tags.includes(tag)).length;
      const sameCategory = candidate.data.category && candidate.data.category === post.data.category ? 1 : 0;
      const sameSeries = candidate.data.series && candidate.data.series === post.data.series ? 3 : 0;
      return { candidate, score: sharedTags * 2 + sameCategory + sameSeries };
    })
    .sort((a, b) => b.score - a.score || byDateDesc(a.candidate, b.candidate));
  return scored.filter(({ score }) => score > 0).slice(0, limit).map(({ candidate }) => candidate);
}
