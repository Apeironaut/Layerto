/**
 * Real loading progress for the static boot screen in each app's index.html.
 *
 * The boot screen (#boot, styled by /boot.css) is plain HTML, so it is visible before any
 * JavaScript downloads. Apps report real milestones here (code loaded, session checked,
 * data fetched…); each one reveals one more layer of the logo. No timers fake progress.
 */

let completed = 0;
let total = 1;
let finished = false;

function el(id: string): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}

// The logo PNG's layer edges, as % hidden from the top: nothing, base, dark red, red, black top.
const LAYER_EDGES = [100, 76.5, 57, 38, 0];

/** Maps progress (0..1) onto the logo's layer edges so each step reveals a whole layer. */
function insetFor(fraction: number): number {
  const pos = fraction * (LAYER_EDGES.length - 1);
  const i = Math.min(LAYER_EDGES.length - 2, Math.floor(pos));
  const t = pos - i;
  return LAYER_EDGES[i] + (LAYER_EDGES[i + 1] - LAYER_EDGES[i]) * t;
}

function render(label?: string) {
  const root = el('boot');
  if (!root) return;
  const fraction = Math.min(1, completed / total);
  root.style.setProperty('--boot-inset', `${insetFor(fraction)}%`);
  root.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  const text = el('boot-label');
  if (text && label) text.textContent = label;
}

/** Declare how many milestones this app will report (call once, as early as possible). */
export function bootStart(steps: number, label?: string) {
  total = Math.max(1, steps);
  completed = 0;
  render(label);
}

/** Mark one milestone as done. `nextLabel` describes what is loading now. */
export function bootStep(nextLabel?: string) {
  if (finished) return;
  completed = Math.min(total, completed + 1);
  render(nextLabel);
}

/** All milestones done: fill the logo, then fade the boot screen out and remove it. */
export function bootDone() {
  if (finished) return;
  finished = true;
  completed = total;
  render('Ready');
  const root = el('boot');
  if (!root) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('boot--done');
  const remove = () => root.remove();
  if (reduced) {
    remove();
  } else {
    root.addEventListener('transitionend', (e) => {
      if (e.target === root && e.propertyName === 'opacity') remove();
    });
    // Safety net in case transitionend never fires (e.g. tab in background).
    window.setTimeout(remove, 1200);
  }
}

/** Resolves when `promise` settles or after `ms`, whichever comes first. Never rejects. */
export function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise.then((v) => v, () => undefined),
    new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), ms)),
  ]);
}

/** Resolves when the window `load` event has fired (all initial images/styles loaded). */
export function windowLoaded(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
}

/** Resolves when an image URL is downloaded and decoded (or failed). */
export function imageReady(src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  return img.decode().catch(() => undefined);
}
