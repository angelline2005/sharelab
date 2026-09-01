import type { APIRoute } from 'astro';

// Generated rather than kept in public/, so the sitemap URL follows `site` and
// `base` from astro.config.mjs instead of repeating them.
//
// Note that on GitHub Pages this file lands at /sharelab/robots.txt, while
// crawlers only ever read robots.txt from the domain root — which belongs to
// github.io, not to this site. So it does nothing today. It starts working the
// moment the site moves to its own domain, and by then it will already be
// correct.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const sitemap = new URL(`${base}/sitemap-index.xml`, site).href;

  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
