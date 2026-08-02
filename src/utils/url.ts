// Joins Astro's BASE_URL (which may or may not end in "/") with an absolute
// path, always producing exactly one slash between them. Use this instead of
// concatenating `${import.meta.env.BASE_URL}/...` directly, which produces a
// double slash whenever BASE_URL already ends in "/" (its default behavior).
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

// For pages that live at the same path in every locale (home, about, donate,
// privacy-policy, terms — anything that isn't a translated blog post with its
// own per-locale slug). `path` excludes the locale prefix, e.g. "/about/".
export function sameSlugLangHrefs(path: string): Record<'vi' | 'en', string> {
  return {
    vi: withBase(`/vi${path}`),
    en: withBase(`/en${path}`),
  };
}
