// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { rehypeBasePaths } from './src/plugins/rehype-base-paths.mjs';

const SITE = 'https://sharelab.fyi';
const BASE = '/';

// BASE without its trailing slash, so it can be concatenated with a path that
// starts with one. Empty string when the site sits at the domain root, where
// `${BASE}/vi/` would otherwise build the unparseable "//vi/".
const BASE_PREFIX = BASE.replace(/\/+$/, '');

const basePaths = rehypeBasePaths({ base: BASE });

// https://astro.build/config
// Pages that exist but must never be submitted to Google: the search shell is
// empty until Pagefind's JS runs, and /donate/ is unlinked from the nav while
// no Ko-fi account exists. Keep this in step with the `noindex` prop on each
// page — a noindex URL left in the sitemap makes Search Console report
// "Submitted URL marked noindex".
const NOINDEXED = ['/tim-kiem/', '/donate/', '/vat-ly-12/nhiet/'];

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'vi',
    locales: ['vi'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  integrations: [
    sitemap({ filter: (page) => !NOINDEXED.some((p) => page.includes(p)) }),
    mdx(),
  ],
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
    // No entry for '/' — src/pages/index.astro renders it directly now.
    // The two republished non-physics notes were removed on 2026-09-02 to keep
    // the catalog purely original physics. Their URLs were live and in the
    // sitemap, so they redirect instead of 404ing.
    '/vi/posts/len-ke-hoach-cam-trai-bang-ai': `${BASE_PREFIX}/vi/`,
    '/vi/posts/lo-trinh-ai-co-dao-duc-cua-my-latinh': `${BASE_PREFIX}/vi/`,
    // English section removed 2026-09-02: site is Vietnamese physics only.
    // All EN URLs redirect to /vi/ to prevent 404 and preserve SEO credit.
    '/en/': `${BASE_PREFIX}/vi/`,
    '/en/about/': `${BASE_PREFIX}/vi/`,
    '/en/donate/': `${BASE_PREFIX}/vi/`,
    '/en/privacy-policy/': `${BASE_PREFIX}/vi/`,
    '/en/terms/': `${BASE_PREFIX}/vi/`,
    '/en/rss.xml': `${BASE_PREFIX}/vi/rss.xml`,
    '/en/posts/east-africa-replants-forests-with-timber/': `${BASE_PREFIX}/vi/`,
    '/en/posts/how-croatian-communities-are-taking-on-planned-poultry-slaughterhouses/': `${BASE_PREFIX}/vi/`,
    '/en/posts/latin-america-unites-on-ethical-ai-roadmap/': `${BASE_PREFIX}/vi/`,
    '/en/posts/planning-a-camping-trip-with-ai/': `${BASE_PREFIX}/vi/`,
    '/en/posts/why-social-media-algorithms-send-you-posts-you-dont-like-288792/': `${BASE_PREFIX}/vi/`,
  },
});
