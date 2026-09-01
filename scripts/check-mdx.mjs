// Compile-check posts without running a full `astro build`.
//
// The build is the real gate, but it compiles the whole site, which is useless
// while other work is still writing files into src/. This parses just the posts
// you name (or all of them) through the same MDX compiler Astro uses, so the
// class of error that actually breaks this build -- a brace in prose read as
// JSX, an unclosed fence, a bad expression -- surfaces in a second.
//
//   node scripts/check-mdx.mjs slug-a slug-b
//   node scripts/check-mdx.mjs            # all posts

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '@mdx-js/mdx';

const POSTS = 'src/content/posts/vi';

const only = process.argv.slice(2);
const slugs = only.length
  ? only
  : readdirSync(POSTS).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));

const failures = [];

for (const slug of slugs) {
  const path = join(POSTS, `${slug}.mdx`);
  if (!existsSync(path)) {
    failures.push(`${slug}: không tìm thấy file`);
    continue;
  }
  // Strip the YAML frontmatter: Astro's content loader handles it, the MDX
  // compiler on its own would read the --- as a thematic break and choke on
  // the unquoted colons below it.
  const body = readFileSync(path, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  try {
    await compile(body, { jsx: true });
  } catch (e) {
    const line = e.line ? ` (dòng ${e.line})` : '';
    failures.push(`${slug}${line}: ${e.reason ?? e.message}`);
  }
}

console.log(`Biên dịch thử ${slugs.length} bài MDX.`);
if (failures.length) {
  console.log(`\nLỖI (${failures.length}):`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('Đạt: mọi bài đều parse được.');
