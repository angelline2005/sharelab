#!/usr/bin/env node
// Imports an article from The Conversation into src/content/posts/ as a post.
//
// The Conversation publishes under CC BY-ND 4.0 and explicitly allows free
// republication, including on pages that carry ads. Their guidelines require:
//   - the author byline with their institution
//   - a credit link back to The Conversation
//   - their logo, preferably near the top
//   - the 1x1 view-counter pixel
//   - no edits to the text beyond time/location/editorial style
// Everything above is emitted automatically. Two rules this script CANNOT
// enforce, and that you have to honour yourself:
//   - Don't systematically republish the whole feed. Pick articles by hand.
//   - Translating an article needs the author's approval first, so imported
//     posts land in `en/` only. See docs/republishing-the-conversation.md.
//
// Usage:
//   node scripts/import-the-conversation.mjs --list [--section technology]
//   node scripts/import-the-conversation.mjs <article-url|article-id> [options]
//
// Options:
//   --section <name>   Feed to search (default: technology, i.e. "Science + Tech")
//   --tags a,b,c       Frontmatter tags (default: the-conversation,science)
//   --with-images      Keep figures. Off by default: some article images are
//                      licensed from wire services and are NOT covered by the
//                      CC licence. Check every credit before turning this on.
//   --draft            Write with draft: true so it stays off the site.
//   --force            Overwrite an existing post file.

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = join(ROOT, 'src', 'content', 'posts', 'en');
const FEED = (section) => `https://theconversation.com/us/${section}/articles.atom`;
const COUNTER = (id) =>
  `https://counter.theconversation.com/content/${id}/count.gif?distributor=republish-lite-1`;

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

function tagText(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(m[1]).trim() : '';
}

function parseEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => {
    const authors = [...entry.matchAll(/<author>([\s\S]*?)<\/author>/g)].map(([, a]) => ({
      name: tagText(a, 'name'),
      profile: (a.match(/rdf:resource="([^"]+)"/) || [])[1] || '',
    }));
    const url = (entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || [])[1] || '';
    return {
      id: (entry.match(/article\/(\d+)/) || [])[1] || '',
      url,
      slug: url.split('/').pop() || '',
      title: tagText(entry, 'title'),
      summary: tagText(entry, 'summary').replace(/\s+/g, ' '),
      published: tagText(entry, 'published'),
      rights: tagText(entry, 'rights'),
      html: tagText(entry, 'content'),
      authors,
    };
  });
}

// --- HTML -> Markdown ------------------------------------------------------
// The Conversation's article HTML is a small, predictable subset: p, h2-h4, a,
// em/strong, blockquote, ul/ol, hr, figure. Anything unrecognised is stripped
// rather than guessed at, so text never silently changes meaning.

function htmlToMarkdown(html, { withImages }) {
  let md = html;

  md = md.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');

  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (match, inner) => {
    if (!withImages) return '\n';
    const src = (inner.match(/<img[^>]*src="([^"]+)"/i) || [])[1];
    const alt = (inner.match(/<img[^>]*alt="([^"]*)"/i) || [])[1] || '';
    const caption = stripTags(
      (inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i) || [])[1] || '',
    );
    if (!src) return '\n';
    return `\n![${alt}](${src})\n${caption ? `*${caption}*\n` : ''}`;
  });

  // Embedded players (YouTube, datawrapper) can't render in markdown; leave a link.
  md = md.replace(/<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, '\n[Embedded media]($1)\n');

  md = md.replace(/<h([2-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, level, text) =>
    `\n\n${'#'.repeat(Number(level))} ${stripTags(text)}\n\n`,
  );

  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
    const body = stripTags(inner.replace(/<\/p>/gi, '\n')).trim();
    return `\n\n${body.split('\n').filter(Boolean).map((l) => `> ${l.trim()}`).join('\n')}\n\n`;
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

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, ''));
}

// --- post assembly ---------------------------------------------------------

function yamlString(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildPost(entry, { tags, draft, withImages }) {
  const byline = entry.authors
    .map((a) => (a.profile ? `[${a.name}](${a.profile})` : a.name))
    .join(', ');

  const frontmatter = [
    '---',
    `title: ${yamlString(entry.title)}`,
    `description: ${yamlString(entry.summary)}`,
    `pubDate: ${entry.published.slice(0, 10)}`,
    `tags: [${tags.map((t) => yamlString(t)).join(', ')}]`,
    `translationId: ${yamlString(`the-conversation-${entry.id}`)}`,
    ...(draft ? ['draft: true'] : []),
    '---',
  ].join('\n');

  // Required attribution, kept as raw HTML so it renders identically wherever
  // the markdown ends up.
  const credit = `<p class="republished-from">
  <a href="https://theconversation.com" rel="noopener">
    <img src="/the-conversation-logo.svg" alt="The Conversation" height="24" />
  </a>
</p>

*By ${byline}. Originally published on [The Conversation](${entry.url}) under a
[Creative Commons Attribution-NoDerivatives 4.0 licence](https://creativecommons.org/licenses/by-nd/4.0/).*`;

  const pixel = `<img src="${COUNTER(entry.id)}" alt="The Conversation" width="1" height="1" style="border:none !important;box-shadow:none !important;margin:0 !important;max-height:1px !important;max-width:1px !important;min-height:1px !important;min-width:1px !important;opacity:0 !important;outline:none !important;padding:0 !important" />`;

  const body = htmlToMarkdown(entry.html, { withImages });

  return `${frontmatter}\n\n${credit}\n\n${body}\n\n${pixel}\n`;
}

// --- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    section: 'technology',
    tags: ['the-conversation', 'science'],
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
    else if (arg === '--section') opts.section = argv[++i];
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const res = await fetch(FEED(opts.section));
  if (!res.ok) throw new Error(`Feed ${opts.section} returned HTTP ${res.status}`);
  const entries = parseEntries(await res.text());
  if (entries.length === 0) throw new Error(`No entries in the "${opts.section}" feed`);

  if (opts.list || !opts.target) {
    console.log(`\n"${opts.section}" feed — ${entries.length} articles:\n`);
    for (const e of entries) {
      console.log(`  ${e.id}  ${e.published.slice(0, 10)}  ${e.title}`);
      console.log(`         ${e.authors.map((a) => a.name).join('; ')}`);
    }
    console.log('\nImport one with:  node scripts/import-the-conversation.mjs <id>\n');
    if (!opts.target) return;
  }

  const wanted = opts.target.replace(/\/$/, '').split('/').pop();
  const id = (wanted.match(/(\d+)$/) || [])[1];
  const entry = entries.find((e) => e.id === id || e.slug === wanted);
  if (!entry) {
    throw new Error(
      `"${opts.target}" is not in the current "${opts.section}" feed. ` +
        `The feed only carries recent articles — try --section, or --list to see what's there.`,
    );
  }

  if (!/no derivatives/i.test(entry.rights)) {
    throw new Error(
      `Refusing to import: unexpected licence "${entry.rights}". Check the article's terms by hand.`,
    );
  }

  const outPath = join(POSTS_DIR, `${entry.slug}.md`);
  if (!opts.force && (await exists(outPath))) {
    throw new Error(`${relative(ROOT, outPath)} already exists. Pass --force to overwrite.`);
  }

  await mkdir(POSTS_DIR, { recursive: true });
  await writeFile(outPath, buildPost(entry, opts), 'utf8');

  console.log(`\nWrote ${relative(ROOT, outPath)}`);
  console.log(`  title    ${entry.title}`);
  console.log(`  authors  ${entry.authors.map((a) => a.name).join('; ')}`);
  console.log(`  source   ${entry.url}`);
  console.log(`  licence  ${entry.rights}`);
  console.log(`  images   ${opts.withImages ? 'kept — verify every credit is CC-cleared' : 'stripped'}`);
  console.log('\nRead the article before publishing. Do not bulk-import the feed.\n');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exitCode = 1;
});
