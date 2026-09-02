// Puts every demo's slider state in the URL hash, so a reader who finds an
// interesting setting can share it. One shared script for all 300 posts —
// see docs/site-improvements.md Task 3 for why this is a single-file change
// rather than editing every demo component.
//
// Trap: demo scripts are module scripts and run their own setup() (which
// reads initial input values and draws once) at parse time, before `load`.
// Restoring earlier than `load` would set values the demo then overwrites
// with its own defaults, so restore runs on `load` and re-fires 'input' to
// make the demo recompute on top of the restored values.

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

async function copyLink(button: HTMLButtonElement) {
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
  button.addEventListener('click', () => copyLink(button));
  figure.appendChild(button);
}

function init() {
  const figures = demoFigures();
  if (figures.length === 0) return;

  restore(figures);
  figures.forEach(addShareButton);

  let timer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || !target.dataset.in) return;
    if (!target.closest('[data-demo]')) return;
    clearTimeout(timer);
    timer = setTimeout(() => record(figures), DEBOUNCE_MS);
  });
}

addEventListener('load', init);
