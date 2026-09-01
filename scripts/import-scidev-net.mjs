#!/usr/bin/env node
// Imports an article from SciDev.Net into src/content/posts/ as a post.
//
// SciDev.Net licenses "the written content of this website" under CC BY 2.0
// and puts a ready-made republish block on every article page. Their crediting
// rules (https://www.scidev.net/global/media/) are:
//   - SciDev.Net credited as the original source of the article "at the start,
//     no more than three paragraphs in"
//   - a link back to the original story
//   - the reporter bylined
//   - their logo where possible
// All four are emitted automatically.
//
// Unlike The Conversation's CC BY-ND, plain CC BY permits derivative works, so
// translating an article into Vietnamese is allowed WITHOUT asking the author
// first. Pass --lang vi to place the post in vi/; the body is still the English
// original at that point and you have to translate it yourself. The credit
// block has to survive the translation.
//
// The licence covers the WRITTEN content only. Photographs are routinely
// licensed from third parties, so figures are stripped unless --with-images.
//
// Usage:
//   node scripts/import-scidev-net.mjs --list [--from <listing-url>]
//   node scripts/import-scidev-net.mjs <article-url> [options]
//
// Options:
//   --lang <en|vi>     Output collection (default: en). vi is legal under CC BY
//                      but leaves you an untranslated file to work on.
//   --from <url>       Listing page to scan for --list (default: the global
//                      home page). Topic hubs like /global/health/ also work.
//   --tags a,b,c       Frontmatter tags (default: scidev-net,science)
//   --with-images      Keep figures. Off by default: CC BY 2.0 covers the text,
//                      NOT the photographs. Clear every credit before using it.
//   --draft            Write with draft: true so it stays off the site.
//   --force            Overwrite an existing post file.

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = (lang) => join(ROOT, 'src', 'content', 'posts', lang);
const HOME = 'https://www.scidev.net/global/';
const LICENCE = 'https://creativecommons.org/licenses/by/2.0/';
const UA = 'sharelab-importer/1.0 (+https://angelline2005.github.io/sharelab/)';

// SciDev.Net's declared RSS feeds all serve HTML and their REST collection is
// closed, so article discovery means reading a listing page.
const ARTICLE_RE =
  /https:\/\/www\.scidev\.net\/global\/(?:news|feature|analysis-blog|opinion)\/[a-z0-9-]+\//g;

// --- tiny HTML helpers -----------------------------------------------------

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

async function getHtml(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.text();
}

// --- article extraction ----------------------------------------------------
// Every article page carries a "Republish" lightbox holding the canonical
// markup SciDev.Net wants republishers to use. That block is the source of
// truth here: it is far cleaner than the page builder markup around it, and
// using it means the text matches what they themselves publish for reuse.

function extractRepublishBlock(html) {
  const m = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i);
  if (!m) return null;
  return /article-wrap|article-body/.test(m[1]) ? m[1] : null;
}

function extractMeta(html) {
  const meta = (name) => {
    const m = html.match(
      new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
    );
    return m ? decodeEntities(m[1]) : '';
  };

  // Yoast emits a WebPage node; it carries the dates the markup does not.
  let node = {};
  for (const [, raw] of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const graph = JSON.parse(raw)['@graph'] || [];
      const found = graph.find((n) => [].concat(n['@type'] || []).includes('WebPage'));
      if (found) node = found;
    } catch {
      // A malformed block is not fatal — the og: tags below still carry enough.
    }
  }

  return {
    title: node.name || meta('og:title'),
    description: node.description || meta('og:description') || meta('description'),
    published: (node.datePublished || meta('article:published_time') || '').slice(0, 10),
    modified: (node.dateModified || meta('article:modified_time') || '').slice(0, 10),
    url: node.url || meta('og:url'),
  };
}

function extractAuthors(block) {
  const h4 = block.match(/<h4[^>]*>\s*By:?\s*([\s\S]*?)<\/h4>/i);
  if (!h4) return [];

  const linked = [...h4[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, profile, name]) => ({ name: stripTags(name).trim(), profile }))
    .filter((a) => a.name);
  if (linked.length > 0) return linked;

  // Some pieces are bylined to a desk rather than to a linked reporter.
  const plain = stripTags(h4[1]).trim();
  return plain ? [{ name: plain, profile: '' }] : [];
}

function extractBody(block) {
  // Cut the trailing furniture first: a related-articles shortcode that would
  // render literally, SciDev's own credit line (re-emitted in `credit` below),
  // and a legacy ga.js snippet.
  let end = block.length;
  for (const marker of [
    '<div class="quick-links-wrapper">',
    '<p>This article was originally published on',
    '<script',
  ]) {
    const i = block.indexOf(marker);
    if (i !== -1 && i < end) end = i;
  }

  const open = '<div id="article-body">';
  const start = block.indexOf(open);
  if (start === -1) return '';
  return block.slice(start + open.length, end).replace(/<\/div>\s*$/, '');
}

// --- HTML -> Markdown ------------------------------------------------------
// The republish block is a small, predictable subset: p, h2-h4, a, em/strong,
// blockquote, ul/ol, img. Anything unrecognised is stripped rather than
// guessed at, so the text never silently changes meaning.

function htmlToMarkdown(html, { withImages }) {
  let md = html;

  md = md.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  md = md.replace(/\[related-articles\]/gi, '');

  md = md.replace(/<img[^>]*>/gi, (tag) => {
    if (!withImages) return '';
    // Images are lazy-loaded, so the real URL sits in data-src.
    const src = (tag.match(/data-src="([^"]+)"/i) || tag.match(/\ssrc="([^"]+)"/i) || [])[1];
    const alt = (tag.match(/alt="([^"]*)"/i) || [])[1] || '';
    return src ? `\n![${alt}](${src})\n` : '';
  });

  md = md.replace(/<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, '\n[Embedded media]($1)\n');

  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, level, text) => {
    const body = stripTags(text).trim();
    // h1 is the block's own title, re-emitted as frontmatter above.
    return Number(level) <= 1 ? '' : `\n\n${'#'.repeat(Math.max(2, Number(level)))} ${body}\n\n`;
  });

  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
    const body = stripTags(inner.replace(/<\/p>/gi, '\n')).trim();
    return `\n\n${body
      .split('\n')
      .filter(Boolean)
      // Pull-quotes wrap the quote and its attribution in h3/h4, which the pass
      // above already turned into headings. Inside a quote they would render as
      // oversized text, so drop the markers and keep the two lines.
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
    ...(article.modified && article.modified !== article.published
      ? [`updatedDate: ${article.modified}`]
      : []),
    `tags: [${tags.map((t) => yamlString(t)).join(', ')}]`,
    `translationId: ${yamlString(`scidev-net-${article.slug}`)}`,
    ...(draft ? ['draft: true'] : []),
    '---',
  ].join('\n');

  // Their guidelines put the credit "at the start, no more than three
  // paragraphs in", so it leads the post. Raw HTML keeps it rendering the same
  // wherever the markdown ends up.
  const credit = `<p class="republished-from">
  <a href="https://www.scidev.net" rel="noopener">
    <img src="/sharelab/scidev-net-logo.png" alt="SciDev.Net" height="24" />
  </a>
</p>

*${byline ? `By ${byline}. ` : ''}Originally published on [SciDev.Net](${article.url}) under a
[Creative Commons Attribution 2.0 licence](${LICENCE}).*`;

  const body = htmlToMarkdown(article.body, { withImages });

  return `${frontmatter}\n\n${credit}\n\n${body}\n`;
}

// --- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    lang: 'en',
    from: HOME,
    tags: ['scidev-net', 'science'],
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
    else if (arg === '--from') opts.from = argv[++i];
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

async function listArticles(from) {
  const html = await getHtml(from);
  const urls = [...new Set(html.match(ARTICLE_RE) || [])];
  if (urls.length === 0) {
    throw new Error(
      `No article links on ${from}. Listing pages load most of their content with ` +
        `JavaScript, so try a topic hub such as https://www.scidev.net/global/health/.`,
    );
  }
  return urls;
}

async function fetchArticle(url) {
  const html = await getHtml(url);
  const block = extractRepublishBlock(html);
  if (!block) {
    throw new Error(
      `No republish block on ${url}. SciDev.Net puts one on every article it licenses ` +
        `for reuse — if it is missing, treat the piece as not cleared and check by hand.`,
    );
  }

  const meta = extractMeta(html);
  const title = stripTags((block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || meta.title).trim();
  const body = extractBody(block);
  if (!body.trim()) {
    throw new Error('Could not find the article body inside the republish block.');
  }

  return {
    slug: url.replace(/\/$/, '').split('/').pop(),
    url: meta.url || url,
    title,
    description: meta.description,
    published: meta.published,
    modified: meta.modified,
    authors: extractAuthors(block),
    body,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.list || !opts.target) {
    const urls = await listArticles(opts.from);
    console.log(`\n${opts.from} — ${urls.length} articles:\n`);
    for (const u of urls) console.log(`  ${u}`);
    console.log('\nImport one with:  node scripts/import-scidev-net.mjs <url>\n');
    if (!opts.target) return;
  }

  if (!/^https:\/\/www\.scidev\.net\//.test(opts.target)) {
    throw new Error(`Expected a full https://www.scidev.net/... article URL, got "${opts.target}"`);
  }

  const article = await fetchArticle(opts.target);
  if (!article.published) {
    throw new Error(`No publication date found for ${opts.target}; refusing to guess one.`);
  }

  const dir = POSTS_DIR(opts.lang);
  const outPath = join(dir, `${article.slug}.md`);
  if (!opts.force && (await exists(outPath))) {
    throw new Error(`${relative(ROOT, outPath)} already exists. Pass --force to overwrite.`);
  }

  await mkdir(dir, { recursive: true });
  await writeFile(outPath, buildPost(article, opts), 'utf8');

  console.log(`\nWrote ${relative(ROOT, outPath)}`);
  console.log(`  title    ${article.title}`);
  console.log(`  authors  ${article.authors.map((a) => a.name).join('; ') || '(none found)'}`);
  console.log(`  source   ${article.url}`);
  console.log('  licence  Creative Commons Attribution 2.0');
  console.log(
    `  images   ${opts.withImages ? 'kept — CC BY 2.0 covers the TEXT only, clear each credit' : 'stripped'}`,
  );
  if (opts.lang === 'vi') {
    console.log('\n  The body is still the English original. CC BY allows the translation,');
    console.log('  but you have to write it, and the credit block must stay with it.');
  }
  console.log('\nRead the article before publishing. Do not bulk-import the site.\n');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exitCode = 1;
});
