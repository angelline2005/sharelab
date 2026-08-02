// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://angelline2005.github.io',
  base: '/sharelab',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'vi',
    locales: ['vi', 'en'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  integrations: [sitemap(), mdx()],
  redirects: {
    // Astro's redirects config does not auto-prepend `base` to the destination
    // (only to the route itself), so this needs the full path spelled out.
    '/': '/sharelab/vi/',
  },
});
