import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    // Optional override for the <title> tag only. The display title stays the
    // magazine-style hook; this one leads with the searchable keyword for the
    // posts whose hook hides it (e.g. static electricity behind a door-handle
    // riddle). Unset means the display title serves both roles.
    seoTitle: z.string().optional(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // Links the Vietnamese and English versions of the same post together.
    translationId: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
