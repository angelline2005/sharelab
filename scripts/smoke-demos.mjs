// Loads every post in a real browser and asserts its demo actually drew
// something.
//
// The structural gates cannot do this. validate-posts.mjs checks imports, ids,
// links and braces; check-mdx.mjs checks the MDX compiles; `astro build`
// succeeds happily on a component that throws at runtime. On 2026-09-02 four of
// the 300 demos turned out to have never rendered anything — one shipped raw
// TypeScript, one called fillText with no coordinates, and two computed their
// drawing off-canvas from a unit error. Three of them still moved their sliders
// and updated their readouts while showing nothing, so nobody noticed for weeks.
// All four are caught by the assertions below.
//
//   npm run smoke                                 every post (build first)
//   npm run smoke -- --limit=20                   a quick subset while iterating
//   npm run smoke -- --slug=<slug>                one post
//   npm run smoke -- --url=http://localhost:4322  reuse a running server
//
// Exits non-zero if any post fails.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';

const POSTS_DIR = 'src/content/posts/vi';
const PORT = 4399;
const CONCURRENCY = 4;

// A canvas that was never sized keeps the intrinsic HTML default. Every demo's
// setup() sets width/height from the element box times devicePixelRatio, so
// these exact values mean draw() never ran at all.
const DEFAULT_W = 300;
const DEFAULT_H = 150;

// Fraction of sampled pixels that must differ from the most common colour. An
// undrawn canvas is uniformly transparent and scores 0; a plot with nothing but
// an axis and one curve clears this comfortably.
const MIN_INK = 0.002;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

function slugList() {
  const all = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.slice(0, -4))
    .sort();
  if (args.slug) return all.filter((s) => s === args.slug);
  return args.limit ? all.slice(0, Number(args.limit)) : all;
}

async function waitForServer(base, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(base, { redirect: 'manual' });
      if (r.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function startPreview() {
  const base = 'http://localhost:' + PORT;
  const child = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    shell: true,
    stdio: 'ignore',
  });
  if (!(await waitForServer(base, 60000))) {
    child.kill();
    throw new Error(
      'astro preview did not come up on ' + PORT + '. Run "npx astro build" first — preview serves dist/.',
    );
  }
  return { base, stop: () => child.kill() };
}

// Runs inside the page. One report per canvas found in a [data-demo].
function inspectDemos(opts) {
  const figures = Array.from(document.querySelectorAll('[data-demo]'));
  return figures.map((fig) => {
    const id = fig.dataset.demo;
    const canvas = fig.querySelector('canvas');
    if (!canvas) {
      // One demo is a table rather than a canvas (VerifyPhysics). It still has
      // to have rendered, so fall back to asserting the figure holds real text.
      const text = (fig.textContent || '').trim();
      if (text.length < 40) {
        return { demo: id, error: 'no canvas and almost no text — nothing rendered' };
      }
      return { demo: id, textOnly: text.length };
    }

    const width = canvas.width;
    const height = canvas.height;
    if (width === opts.defaultW && height === opts.defaultH) {
      return {
        demo: id,
        error: 'canvas still at the ' + opts.defaultW + 'x' + opts.defaultH + ' default — setup() never sized it',
      };
    }

    const ctx = canvas.getContext('2d');
    let data;
    try {
      data = ctx.getImageData(0, 0, width, height).data;
    } catch (e) {
      return { demo: id, error: 'getImageData failed: ' + e.message };
    }

    // Sample on a grid: a large canvas is over a million pixels and the answer
    // does not change.
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
    const counts = new Map();
    let sampled = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const key = data[i] + ',' + data[i + 1] + ',' + data[i + 2] + ',' + data[i + 3];
        counts.set(key, (counts.get(key) || 0) + 1);
        sampled++;
      }
    }
    let modal = 0;
    for (const n of counts.values()) if (n > modal) modal = n;

    return { demo: id, width, height, ink: 1 - modal / sampled, colours: counts.size };
  });
}

async function checkPost(context, base, slug) {
  const page = await context.newPage();
  const problems = [];

  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => problems.push('threw: ' + String(e.message).slice(0, 200)));

  try {
    await page.goto(base + '/vi/posts/' + slug + '/', { waitUntil: 'load', timeout: 30000 });

    // Animated demos are gated behind an IntersectionObserver, and demo-state.ts
    // restores any URL hash on 'load' then re-fires 'input'. Scroll the figure
    // into view and give both a couple of frames before reading pixels.
    await page.evaluate(() => {
      const fig = document.querySelector('[data-demo]');
      if (fig) fig.scrollIntoView({ block: 'center' });
    });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await page.waitForTimeout(150);

    const reports = await page.evaluate(inspectDemos, { defaultW: DEFAULT_W, defaultH: DEFAULT_H });

    if (reports.length === 0) problems.push('no [data-demo] on the page');
    for (const r of reports) {
      if (r.error) {
        problems.push(r.demo + ': ' + r.error);
      } else if (r.textOnly) {
        // Text-based demo: rendering was already asserted in the page.
      } else if (r.ink < MIN_INK) {
        problems.push(
          r.demo + ': canvas is blank — ' + (r.ink * 100).toFixed(3) +
            '% of pixels differ from the background (need ' + (MIN_INK * 100).toFixed(1) +
            '%), ' + r.colours + ' colour(s)',
        );
      }
    }
  } catch (e) {
    problems.push('load failed: ' + String(e.message).split('\n')[0]);
  } finally {
    await page.close();
  }

  return problems;
}

const list = slugList();
if (list.length === 0) {
  console.error('Không có bài nào khớp.');
  process.exit(1);
}

let server = null;
let base = typeof args.url === 'string' ? args.url.replace(/\/$/, '') : null;
if (base) {
  if (!(await waitForServer(base, 5000))) {
    console.error('Không kết nối được ' + base);
    process.exit(1);
  }
} else {
  server = await startPreview();
  base = server.base;
}

console.log('Kiểm ' + list.length + ' bài trên ' + base + ' ...');

const browser = await chromium.launch();
const failures = [];
let done = 0;

const queue = list.slice();
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    const context = await browser.newContext({ viewport: { width: 900, height: 800 } });
    for (let slug = queue.shift(); slug; slug = queue.shift()) {
      const problems = await checkPost(context, base, slug);
      done++;
      if (problems.length) {
        failures.push({ slug, problems });
        console.log('LOI  ' + slug);
        for (const p of problems) console.log('       ' + p);
      } else if (done % 25 === 0) {
        console.log('     ' + done + '/' + list.length);
      }
    }
    await context.close();
  }),
);

await browser.close();
if (server) server.stop();

if (failures.length) {
  console.log('\nHỏng: ' + failures.length + '/' + list.length + ' bài.');
  for (const f of failures) console.log('  ' + f.slug);
  process.exit(1);
}
console.log('\nĐạt: ' + list.length + ' bài, demo nào cũng vẽ ra hình.');
