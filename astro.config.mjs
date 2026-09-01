// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { rehypeBasePaths } from './src/plugins/rehype-base-paths.mjs';

// Single source of truth for where the site lives. Moving to a custom domain
// means editing these two lines and nothing else: the redirect below, the
// robots.txt endpoint and every asset path inside Markdown all derive from
// them. See src/plugins/rehype-base-paths.mjs for the Markdown half.
const SITE = 'https://angelline2005.github.io';
const BASE = '/sharelab';

// BASE without its trailing slash, so it can be concatenated with a path that
// starts with one. Empty string when the site sits at the domain root, where
// `${BASE}/vi/` would otherwise build the unparseable "//vi/".
const BASE_PREFIX = BASE.replace(/\/+$/, '');

const basePaths = rehypeBasePaths({ base: BASE });

// https://astro.build/config
export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'vi',
    locales: ['vi', 'en'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  integrations: [sitemap(), mdx()],
  markdown: {
    // Astro 7's default Markdown processor ignores `markdown.rehypePlugins`;
    // plugins only run when the processor is built explicitly like this. MDX
    // reads `rehypePlugins` separately, so the plugin has to be named twice to
    // cover both .md and .mdx.
    processor: unified({ rehypePlugins: [basePaths] }),
    rehypePlugins: [basePaths],
  },
  redirects: {
    // Astro's redirects config does not auto-prepend `base` to the destination
    // (only to the route itself), so this needs the full path spelled out.
    '/': `${BASE_PREFIX}/vi/`,
  },
});
