import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { withBase } from '../../utils/url';

export async function GET(context: APIContext) {
  const posts = (
    await getCollection('posts', ({ id, data }) => id.startsWith('vi/') && !data.draft)
  ).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({
    title: 'sharelab — Vật lý phổ thông qua demo tương tác',
    description: 'Vật lý phổ thông qua demo tương tác — kéo thanh trượt và xem công thức chạy.',
    site: context.site ?? 'https://sharelab.fyi',
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: withBase(`/vi/posts/${post.id.slice('vi/'.length)}/`),
    })),
  });
}
