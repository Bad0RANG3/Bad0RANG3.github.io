// @ts-nocheck
// Homepage motion. Everything here is progressive: the server renders the final
// content, and this script only adds movement when the visitor allows it.
//
// Two rules keep it safe:
//   * `prefers-reduced-motion: reduce` exits before touching the DOM, so those
//     visitors get the plain page rather than a frozen half-animated one.
//   * Elements are only hidden once this script proves they are below the fold,
//     so there is no flash of invisible content and no "reveal" that never fires.
export {};

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const PLAYER_LABELS = {
  idle: '准备播放',
  loading: '正在载入',
  playing: '正在播放',
  paused: '已暂停',
  ready: '播放结束',
  unavailable: '音频不可用',
} as const;

let revealObserver: IntersectionObserver | null = null;
let countObserver: IntersectionObserver | null = null;
let playerObserver: MutationObserver | null = null;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const countUp = (node: HTMLElement) => {
  const target = Number(node.dataset.count);
  if (!Number.isFinite(target) || target <= 0 || node.dataset.counted === '1') return;
  node.dataset.counted = '1';
  const duration = 900;
  const startedAt = performance.now();
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    node.textContent = String(Math.round(target * easeOutCubic(progress)));
    if (progress < 1) requestAnimationFrame(tick);
    else node.textContent = String(target);
  };
  node.textContent = '0';
  requestAnimationFrame(tick);
};

const initReveal = () => {
  const items = [...document.querySelectorAll('[data-motion]')];
  items.forEach((item) => {
    // Already on screen (or no IntersectionObserver): leave it visible.
    if (!(item instanceof HTMLElement)) return;
    if (!('IntersectionObserver' in window)) return;
    const rect = item.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.92) item.classList.add('is-pending');
  });

  if (!('IntersectionObserver' in window)) return;
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('is-pending');
      revealObserver?.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  document.querySelectorAll('[data-motion].is-pending').forEach((item) => revealObserver?.observe(item));
};

const initCounters = () => {
  const nodes = [...document.querySelectorAll('[data-count]')];
  if (!nodes.length || !('IntersectionObserver' in window)) return;

  countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countUp(entry.target as HTMLElement);
      countObserver?.unobserve(entry.target);
    });
  }, { threshold: 0.6 });

  nodes.forEach((node) => countObserver?.observe(node));
};

/* The hero card mirrors the real player instead of always claiming "playing".
   The island is persisted across ClientRouter navigations, so it is observed
   once per page load and the observer is dropped on the next swap. */
const initPlayerCard = () => {
  const card = document.querySelector('[data-now-card]');
  const island = document.getElementById('site-island');
  if (!card || !island) return;

  const stateLabel = card.querySelector('[data-now-state]');
  const toggle = card.querySelector('[data-now-toggle]');
  const toggleCopy = card.querySelector('[data-now-toggle-copy]');

  const sync = () => {
    const state = (island.dataset.playerState || 'idle') as keyof typeof PLAYER_LABELS;
    const playing = state === 'playing';
    card.setAttribute('data-playing', String(playing));
    if (stateLabel) stateLabel.textContent = PLAYER_LABELS[state] ?? PLAYER_LABELS.idle;
    if (toggleCopy) toggleCopy.textContent = playing ? '暂停' : '听一下';
    if (toggle instanceof HTMLElement) {
      toggle.dataset.playing = String(playing);
      toggle.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    }
  };

  sync();
  playerObserver?.disconnect();
  playerObserver = new MutationObserver(sync);
  playerObserver.observe(island, { attributes: true, attributeFilter: ['data-player-state'] });

  toggle?.addEventListener('click', () => {
    const islandToggle = document.getElementById('island-player-toggle');
    if (islandToggle instanceof HTMLElement) islandToggle.click();
  });
};

const teardown = () => {
  revealObserver?.disconnect();
  countObserver?.disconnect();
  playerObserver?.disconnect();
  revealObserver = null;
  countObserver = null;
  playerObserver = null;
};

const initHomeMotion = () => {
  teardown();
  if (reduceMotionQuery.matches) return;
  initReveal();
  initCounters();
  initPlayerCard();
};

document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:page-load', initHomeMotion);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeMotion, { once: true });
} else {
  initHomeMotion();
}
