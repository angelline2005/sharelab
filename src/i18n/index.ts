import vi from './vi.json';
import en from './en.json';

export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'vi';

const dictionaries: Record<Locale, Record<string, string>> = { vi, en };

export function useTranslations(locale: Locale) {
  const dict = dictionaries[locale] ?? dictionaries[defaultLocale];
  return (key: string) => dict[key] ?? key;
}

export function getLocaleFromUrl(url: URL): Locale {
  const first = url.pathname.split('/').filter(Boolean)[0];
  return (locales as readonly string[]).includes(first) ? (first as Locale) : defaultLocale;
}
