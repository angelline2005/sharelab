import type { APIRoute } from 'astro';

// AdSense's ads.txt, generated like robots.txt so the publisher ID lives in
// one place: the PUBLIC_ADSENSE_CLIENT repository variable ("ca-pub-…").
// ads.txt wants the bare "pub-…" form, hence the strip. While the variable is
// unset the file builds empty, which crawlers treat the same as absent.
export const GET: APIRoute = () => {
  const client = (import.meta.env.PUBLIC_ADSENSE_CLIENT as string | undefined) ?? '';
  const match = client.match(/^(?:ca-)?(pub-\d{10,20})$/);
  const body = match ? `google.com, ${match[1]}, DIRECT, f08c47fec0942fa0\n` : '';

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
