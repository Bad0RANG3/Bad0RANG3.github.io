import { getPublishedPosts, getThoughts } from './content';
import { projects } from '../config/projects';
import { tools } from '../config/tools';
import { postPath, toolPath } from '../config/routes';
import { withBase } from './urls';

export type SearchDocumentType = 'post' | 'thought' | 'project' | 'tool';

export interface SearchDocument {
  slug: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  category?: string;
  series?: string;
  date: string;
  featured: boolean;
  type: SearchDocumentType;
  url: string;
}

function cleanBody(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_`~\[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getSearchDocuments(): Promise<SearchDocument[]> {
  const posts = await getPublishedPosts();
  const thoughts = await getThoughts();
  const postDocuments: SearchDocument[] = posts.map((post) => ({
    slug: post.slug,
    title: post.data.title,
    description: post.data.description,
    body: cleanBody(post.body ?? ''),
    tags: post.data.tags,
    category: post.data.category,
    series: post.data.series,
    date: post.data.date.toISOString().slice(0, 10),
    featured: post.data.featured,
    type: 'post',
    url: withBase(postPath(post.slug)),
  }));
  const thoughtDocuments: SearchDocument[] = thoughts.map((thought) => ({
    slug: thought.id,
    title: '碎碎念 · ' + thought.data.date.toISOString().slice(0, 10),
    description: cleanBody(thought.body ?? '').slice(0, 180),
    body: cleanBody(thought.body ?? ''),
    tags: ['碎碎念'],
    category: '碎碎念',
    date: thought.data.date.toISOString().slice(0, 10),
    featured: false,
    type: 'thought',
    url: withBase('/thoughts/'),
  }));
  const projectDocuments: SearchDocument[] = projects.map((project) => ({
    slug: project.name,
    title: project.name,
    description: project.summary,
    body: project.summary,
    tags: [],
    date: '2099-12-31',
    featured: false,
    type: 'project',
    url: withBase(project.href),
  }));
  const toolDocuments: SearchDocument[] = tools.map((tool) => ({
    slug: tool.slug,
    title: tool.name,
    description: tool.description,
    body: tool.search.body,
    tags: tool.search.tags,
    category: '在线工具',
    date: '2099-12-31',
    featured: true,
    type: 'tool',
    url: withBase(toolPath(tool.slug)),
  }));
  return [...postDocuments, ...thoughtDocuments, ...projectDocuments, ...toolDocuments];
}
