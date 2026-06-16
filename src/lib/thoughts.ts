import { getCollection } from 'astro:content';

export async function getThoughts() {
  const thoughts = await getCollection('thoughts');
  return thoughts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
