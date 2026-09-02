// Joins Astro's BASE_URL (which may or may not end in "/") with an absolute
// path, always producing exactly one slash between them. Use this instead of
// concatenating `${import.meta.env.BASE_URL}/...` directly, which produces a
// double slash whenever BASE_URL already ends in "/" (its default behavior).
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
