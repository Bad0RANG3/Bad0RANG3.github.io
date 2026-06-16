import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const byDateDesc = (a: Post, b: Post) => {
  const left = a.data.updatedDate ?? a.data.date;
  const right = b.data.updatedDate ?? b.data.date;
  return right.valueOf() - left.valueOf();
};

export async function getAllPosts() {
  const posts = await getCollection('posts');
  return posts.sort(byDateDesc);
}

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort(byDateDesc);
}

export async function getFeaturedPosts() {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.featured);
}

export async function getPostsByTag(tag: string) {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.tags.includes(tag));
}

export async function getAllTags() {
  const posts = await getPublishedPosts();
  return [...new Set(posts.flatMap((post) => post.data.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export async function getArchiveGroups() {
  const posts = await getPublishedPosts();
  const groups = new Map<string, Post[]>();

  for (const post of posts) {
    const year = String(post.data.date.getFullYear());
    const existing = groups.get(year) ?? [];
    existing.push(post);
    groups.set(year, existing);
  }

  return [...groups.entries()].map(([year, items]) => ({
    year,
    posts: items.sort(byDateDesc),
  }));
}
