import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { withBase } from '../../utils/url';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ id, data }) => id.startsWith('en/') && !data.draft);
  return rss({
    title: 'sharelab',
    description: 'Notes & guides from personal projects',
    site: context.site ?? 'https://angelline2005.github.io',
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: withBase(`/en/posts/${post.id.slice('en/'.length)}/`),
    })),
  });
}
