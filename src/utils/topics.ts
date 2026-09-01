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
  en: {
    'co-hoc': 'Mechanics',
    'nhiet-hoc': 'Thermodynamics',
    'quang-hoc': 'Optics',
    'dien-tu': 'Electricity & magnetism',
    'dien-hoc': 'Electricity',
    song: 'Waves',
    'am-thanh': 'Sound',
    'thien-van': 'Astronomy',
    'chat-luu': 'Fluids',
    'khi-hau': 'Climate & weather',
    'dao-dong': 'Oscillations',
    'hat-nhan': 'Nuclear',
    'tuong-doi': 'Relativity',
    'luong-tu': 'Quantum',
    'mo-phong': 'Simulation',
    'vat-ly': 'Physics',
    javascript: 'JavaScript',
  },
};

// Tags that appear on (nearly) every physics post and therefore carry no
// signal for navigation or related-post ranking.
export const NOISE_TAGS = new Set(['vat-ly', 'javascript']);

// The topic sections shown on the homepage, in display order. Everything else
// stays reachable through the tag chips on individual posts.
export const HOME_TOPICS = [
  'co-hoc',
  'nhiet-hoc',
  'quang-hoc',
  'dien-tu',
  'song',
  'thien-van',
  'chat-luu',
  'khi-hau',
];

export const tagLabel = (locale: string, tag: string): string =>
  TAG_LABELS[locale]?.[tag] ?? tag;

export const meaningfulTags = (post: CollectionEntry<'posts'>): string[] =>
  post.data.tags.filter((t) => !NOISE_TAGS.has(t));

// The physics catalog: every demo post carries the vat-ly tag; the handful of
// republished/off-topic notes don't. One tag check keeps the two worlds apart.
export const isPhysics = (post: CollectionEntry<'posts'>): boolean =>
  post.data.tags.includes('vat-ly');
