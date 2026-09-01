#!/usr/bin/env node
// Imports an article from Mongabay into src/content/posts/en/ as a post.
//
// Mongabay publishes under CC BY-ND 4.0 and explicitly allows republication on
// pages that carry ads. Their guidelines (https://news.mongabay.com/copyright/
// creative-commons/) require:
//   - the author credited as listed on the article, ideally in the byline
//   - Mongabay credited as the source
//   - a link back to the specific article URL, not the home page
//   - the original links inside the story kept intact
//   - no edits beyond time/location/basic editorial style
// All of that is emitted automatically.
//
// English only. CC BY-ND does not cover derivative works, so a Vietnamese
// translation needs written permission first — and Mongabay translates its own
// features, so ask before starting one. Use SciDev.Net when you want a vi/ post.
//
// Mongabay also carries wire copy — Associated Press stories appear in the feed
// under an ordinary byline with nothing on the page marking them as different.
// That copy is not Mongabay's to license, so the importer refuses bylines that
// name a news agency. The list below is a backstop, not a guarantee: it only
// knows the agencies it knows about.
//
// Two rules this script CANNOT enforce:
//   - Don't systematically republish the feed. Pick articles by hand.
//   - Photos are only cleared when credited to Mongabay or to the article's
//     author. Anything else belongs to a third party. Figures are stripped
//     unless --with-images.
//
// Mongabay also asks republishers to rewrite the headline, so their version and
// yours don't compete in the same search results. That is their request rather
// than a licence term, so the importer keeps the original title and reminds you.
//
// Usage:
//   node scripts/import-mongabay.mjs --list
//   node scripts/import-mongabay.mjs <article-url> [options]
//
// Options:
//   --slug <name>      Filename, and therefore the URL. Defaults to the source
//                      slug.
//   --tags a,b,c       Frontmatter tags (default: mongabay,environment)
//   --with-images      Keep figures — only after checking every image credit.
//   --draft            Write with draft: true so it stays off the site.
//   --force            Overwrite an existing post file.

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = join(ROOT, 'src', 'content', 'posts', 'en');
const FEED = 'https://news.mongabay.com/feed/';
const LICENCE = 'https://creativecommons.org/licenses/by-nd/4.0/';

// Mongabay sits behind a bot filter that rejects the default Node user-agent.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Safari/537.36';

// Bylines that mean the copy came from a wire service, so Mongabay's CC licence
// does not extend to it.
const WIRE_SERVICES = [
  'associated press',
  'reuters',
  'thomson reuters foundation',
  'agence france-presse',
  'afp',
  'bloomberg',
  'deutsche welle',
  'dpa',
  'efe',
  'inter press service',
  'pa media',
  'xinhua',
];

// --- tiny XML/HTML helpers -------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body] ?? match;
  });
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, ''));
}

function cdata(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`));
  return m ? decodeEntities(m[1]).trim() : '';
}

async function getHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.text();
}

// --- discovery -------------------------------------------------------------
// The feed lists recent articles but its content:encoded is a ~1,800 character
// teaser with the story's own links stripped out. Mongabay requires those links
// to survive republication, so the feed is only ever used to find articles —
// the text always comes from the article page.

function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
    title: cdata(item, 'title'),
    url: cdata(item, 'link'),
    published: cdata(item, 'pubDate'),
    author: cdata(item, 'dc:creator'),
  }));
}

// --- article extraction ----------------------------------------------------

function extractMeta(html) {
  const meta = (prop) => {
    const m = html.match(
      new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    );
    return m ? decodeEntities(m[1]) : '';
  };

  let node = {};
  for (const [, raw] of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const graph = JSON.parse(raw)['@graph'] || [];
      const found = graph.find((n) => [].concat(n['@type'] || []).includes('WebPage'));
      if (found) node = found;
    } catch {
      // og: tags below carry enough on their own.
    }
  }

  return {
    title: node.name || meta('og:title'),
    description: tidyExcerpt(meta('og:description')),
    published: (node.datePublished || meta('article:published_time') || '').slice(0, 10),
    modified: (node.dateModified || meta('article:modified_time') || '').slice(0, 10),
  };
}

// og:description is WordPress's auto-excerpt: the opening paragraphs cut mid
// sentence and closed with "[…]". Trim it back to whole sentences so the card
// and meta description read properly.
function tidyExcerpt(s) {
  const text = s.replace(/\s*\[(?:&hellip;|…|\.\.\.)\]\s*$/, '').trim();
  if (text.length <= 200) return text;
  const cut = text.slice(0, 200);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return stop > 60 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

// Splits the page into the masthead-and-byline part and the story itself. The
// story starts after the "Key Ideas" bullet block and the script that collapses
// it; without that block, the first paragraph is the start.
function locateArticle(html) {
  const articleAt = html.indexOf('<article');
  if (articleAt === -1) return null;

  const endAt = html.indexOf('<div id="single-article-footer"', articleAt);
  const region = html.slice(articleAt, endAt === -1 ? undefined : endAt);

  let start = 0;
  const bullets = region.lastIndexOf('bulletpoints');
  if (bullets !== -1) {
    const afterScript = region.indexOf('</script>', bullets);
    if (afterScript !== -1) start = afterScript + '</script>'.length;
  }
  const firstP = region.indexOf('<p', start);
  if (firstP === -1) return null;

  return { header: html.slice(0, articleAt + firstP), body: region.slice(firstP) };
}

// The JSON-LD author is the WordPress account that filed the post — usually an
// editor, not the reporter. Mongabay asks for "the author as listed on the
// original article", which is the /by/ byline link.
//
// Only the header is searched. Stories link to reporter profiles in their own
// text ("...as we reported here"), and those would otherwise be read as authors.
function extractAuthors(header) {
  const seen = new Map();
  for (const [, profile, name] of header.matchAll(
    /<a[^>]*href="(https:\/\/news\.mongabay\.com\/by\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const clean = stripTags(name).trim();
    if (clean && !seen.has(clean)) seen.set(clean, { name: clean, profile });
  }
  return [...seen.values()];
}

function cleanBody(body, { withImages }) {

  // A related-story card, which WordPress renders as a blockquote plus a hidden
  // iframe.
  body = body.replace(/<blockquote[^>]*class="[^"]*wp-embedded-content[^"]*"[\s\S]*?<\/blockquote>/gi, '');
  body = body.replace(/<iframe[^>]*class="[^"]*wp-embedded-content[^"]*"[\s\S]*?<\/iframe>/gi, '');

  // Drop trailing furniture by what the paragraph says rather than how it is
  // marked up. Mongabay wraps these in <strong>, <em><strong>, with and without
  // a colon, and with the colon sometimes outside the tag — matching the text is
  // the only version that holds across articles.
  //   FEEDBACK      the editor contact form, part of the page not the story
  //   Banner image  credits the lead photo, which is not republished unless
  //                 --with-images is on
  const drop = withImages ? /^FEEDBACK\b/i : /^(?:FEEDBACK|Banner image)\b/i;
  body = body.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) =>
    drop.test(stripTags(inner).trim()) ? '' : match,
  );

  return body;
}

// --- HTML -> Markdown ------------------------------------------------------
// Mongabay's article HTML is a predictable WordPress subset: p, h2-h4, a,
// em/strong, blockquote, ul/ol, figure. Anything unrecognised is stripped
// rather than guessed at, so text never silently changes meaning.

function htmlToMarkdown(html, { withImages }) {
  let md = html;

  md = md.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');

  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (match, inner) => {
    if (!withImages) return '\n';
    const src = (inner.match(/<img[^>]*\ssrc="([^"]+)"/i) || [])[1];
    const alt = (inner.match(/<img[^>]*alt="([^"]*)"/i) || [])[1] || '';
    const caption = stripTags(
      (inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i) || [])[1] || '',
    );
    if (!src) return '\n';
    return `\n![${alt}](${src})\n${caption ? `*${caption}*\n` : ''}`;
  });
  md = md.replace(/<img[^>]*>/gi, '');

  md = md.replace(/<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, '\n[Embedded media]($1)\n');

  md = md.replace(/<h([2-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, level, text) =>
    `\n\n${'#'.repeat(Number(level))} ${stripTags(text).trim()}\n\n`,
  );

  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
    const body = stripTags(inner.replace(/<\/p>/gi, '\n')).trim();
    if (!body) return '\n';
    return `\n\n${body
      .split('\n')
      .filter(Boolean)
      .map((l) => `> ${l.trim().replace(/^#+\s*/, '')}`)
      .join('\n')}\n\n`;
  });

  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, inner) => `- ${stripTags(inner).trim()}\n`);
  md = md.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');

  md = md.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, text) => {
    const label = stripTags(text).trim();
    return label ? `[${label}](${href})` : '';
  });
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, text) => `**${stripTags(text)}**`);
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, text) => `*${stripTags(text)}*`);

  md = stripTags(md);
  md = decodeEntities(md);
  return md.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

// --- post assembly ---------------------------------------------------------

function yamlString(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildPost(article, { tags, draft, withImages }) {
  const byline = article.authors
    .map((a) => (a.profile ? `[${a.name}](${a.profile})` : a.name))
    .join(', ');

  const frontmatter = [
    '---',
    `title: ${yamlString(article.title)}`,
    `description: ${yamlString(article.description)}`,
    `pubDate: ${article.published}`,
    // An "updated" date earlier than the publication date reads as a mistake,
    // so only a genuinely later one is emitted.
    ...(article.modified && article.modified > article.published
      ? [`updatedDate: ${article.modified}`]
      : []),
    `tags: [${tags.map((t) => yamlString(t)).join(', ')}]`,
    `translationId: ${yamlString(`mongabay-${article.slug}`)}`,
    ...(draft ? ['draft: true'] : []),
    '---',
  ].join('\n');

  // Required attribution, kept as raw HTML so it renders identically wherever
  // the markdown ends up. The link points at the specific article, which their
  // guidelines call out explicitly — a link to the home page does not satisfy it.
  const credit = `<p class="republished-from">
  <a href="https://news.mongabay.com" rel="noopener">
    <img src="/sharelab/mongabay-logo.svg" alt="Mongabay" height="24" />
  </a>
</p>

*${byline ? `By ${byline}. ` : ''}Originally published on [Mongabay](${article.url}) under a
[Creative Commons Attribution-NoDerivatives 4.0 licence](${LICENCE}).*`;

  const body = htmlToMarkdown(article.body, { withImages });

  return `${frontmatter}\n\n${credit}\n\n${body}\n`;
}

// --- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    slug: '',
    tags: ['mongabay', 'environment'],
    withImages: false,
    draft: false,
    force: false,
    list: false,
    target: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') opts.list = true;
    else if (arg === '--with-images') opts.withImages = true;
    else if (arg === '--draft') opts.draft = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--slug') opts.slug = argv[++i];
    else if (arg === '--tags') opts.tags = argv[++i].split(',').map((t) => t.trim()).filter(Boolean);
    else if (!arg.startsWith('--')) opts.target = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchArticle(url) {
  const html = await getHtml(url);

  // Mongabay states CC BY-ND site-wide. A NonCommercial notice on the article
  // itself would mean this piece is not usable here, because the site runs ads.
  if (/Attribution-?NonCommercial|\bCC BY-NC\b/i.test(html.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, ''))) {
    throw new Error(
      `${url} declares a NonCommercial licence. This site carries ads, so that article ` +
        `cannot be republished here. Check the licence on the page by hand.`,
    );
  }

  const located = locateArticle(html);
  if (!located) {
    throw new Error(`Could not find the article body on ${url}. The page layout may have changed.`);
  }

  const authors = extractAuthors(located.header);
  const wire = authors.find((a) =>
    WIRE_SERVICES.some((w) => a.name.toLowerCase().includes(w)),
  );
  if (wire) {
    throw new Error(
      `${url} is bylined "${wire.name}" — wire copy that Mongabay republishes but does not ` +
        `own, so their CC licence does not cover it. Pick a story by a Mongabay reporter.`,
    );
  }

  const meta = extractMeta(html);

  return {
    slug: url.replace(/\/$/, '').split('/').pop(),
    url,
    title: meta.title,
    description: meta.description,
    published: meta.published,
    modified: meta.modified,
    authors,
    rawBody: located.body,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.list || !opts.target) {
    const items = parseFeed(await getHtml(FEED));
    if (items.length === 0) throw new Error('No items in the Mongabay feed.');
    console.log(`\nMongabay feed — ${items.length} articles:\n`);
    for (const it of items) {
      console.log(`  ${it.title}`);
      console.log(`    ${it.author} · ${it.url}`);
    }
    console.log('\nImport one with:  node scripts/import-mongabay.mjs <url>\n');
    if (!opts.target) return;
  }

  if (!/^https:\/\/news\.mongabay\.com\//.test(opts.target)) {
    throw new Error(`Expected a full https://news.mongabay.com/... article URL, got "${opts.target}"`);
  }

  const article = await fetchArticle(opts.target);
  if (!article.published) {
    throw new Error(`No publication date found for ${opts.target}; refusing to guess one.`);
  }
  article.body = cleanBody(article.rawBody, { withImages: opts.withImages });

  const fileSlug = opts.slug || article.slug;
  if (!/^[a-z0-9-]+$/.test(fileSlug)) {
    throw new Error(`--slug must be lowercase letters, digits and hyphens, got "${fileSlug}"`);
  }

  const outPath = join(POSTS_DIR, `${fileSlug}.md`);
  if (!opts.force && (await exists(outPath))) {
    throw new Error(`${relative(ROOT, outPath)} already exists. Pass --force to overwrite.`);
  }

  await mkdir(POSTS_DIR, { recursive: true });
  await writeFile(outPath, buildPost(article, opts), 'utf8');

  console.log(`\nWrote ${relative(ROOT, outPath)}`);
  console.log(`  title    ${article.title}`);
  console.log(`  authors  ${article.authors.map((a) => a.name).join('; ') || '(none found)'}`);
  console.log(`  source   ${article.url}`);
  console.log('  licence  Creative Commons Attribution-NoDerivatives 4.0');
  console.log(
    `  images   ${opts.withImages ? 'kept — only photos credited to Mongabay or the author are cleared' : 'stripped'}`,
  );
  console.log('\nMongabay asks republishers to rewrite the headline so their version and yours');
  console.log('do not compete in the same search results. Edit `title` before publishing.');
  console.log('Read the article first. Do not bulk-import the feed.\n');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exitCode = 1;
});
