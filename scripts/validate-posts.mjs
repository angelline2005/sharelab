// Structural gate for the post catalog. Run after every writing batch, before
// `astro build`, so a broken post is caught in a second instead of after a
// two-minute build -- and so the failures come back as a list rather than one
// at a time.
//
//   node scripts/validate-posts.mjs            # check everything
//   node scripts/validate-posts.mjs slug-a slug-b   # check only these posts
//
// Exits 1 if any ERROR was found. Warnings never fail the run; they are the
// things a human should look at, not things the build will choke on.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const POSTS = 'src/content/posts/vi';
const DEMOS = 'src/components/demos';

const errors = [];
const warnings = [];
const err = (slug, msg) => errors.push(`${slug}: ${msg}`);
const warn = (slug, msg) => warnings.push(`${slug}: ${msg}`);

const only = process.argv.slice(2);
const allSlugs = readdirSync(POSTS)
  .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
  .map((f) => f.replace(/\.mdx?$/, ''));
const slugs = only.length ? only : allSlugs;

// data-demo ids must be unique across components: two components sharing an id
// means one demo silently drives the other's canvas on any page holding both.
const demoIds = new Map();
for (const file of readdirSync(DEMOS).filter((f) => f.endsWith('.astro'))) {
  const src = readFileSync(join(DEMOS, file), 'utf8');
  for (const m of src.matchAll(/data-demo="([^"]+)"/g)) {
    const prev = demoIds.get(m[1]);
    if (prev && prev !== file) err(file, `data-demo="${m[1]}" cũng dùng ở ${prev}`);
    demoIds.set(m[1], file);
  }
  if (!/data-demo="/.test(src)) err(file, 'thiếu data-demo');
  if (!/querySelectorAll/.test(src)) warn(file, 'không thấy querySelectorAll — script có chạy không?');
}

const titles = new Map();
// Two posts importing the same component means one writer picked a filename
// another had already taken: the second post renders the first one's demo, and
// nothing else in the build complains. Only a cross-post check catches it.
const componentUsers = new Map();

for (const slug of slugs) {
  const path = existsSync(join(POSTS, `${slug}.mdx`))
    ? join(POSTS, `${slug}.mdx`)
    : join(POSTS, `${slug}.md`);
  if (!existsSync(path)) {
    err(slug, 'không tìm thấy file');
    continue;
  }
  // Git hands some of these files back with CRLF endings on Windows; normalise
  // so every pattern below can assume plain \n.
  const raw = readFileSync(path, 'utf8').split('\r\n').join('\n');

  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) {
    err(slug, 'thiếu frontmatter');
    continue;
  }
  const head = fm[1];
  const body = raw.slice(fm[0].length);
  const field = (name) => head.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim();

  for (const required of ['title', 'description', 'pubDate', 'tags', 'translationId']) {
    if (!field(required)) err(slug, `thiếu frontmatter: ${required}`);
  }

  const title = field('title');
  if (title) {
    const prev = titles.get(title);
    if (prev) err(slug, `tiêu đề trùng với ${prev}`);
    titles.set(title, slug);
  }

  // The handful of republished non-physics notes play by different rules: no
  // demo, no boundary section, a translationId shared with a foreign original.
  // Everything past this point is a rule for the demo catalog only.
  if (!(field('tags') ?? '').includes('"vat-ly"')) continue;

  const desc = field('description')?.replace(/^"|"$/g, '') ?? '';
  if (desc.length < 80) warn(slug, `description ngắn (${desc.length} ký tự)`);
  if (desc.length > 400) warn(slug, `description dài (${desc.length} ký tự)`);

  const tid = field('translationId')?.replace(/^"|"$/g, '');
  if (tid && tid !== slug) err(slug, `translationId "${tid}" khác slug`);

  const tags = field('tags') ?? '';
  if (!/^\[\s*"vat-ly"/.test(tags)) err(slug, 'tags phải bắt đầu bằng "vat-ly"');
  if (!/"javascript"\s*\]$/.test(tags)) warn(slug, 'tags thường kết thúc bằng "javascript"');

  if (field('pubDate') && !/^\d{4}-\d{2}-\d{2}$/.test(field('pubDate'))) {
    err(slug, `pubDate không đúng dạng YYYY-MM-DD: ${field('pubDate')}`);
  }

  // The demo component: imported, existing on disk, and actually rendered.
  const imports = [...body.matchAll(/^import\s+(\w+)\s+from\s+'([^']+)';?$/gm)];
  if (!imports.length) err(slug, 'không import demo component nào');
  for (const [, name, rel] of imports) {
    const target = join(DEMOS, basename(rel));
    if (!rel.includes('components/demos/')) continue;
    if (!existsSync(target)) err(slug, `import trỏ tới file không tồn tại: ${rel}`);
    if (!new RegExp(`<${name}\\s*/>`).test(body)) err(slug, `import ${name} nhưng không render <${name} />`);
    const file = basename(rel);
    componentUsers.set(file, [...(componentUsers.get(file) ?? []), slug]);
  }

  if (!/^##\s+Trường hợp biên/mu.test(body)) err(slug, 'thiếu mục "## Trường hợp biên"');

  const words = body.split(/\s+/).length;
  if (words < 420) warn(slug, `hơi ngắn (${words} từ)`);
  if (words > 1400) warn(slug, `hơi dài (${words} từ)`);

  // Internal links must resolve, and a post with none is a dead end for readers.
  const links = [...body.matchAll(/\]\(\/vi\/posts\/([a-z0-9-]+)/g)].map((m) => m[1]);
  for (const target of links) {
    if (!allSlugs.includes(target)) err(slug, `link gãy: /vi/posts/${target}`);
    if (target === slug) warn(slug, 'tự link về chính mình');
  }
  if (!links.length) err(slug, 'không có link nội bộ nào (bài sẽ thành ngõ cụt)');

  // MDX parses a bare {...} in prose as a JSX expression. This has broken the
  // build before (e^{µθ}), so flag braces outside code fences and inline code.
  const prose = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .split('\n')
    .filter((l) => !/^import\s/.test(l) && !/^</.test(l.trim()));
  for (const line of prose) {
    if (/\{[^}]*\}/.test(line)) err(slug, `dấu ngoặc nhọn trong văn xuôi (MDX sẽ parse là JSX): ${line.trim().slice(0, 60)}`);
  }
}

for (const [file, users] of componentUsers) {
  if (users.length > 1) err(file, `bị ${users.length} bài dùng chung: ${users.join(', ')}`);
}

const label = only.length ? `${slugs.length} bài được chỉ định` : `${slugs.length} bài`;
console.log(`Kiểm tra ${label}, ${demoIds.size} demo id.`);
if (warnings.length) {
  console.log(`\nCẢNH BÁO (${warnings.length}):`);
  for (const w of warnings) console.log('  ! ' + w);
}
if (errors.length) {
  console.log(`\nLỖI (${errors.length}):`);
  for (const e of errors) console.log('  ✗ ' + e);
  process.exit(1);
}
console.log('\nĐạt: không có lỗi cấu trúc.');
