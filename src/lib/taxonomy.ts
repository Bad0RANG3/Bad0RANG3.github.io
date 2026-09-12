import { byDateDesc, getPublishedPosts, type Post } from './content';

/**
 * Tag, category, series, and archive groupings built from published posts.
 * Every helper here reads the same published set and only changes the shape or
 * the ordering, so index pages and per-value routes stay consistent.
 */

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
