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
    // Optional since the English section was removed; existing posts keep
    // their values, new posts need not set one.
    translationId: z.string().optional(),
    // Curriculum metadata, set only by the Vật lý 12 lesson layer (see
    // docs/vat-ly-12-lesson-layer.md). All four are optional so the 290 posts
    // that are not part of a lesson series keep validating untouched, and all
    // four must be present together on a post that sets `series` —
    // validate-posts.mjs enforces that, since Zod cannot express it here
    // without making them required for everyone.
    grade: z.number().int().optional(),
    chapter: z.string().optional(),
    lesson: z.number().int().optional(),
    series: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
