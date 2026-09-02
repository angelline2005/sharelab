import type { CollectionEntry } from 'astro:content';

// Human names for the tag slugs used in post frontmatter. Tags not listed here
// still get tag pages — they just render their raw slug.
export const TAG_LABELS: Record<string, Record<string, string>> = {
  vi: {
    'co-hoc': 'Cơ học',
    'nhiet-hoc': 'Nhiệt học',
    'quang-hoc': 'Quang học',
    'dien-tu': 'Điện & từ',
    'dien-hoc': 'Điện học',
    song: 'Sóng',
    'am-thanh': 'Âm thanh',
    'thien-van': 'Thiên văn',
    'chat-luu': 'Chất lưu',
    'khi-hau': 'Khí hậu & thời tiết',
    'dao-dong': 'Dao động',
    'hat-nhan': 'Hạt nhân',
    'tuong-doi': 'Tương đối',
    'luong-tu': 'Lượng tử',
    'mo-phong': 'Mô phỏng',
    'vat-ly': 'Vật lý',
    javascript: 'JavaScript',
  },
};

// Tags that appear on (nearly) every physics post and therefore carry no
// signal for navigation or related-post ranking.
export const NOISE_TAGS = new Set(['vat-ly', 'javascript']);

// Preferred order for the homepage's topic sections: the subjects a reader is
// most likely to have a question about come first. Any tag not listed here
// still gets a section once it has enough posts — it just sorts after these.
export const TOPIC_ORDER = [
  'co-hoc',
  'nhiet-hoc',
  'quang-hoc',
  'dien-tu',
  'song',
  'am-thanh',
  'thien-van',
  'chat-luu',
  'khi-hau',
  'dao-dong',
  'dien-hoc',
  'luong-tu',
  'hat-nhan',
  'tuong-doi',
  'mo-phong',
];

// A tag earns a homepage section once it has this many posts. Below it, the
// section would be a stub that makes the catalog look thinner than it is.
const SECTION_MIN = 5;

// The homepage sections, derived from what has actually been published rather
// than from a hand-kept list — so a new subject area appears on the front page
// as soon as it has the posts to fill a section, and none can be forgotten.
export const homeTopics = (posts: CollectionEntry<'posts'>[]): string[] => {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of meaningfulTags(post)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const rank = (tag: string) => {
    const i = TOPIC_ORDER.indexOf(tag);
    return i === -1 ? TOPIC_ORDER.length : i;
  };
  return [...counts.entries()]
    .filter(([, n]) => n >= SECTION_MIN)
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])
    .map(([tag]) => tag);
};

export const tagLabel = (locale: string, tag: string): string =>
  TAG_LABELS[locale]?.[tag] ?? tag;

export const meaningfulTags = (post: CollectionEntry<'posts'>): string[] =>
  post.data.tags.filter((t) => !NOISE_TAGS.has(t));

// The physics catalog: every demo post carries the vat-ly tag; the handful of
// republished/off-topic notes don't. One tag check keeps the two worlds apart.
export const isPhysics = (post: CollectionEntry<'posts'>): boolean =>
  post.data.tags.includes('vat-ly');
