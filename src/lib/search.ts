import { getPublishedPosts } from './content';
import { getThoughts } from './thoughts';
import { projects } from '../config/projects';
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
    url: withBase(`/posts/${post.slug}/`),
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
    slug: project.code,
    title: project.name,
    description: `${project.summary} ${project.description}`,
    body: `${project.summary} ${project.description}`,
    tags: project.tags,
    category: project.type,
    date: '2099-12-31',
    featured: Boolean(project.featured),
    type: 'project',
    url: withBase(project.href),
  }));
  const toolDocuments: SearchDocument[] = [{
    slug: 'switch-your-cfg',
    title: 'SwitchYourCFG',
    description: 'CS2 配置文件可视化切换与导出工具。',
    body: 'CS2 CFG 配置 工具 键位 导出',
    tags: ['CS2', 'CFG', '配置'],
    category: '在线工具',
    date: '2099-12-31',
    featured: true,
    type: 'tool',
    url: withBase('/tools/switch-your-cfg/'),
  }];
  return [...postDocuments, ...thoughtDocuments, ...projectDocuments, ...toolDocuments];
}
