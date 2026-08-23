import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    updatedDate: z.date().optional(),
    verifiedDate: z.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    featured: z.boolean().default(false),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    series: z.string().optional(),
    seriesOrder: z.number().int().positive().optional(),
    canonical: z.string().url().optional(),
    noindex: z.boolean().default(false),
    lang: z.string().default('zh-CN'),
    difficulty: z.enum(['入门', '中等', '进阶']).optional(),
    audience: z.string().optional(),
    hasCode: z.boolean().default(false),
    hasDownload: z.boolean().default(false),
  }),
});

const thoughts = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.date(),
  }),
});

export const collections = { posts, thoughts };