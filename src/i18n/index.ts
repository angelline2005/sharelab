import vi from './vi.json';

export const locales = ['vi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'vi';

const dictionaries: Record<Locale, Record<string, string>> = { vi };

export function useTranslations(locale: Locale) {
  const dict = dictionaries[locale] ?? dictionaries[defaultLocale];
  return (key: string) => dict[key] ?? key;
}

export function getLocaleFromUrl(url: URL): Locale {
  const first = url.pathname.split('/').filter(Boolean)[0];
  return (locales as readonly string[]).includes(first) ? (first as Locale) : defaultLocale;
}
