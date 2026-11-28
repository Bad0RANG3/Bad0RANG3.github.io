import './theme';
import './site';
import './service-worker';
import { isConstrainedConnection } from '../lib/network';

const afterPageLoad = (task: () => void) => {
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(task, { timeout: 1800 });
    else window.setTimeout(task, 400);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
};

// Decorative animation stays a deferred import so it never blocks first paint.
// Reading pages keep the BGA too; its SVG keyframes are replayed on a fixed
// canvas, once per native animation frame (no FPS ceiling), and the loop stays
// alive while the reader scrolls. Re-check after ClientRouter navigation
// because this module itself is cached.
const syncAtmosphere = () => {
  if (document.documentElement.dataset.ambientMotion === 'true' && !isConstrainedConnection()) {
    void import('./atmosphere').then(({ startAtmosphere }) => startAtmosphere()).catch(() => {});
  }
};

// The music island is chrome, not reading content. Its controller is
// fetched once the page is idle, or immediately if the visitor reaches for the
// player first, so it never competes with the article's CSS, fonts, or the
// router on first paint.
let playerTask: Promise<unknown> | null = null;
const loadPlayer = () => {
  playerTask ??= import('./player').catch(() => { playerTask = null; });
  return playerTask;
};
const schedulePlayer = () => {
  const island = document.getElementById('site-island');
  if (!(island instanceof HTMLElement) || island.dataset.playerScheduled === '1') return;
  island.dataset.playerScheduled = '1';
  const warm = () => {
    loadPlayer();
  };
  island.addEventListener('pointerenter', warm, { passive: true });
  island.addEventListener('pointerdown', warm, { passive: true });
  island.addEventListener('focusin', warm);
  // On slow connections the first click can beat the module download. Replay
  // that intent once its controller is ready, so the pill opens on one click.
  island.addEventListener('click', (event) => {
    if (island.dataset.bound === '1' || !(event.target instanceof Element)
      || !event.target.closest('#site-island-toggle')) return;
    void loadPlayer().then(() => {
      if (island.dataset.bound === '1') document.getElementById('site-island-toggle')?.click();
    });
  });
  afterPageLoad(() => {
    if (!isConstrainedConnection()) loadPlayer();
  });
};

// Search is fetched on first use (button or Ctrl/⌘+K) rather than inlined into
// every page. Both listeners are delegated because the header is replaced on
// each navigation while this module runs once per visit.
const openSearch = () => {
  void import('./search').then(({ openSearch: open }) => open());
};
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('#search-btn, [data-open-search]')) openSearch();
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 'k') {
    event.preventDefault();
    openSearch();
  }
});

document.addEventListener('astro:page-load', () => {
  afterPageLoad(syncAtmosphere);
  schedulePlayer();
});
afterPageLoad(syncAtmosphere);
schedulePlayer();
