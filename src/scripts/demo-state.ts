// Puts every demo's slider state in the URL hash, so a reader who finds an
// interesting setting can share it. One shared script for all 300 posts —
// see docs/site-improvements.md Task 3 for why this is a single-file change
// rather than editing every demo component.
//
// Also carries the site's only client-side analytics instrumentation (see
// docs/trust-and-instrumentation.md Task 3): demo_first_interact, demo_share
// and internal_link_click. It was already the one script loaded on every
// post, so a second shared script for four dataLayer.push() calls would have
// been a second thing to remember to include.
//
// Trap: demo scripts are module scripts and run their own setup() (which
// reads initial input values and draws once) at parse time, before `load`.
// Restoring earlier than `load` would set values the demo then overwrites
// with its own defaults, so restore runs on `load` and re-fires 'input' to
// make the demo recompute on top of the restored values.

// declare global requires this file to already be a module (have some
// top-level import/export) — it otherwise has neither, since everything
// here runs for its side effects.
export {};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function pushEvent(event: string, params: Record<string, unknown> = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

const DEBOUNCE_MS = 250;

function demoFigures(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-demo]'));
}

// Posts have exactly one demo; the id prefix only matters on the rare page
// that might have several, so a shared key like "v" doesn't collide.
function keyFor(figure: HTMLElement, input: HTMLInputElement, figures: HTMLElement[]): string {
  const k = input.dataset.in!;
  return figures.length > 1 ? `${figure.dataset.demo}.${k}` : k;
}

function restore(figures: HTMLElement[]) {
  const params = new URLSearchParams(location.hash.slice(1));
  if ([...params.keys()].length === 0) return;

  for (const figure of figures) {
    for (const input of figure.querySelectorAll<HTMLInputElement>('[data-in]')) {
      const key = keyFor(figure, input, figures);
      if (!params.has(key)) continue;
      input.value = params.get(key)!;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

function record(figures: HTMLElement[]) {
  const params = new URLSearchParams();
  for (const figure of figures) {
    for (const input of figure.querySelectorAll<HTMLInputElement>('[data-in]')) {
      params.set(keyFor(figure, input, figures), input.value);
    }
  }
  const hash = params.toString();
  history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}

async function copyLink(figure: HTMLElement, button: HTMLButtonElement) {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  pushEvent('demo_share', { demo_id: figure.dataset.demo });
  const original = button.textContent;
  button.textContent = 'Đã chép';
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1500);
}

function addShareButton(figure: HTMLElement) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'demo-share';
  button.textContent = 'Sao chép liên kết';
  button.addEventListener('click', () => copyLink(figure, button));
  figure.appendChild(button);
}

// Related posts and the pager are the only two internal-link surfaces
// PostLayout adds beyond the article body itself; this is the one thing that
// tells us whether either does anything at all.
function initInternalLinkTracking() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (!link) return;
    const linkType = link.closest('.related') ? 'related' : link.closest('.post-pager') ? 'pager' : null;
    if (!linkType) return;
    pushEvent('internal_link_click', { link_type: linkType });
  });
}

function init() {
  // Runs on every post regardless of whether it has a demo — the pager and
  // related-posts links are article chrome, not part of the demo itself.
  initInternalLinkTracking();

  const figures = demoFigures();
  if (figures.length === 0) return;

  restore(figures);
  figures.forEach(addShareButton);

  // Once per demo per pageview: the slider fires 'input' continuously while
  // dragging, so this is tracked separately from the debounced hash record.
  const interacted = new Set<string>();

  let timer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || !target.dataset.in) return;
    const figure = target.closest<HTMLElement>('[data-demo]');
    if (!figure) return;

    const demoId = figure.dataset.demo!;
    if (!interacted.has(demoId)) {
      interacted.add(demoId);
      pushEvent('demo_first_interact', { demo_id: demoId, control: target.dataset.in });
    }

    clearTimeout(timer);
    timer = setTimeout(() => record(figures), DEBOUNCE_MS);
  });
}

addEventListener('load', init);
