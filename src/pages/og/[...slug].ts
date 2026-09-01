import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

// Build-time social cards: /og/<locale>/<slug>.png for every post. Facebook
// and Zalo link previews are the site's realistic first impression, so each
// post gets its title on a branded card instead of one shared gray image.
const posts = await getCollection('posts', ({ data }) => !data.draft);

export const { getStaticPaths, GET } = await OGImageRoute({
  pages: Object.fromEntries(posts.map((post) => [post.id, post.data])),
  getSlug: (path) => `${path}.png`,
  getImageOptions: (_path, page: (typeof posts)[number]['data']) => ({
    title: page.title,
    description: 'sharelab.fyi — vật lý qua demo tương tác',
    bgGradient: [
      [15, 23, 42],
      [30, 58, 138],
    ],
    border: { color: [37, 99, 235], width: 18, side: 'block-end' },
    padding: 70,
    font: {
      title: {
        families: ['Be Vietnam Pro'],
        weight: 'Bold',
        color: [255, 255, 255],
        size: 64,
        lineHeight: 1.25,
      },
      description: {
        families: ['Be Vietnam Pro'],
        color: [147, 197, 253],
        size: 32,
      },
    },
    fonts: ['./src/assets/fonts/BeVietnamPro-Bold.ttf', './src/assets/fonts/BeVietnamPro-Regular.ttf'],
  }),
});
