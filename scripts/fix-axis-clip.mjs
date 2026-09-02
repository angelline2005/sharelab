#!/usr/bin/env node
// Task 5 (docs/site-improvements.md): on narrow screens the last x-axis tick
// label sits centred on `cssW - padR`, and with padR a small fixed constant
// (~10px) roughly half that label falls outside the canvas. Widening padR on
// narrow canvases fixes it. This script applies that one-line change wherever
// the pattern is a plain `padR = <number>` literal, and reports everything it
// could not safely handle so the remainder can be done by hand — the demo
// components were written independently and don't all share this shape.
//
// Usage: node scripts/fix-axis-clip.mjs [--dry-run]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'src', 'components', 'demos');
const dryRun = process.argv.includes('--dry-run');

const PAD_R_LITERAL = /\bpadR\s*=\s*(\d+)\s*([,;])/;
const ALREADY_RESPONSIVE = /padR\s*=\s*cssW\s*<\s*420/;
const CSS_W_DECL = /\bcssW\s*=/;

const files = readdirSync(DIR).filter((f) => f.endsWith('.astro')).sort();

let fixed = 0;
let alreadyOk = 0;
let missCount = 0;
let noPattern = 0;

for (const file of files) {
  const path = join(DIR, file);
  const src = readFileSync(path, 'utf8');

  if (ALREADY_RESPONSIVE.test(src)) {
    alreadyOk++;
    continue;
  }

  if (!src.includes('padR')) {
    noPattern++;
    continue;
  }

  const match = PAD_R_LITERAL.exec(src);
  if (!match) {
    console.log(`MISS ${file}: has "padR" but not a plain numeric literal (padR = <computed expression>)`);
    missCount++;
    continue;
  }

  const cssWIdx = src.search(CSS_W_DECL);
  if (cssWIdx === -1 || cssWIdx > match.index) {
    console.log(`MISS ${file}: padR literal found but no earlier "cssW" declaration to guard on`);
    missCount++;
    continue;
  }

  const [whole, value, sep] = match;
  const replacement = `padR = cssW < 420 ? 26 : ${value}${sep}`;
  const next = src.slice(0, match.index) + replacement + src.slice(match.index + whole.length);

  if (!dryRun) writeFileSync(path, next);
  console.log(`OK ${file}`);
  fixed++;
}

console.log('');
console.log(`Fixed: ${fixed}${dryRun ? ' (dry run, not written)' : ''}`);
console.log(`Already responsive: ${alreadyOk}`);
console.log(`Miss (needs hand-fixing): ${missCount}`);
console.log(`No "padR" pattern at all (different shape, not covered by this script): ${noPattern}`);
