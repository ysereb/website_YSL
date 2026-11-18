import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/pages' }),
  schema: z.object({ title: z.string(), description: z.string(), eyebrow: z.string().optional(), subtitle: z.string().optional(), summary: z.string().optional() }),
});
const research = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/research' }),
  schema: z.object({ title: z.string(), order: z.number(), questions: z.array(z.string()) }),
});
const people = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/people' }),
  schema: z.object({ name: z.string(), role: z.string(), order: z.number(), image: z.string(), alt: z.string() }),
});
const publications = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/publications' }),
  schema: z.object({ title: z.string(), authors: z.string(), year: z.number(), journal: z.string(), doi: z.string(), url: z.string().url(), order: z.number() }),
});
const photos = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/photos' }),
  schema: z.object({ title: z.string(), order: z.number(), images: z.array(z.object({ src: z.string(), alt: z.string() })) }),
});
const news = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/news' }),
  schema: z.object({ title: z.string(), date: z.coerce.date(), draft: z.boolean().default(false) }),
});
export const collections = { pages, research, people, publications, photos, news };
