import './theme';
import './site';
import './service-worker';

// Decorative animation stays a deferred import so it never blocks first paint.
// Reading pages keep the BGA too; the throttled loop runs continuously over the
// fixed overlay, so it stays alive while the reader scrolls.
// Re-check after ClientRouter navigation because this module itself is cached.
const syncAtmosphere = () => {
  if (document.documentElement.dataset.ambientMotion === 'true') {
    void import('./atmosphere').then(({ startAtmosphere }) => startAtmosphere());
  }
};

// The music island is chrome, not reading content. Its controller (~4 KB) is
// fetched once the page is idle, or immediately if the visitor reaches for the
// player first, so it never competes with the article's CSS, fonts, or the
// router on first paint.
let playerLoaded = false;
const loadPlayer = () => {
  if (playerLoaded) return;
  playerLoaded = true;
  void import('./player');
};
const schedulePlayer = () => {
  const island = document.getElementById('site-island');
  if (!(island instanceof HTMLElement) || island.dataset.playerScheduled === '1') return;
  island.dataset.playerScheduled = '1';
  const warm = () => {
    island.removeEventListener('pointerenter', warm);
    island.removeEventListener('pointerdown', warm);
    island.removeEventListener('focusin', warm);
    loadPlayer();
  };
  island.addEventListener('pointerenter', warm, { passive: true });
  island.addEventListener('pointerdown', warm, { passive: true });
  island.addEventListener('focusin', warm);
  const runWhenIdle = () => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(loadPlayer, { timeout: 1800 });
    else window.setTimeout(loadPlayer, 400);
  };
  if (document.readyState === 'complete') runWhenIdle();
  else window.addEventListener('load', runWhenIdle, { once: true });
};

// Search is fetched on first use (button or Ctrl/⌘+K) rather than inlined into
// every page. Both listeners are delegated because the header is replaced on
// each navigation while this module runs once per visit.
const openSearch = () => {
  void import('./search').then(({ openSearch: open }) => open());
};
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('#search-btn')) openSearch();
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 'k') {
    event.preventDefault();
    openSearch();
  }
});

document.addEventListener('astro:page-load', () => {
  syncAtmosphere();
  schedulePlayer();
});
syncAtmosphere();
schedulePlayer();
