import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;
export type Thought = CollectionEntry<'thoughts'>;

export interface SearchItem {
  title: string;
  description: string;
  slug: string;
  tags: string[];
  date: string;
}

export interface NavItem {
  href: string;
  label: string;
}

export interface SocialLink {
  name: string;
  url: string;
}

export interface IconLinkItem {
  name: string;
  url: string;
}

export interface ArchiveGroup {
  year: string;
  posts: Post[];
}

export interface SiteConfig {
  title: string;
  description: string;
  siteUrl: string;
  ogImage: string;
  author: Author;
  navigation: NavItem[];
  socials: SocialLink[];
  giscus: GiscusConfig;
  hero: HeroConfig;
  about: AboutConfig;
}

export interface Author {
  name: string;
  intro: string;
  avatar: string;
  email: string;
}

export interface GiscusConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
}

export interface HeroConfig {
  lyric: string;
  lyricSource: string;
}

export interface AboutConfig {
  greeting: string;
  subtitle: string;
  currentStatus: string;
  quotes: string[];
  techStack: IconLinkItem[];
  devTools: IconLinkItem[];
  interests: string[];
}
