#!/usr/bin/env node
// Imports an article from Global Voices into src/content/posts/ as a post.
//
// Global Voices publishes under a plain CC BY licence — "Attribution-Only", in
// their words — which permits commercial use and derivative works. Their
// attribution policy (https://globalvoices.org/about/global-voices-attribution-
// policy/) requires:
//   - a link to the original story and the author's name AT THE TOP of the post
//   - a link to the licence
//   - an indication of whether changes were made
// All three are emitted automatically, in the wording their own example uses.
//
// Like SciDev.Net and unlike The Conversation, CC BY permits translation without
// asking first, so --lang vi is available. Global Voices runs translations into
// 40+ languages through its Lingua project but has no Vietnamese edition
// (vi.globalvoices.org is a 404), so a Vietnamese version is genuinely new.
//
// NOT everything on the site is CC BY. Their policy says "unless otherwise
// stated", and stories from content partners — Nepali Times, Prachatai and
// others — are republished by Global Voices under bilateral agreements, not
// under the CC licence. Those are refused; see PARTNER_MARKERS.
//
// Two rules this script CANNOT enforce:
//   - Don't bulk-import. Pick articles by hand and read them first.
//   - Photos, video and audio are frequently third-party: "You must seek
//     permission directly from creators to republish their work." Images are
//     stripped unless --with-images.
//
// Usage:
//   node scripts/import-global-voices.mjs --list
//   node scripts/import-global-voices.mjs <article-url> [options]
//
// Options:
//   --lang <en|vi>     Output collection (default: en). vi is legal under CC BY
//                      but leaves you an untranslated file to work on.
//   --slug <name>      Filename, and therefore the URL. Defaults to the source
//                      slug; give a Vietnamese one for a vi/ post.
//   --tags a,b,c       Frontmatter tags (default: global-voices,world)
//   --with-images      Keep figures — only after clearing each photo credit.
//   --draft            Write with draft: true so it stays off the site.
//   --force            Overwrite an existing post file.

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = (lang) => join(ROOT, 'src', 'content', 'posts', lang);
const API = 'https://globalvoices.org/wp-json/wp/v2/posts';
const FEED = 'https://globalvoices.org/feed/';
const LICENCE = 'https://creativecommons.org/licenses/by/3.0/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Safari/537.36';

// Phrases that mark a story as coming from a content partner rather than from
// Global Voices itself. Checked against the article text; any hit is refused.
const PARTNER_MARKERS = [
  /content partner(?:ship)?\b/i,
  /originally published (?:in|on|at|by)\s+(?!Global Voices)/i,
  /(?:was|been) published by\s+(?!Global Voices)/i,
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

async function get(url, { json = false } = {}) {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: json ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return json ? res.json() : res.text();
}

// --- article extraction ----------------------------------------------------
// The WordPress REST API serves the article as clean HTML with the story's own
// links intact, which is what the licence's "indicate if changes were made"
// condition makes worth preserving. Two things it will not give us:
//
//   - The author. /wp/v2/users is closed (HTTP 401) and _embed comes back empty,
//     so the byline is read from the article page's <meta name="byl">.
//   - A licence marker. Nothing on the article says whether it is CC BY or
//     partner content, so that is inferred from the text — see PARTNER_MARKERS.

async function fetchPost(slug) {
  const posts = await get(`${API}?slug=${encodeURIComponent(slug)}`, { json: true });
  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error(`No Global Voices article with the slug "${slug}".`);
  }
  return posts[0];
}

async function fetchByline(url) {
  const html = await get(url);
  const m =
    html.match(/<meta[^>]*name="byl"[^>]*content="([^"]*)"/i) ||
    html.match(/<meta[^>]*name="author"[^>]*content="([^"]*)"/i);
  return m ? decodeEntities(m[1]).trim() : '';
}

function assertNotPartnerContent(text, url) {
  const marker = PARTNER_MARKERS.find((re) => re.test(text));
  if (!marker) return;
  throw new Error(
    `${url} looks like content-partner material, not a Global Voices original. ` +
      `Their CC BY licence covers "content created by Global Voices"; partner stories ` +
      `run under separate agreements. Read the article and clear it by hand if you ` +
      `believe this is wrong.`,
  );
}

// --- HTML -> Markdown ------------------------------------------------------
// The REST content is a predictable subset: p, h3/h4, a, em/strong, span, img
// inside wp-caption divs, and the occasional factbox. Anything unrecognised is
// stripped rather than guessed at, so the text never silently changes meaning.

function htmlToMarkdown(html, { withImages }) {
  let md = html;

  md = md.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');

  // Images live in <div class="wp-caption"> with the credit in a caption
  // paragraph. Dropping the div takes the caption with it, which is right: the
  // caption credits a photo that is not being republished.
  md = md.replace(/<div[^>]*class="[^"]*wp-caption[^"]*"[\s\S]*?<\/div>/gi, (block) => {
    if (!withImages) return '\n';
    const src = (block.match(/<img[^>]*\ssrc="([^"]+)"/i) || [])[1];
    const alt = (block.match(/<img[^>]*alt="([^"]*)"/i) || [])[1] || '';
    const caption = stripTags(
      (block.match(/<p[^>]*class="[^"]*wp-caption-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '',
    ).trim();
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
  md = md.replace(/<\/(p|div)>/gi, '\n\n');
  md = md.replace(/<(p|div|span)[^>]*>/gi, '');

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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function longDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

function viDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

function buildPost(article, { tags, draft, withImages, lang }) {
  const frontmatter = [
    '---',
    `title: ${yamlString(article.title)}`,
    `description: ${yamlString(article.description)}`,
    `pubDate: ${article.published}`,
    // WordPress reports `modified` from the last edit, which for a scheduled
    // post predates publication. An "updated" date earlier than the publication
    // date reads as a mistake, so only a genuinely later one is emitted.
    ...(article.modified && article.modified > article.published
      ? [`updatedDate: ${article.modified}`]
      : []),
    `tags: [${tags.map((t) => yamlString(t)).join(', ')}]`,
    `translationId: ${yamlString(`global-voices-${article.slug}`)}`,
    ...(draft ? ['draft: true'] : []),
    '---',
  ].join('\n');

  // Their policy puts the credit at the top and gives the wording to use:
  // "This story by Lahar Sarsen originally appeared on Global Voices on
  // March 10, 2014." The licence link and, for a translation, the statement
  // that the material was changed are both conditions of CC BY.
  const by = article.author ? `by ${article.author} ` : '';
  const attribution = lang === 'vi'
    ? `*Bài viết ${article.author ? `của ${article.author} ` : ''}đăng lần đầu trên [Global Voices](${article.url}) ngày ${viDate(article.published)}, theo giấy phép
[Creative Commons Attribution 3.0](${LICENCE}). Bản tiếng Việt do sharelab dịch.*`
    : `*This story ${by}originally appeared on [Global Voices](${article.url}) on ${longDate(article.published)},
and is republished under a [Creative Commons Attribution 3.0 licence](${LICENCE}).*`;

  const credit = `<p class="republished-from">
  <a href="https://globalvoices.org" rel="noopener">
    <img src="/sharelab/global-voices-logo.png" alt="Global Voices" height="24" />
  </a>
</p>

${attribution}`;

  const body = htmlToMarkdown(article.body, { withImages });

  return `${frontmatter}\n\n${credit}\n\n${body}\n`;
}

// --- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    lang: 'en',
    slug: '',
    tags: ['global-voices', 'world'],
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
    else if (arg === '--lang') opts.lang = argv[++i];
    else if (arg === '--slug') opts.slug = argv[++i];
    else if (arg === '--tags') opts.tags = argv[++i].split(',').map((t) => t.trim()).filter(Boolean);
    else if (!arg.startsWith('--')) opts.target = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!['en', 'vi'].includes(opts.lang)) {
    throw new Error(`--lang must be en or vi, got "${opts.lang}"`);
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

// The feed is used for --list rather than the REST API because it carries
// dc:creator, and the byline is what tells you a story came from a content
// partner before you spend a request importing it.
async function listArticles() {
  const xml = await get(FEED);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const field = (tag) => {
      const m = item.match(
        new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`),
      );
      return m ? decodeEntities(m[1]).trim() : '';
    };
    return { title: field('title'), url: field('link'), author: field('dc:creator') };
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.list || !opts.target) {
    const items = await listArticles();
    if (items.length === 0) throw new Error('No items in the Global Voices feed.');
    console.log(`\nGlobal Voices feed — ${items.length} articles:\n`);
    for (const it of items) {
      console.log(`  ${it.title}`);
      console.log(`    ${it.author} · ${it.url}`);
    }
    console.log('\nA byline naming a publication rather than a person is usually');
    console.log('content-partner material, which the CC licence does not cover.\n');
    if (!opts.target) return;
  }

  if (!/^https:\/\/globalvoices\.org\//.test(opts.target)) {
    throw new Error(`Expected a full https://globalvoices.org/... article URL, got "${opts.target}"`);
  }

  const slug = opts.target.replace(/\/$/, '').split('/').pop();
  const post = await fetchPost(slug);
  const bodyHtml = post.content?.rendered || '';
  if (!bodyHtml.trim()) throw new Error(`${opts.target} came back with an empty body.`);

  assertNotPartnerContent(stripTags(bodyHtml), opts.target);

  const article = {
    slug: post.slug,
    url: post.link,
    title: stripTags(post.title?.rendered || '').trim(),
    description: stripTags(post.excerpt?.rendered || '').replace(/\s+/g, ' ').trim(),
    published: (post.date || '').slice(0, 10),
    modified: (post.modified || '').slice(0, 10),
    author: await fetchByline(post.link),
    body: bodyHtml,
  };
  if (!article.published) {
    throw new Error(`No publication date for ${opts.target}; refusing to guess one.`);
  }

  const fileSlug = opts.slug || article.slug;
  if (!/^[a-z0-9-]+$/.test(fileSlug)) {
    throw new Error(`--slug must be lowercase letters, digits and hyphens, got "${fileSlug}"`);
  }

  const dir = POSTS_DIR(opts.lang);
  const outPath = join(dir, `${fileSlug}.md`);
  if (!opts.force && (await exists(outPath))) {
    throw new Error(`${relative(ROOT, outPath)} already exists. Pass --force to overwrite.`);
  }

  await mkdir(dir, { recursive: true });
  await writeFile(outPath, buildPost(article, opts), 'utf8');

  console.log(`\nWrote ${relative(ROOT, outPath)}`);
  console.log(`  title    ${article.title}`);
  console.log(`  author   ${article.author || '(none found)'}`);
  console.log(`  source   ${article.url}`);
  console.log('  licence  Creative Commons Attribution 3.0');
  console.log(
    `  images   ${opts.withImages ? 'kept — photos are often third-party, clear each credit' : 'stripped'}`,
  );
  if (opts.lang === 'vi') {
    console.log('\n  The body is still the English original. CC BY allows the translation,');
    console.log('  but you have to write it, and the credit block must stay with it.');
  }
  console.log('\nRead the article before publishing. Do not bulk-import the feed.\n');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exitCode = 1;
});
