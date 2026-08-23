import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const byDateDesc = (a: Post, b: Post) => {
  const left = a.data.updatedDate ?? a.data.date;
  const right = b.data.updatedDate ?? b.data.date;
  return right.valueOf() - left.valueOf();
};

export async function getAllPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort(byDateDesc);
}

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort(byDateDesc);
}

export async function getFeaturedPosts(): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.featured);
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.tags.includes(tag));
}

export async function getAllTags(): Promise<string[]> {
  const posts = await getPublishedPosts();
  return [...new Set(posts.flatMap((post) => post.data.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export async function getTagGroups(): Promise<{ name: string; posts: Post[] }[]> {
  const posts = await getPublishedPosts();
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      groups.set(tag, [...(groups.get(tag) ?? []), post]);
    }
  }
  return [...groups.entries()]
    .map(([name, items]) => ({ name, posts: items.sort(byDateDesc) }))
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, 'zh-CN'));
}

export async function getAllCategories(): Promise<string[]> {
  const posts = await getPublishedPosts();
  return [...new Set(posts.map((post) => post.data.category).filter((category): category is string => Boolean(category)))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export async function getCategoryGroups(): Promise<{ name: string; posts: Post[] }[]> {
  const posts = await getPublishedPosts();
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.data.category) continue;
    groups.set(post.data.category, [...(groups.get(post.data.category) ?? []), post]);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({ name, posts: items.sort(byDateDesc) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
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

export async function getSeriesGroups(): Promise<{ name: string; posts: Post[] }[]> {
  const posts = await getPublishedPosts();
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.data.series) continue;
    const existing = groups.get(post.data.series) ?? [];
    existing.push(post);
    groups.set(post.data.series, existing);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      posts: items.sort((a, b) => (a.data.seriesOrder ?? 999) - (b.data.seriesOrder ?? 999) || byDateDesc(a, b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

export async function getArchiveGroups(): Promise<{ year: string; posts: Post[] }[]> {
  const posts = await getPublishedPosts();
  const groups = new Map<string, Post[]>();

  for (const post of posts) {
    const year = String(post.data.date.getFullYear());
    const existing = groups.get(year) ?? [];
    existing.push(post);
    groups.set(year, existing);
  }

  return [...groups.entries()].sort(([a], [b]) => Number(b) - Number(a)).map(([year, items]) => ({
    year,
    posts: items.sort(byDateDesc),
  }));
}
