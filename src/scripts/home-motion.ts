/**
 * Homepage live column.
 *
 * The sidebar player is a mirror, never an independent player: it reads the
 * island's real `data-player-state`, forwards clicks to the island's own button,
 * and lets player.ts drive its progress bar through the shared `[data-live-*]`
 * hook. The card used to repeat the island's lyric line as well; that copy is
 * gone, so the island is the one place a lyric is shown.
 */

let observer: MutationObserver | undefined;
/**
 * The island is `transition:persist`, so its buttons outlive this script's
 * page instance. Every listener must therefore be abortable: `init()` runs both
 * on module evaluation and on `astro:page-load`, and a listener that survives
 * that would fire the proxied click twice — play, then immediately pause.
 */
let controller: AbortController | undefined;

const teardown = () => {
  observer?.disconnect();
  observer = undefined;
  controller?.abort();
  controller = undefined;
};

const init = () => {
  teardown();

  const island = document.getElementById('site-island');
  const card = document.querySelector<HTMLElement>('[data-now-card]');
  if (!island || !card) return;

  controller = new AbortController();
  const { signal } = controller;

  const toggle = card.querySelector<HTMLButtonElement>('[data-now-toggle]');
  const toggleCopy = card.querySelector<HTMLElement>('[data-now-toggle-copy]');

  const sync = () => {
    const playing = (island.dataset.playerState ?? 'idle') === 'playing';
    card.dataset.playing = String(playing);

    if (toggle) {
      toggle.dataset.playing = String(playing);
      toggle.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    }
    if (toggleCopy) toggleCopy.textContent = playing ? '暂停' : '播放';
  };

  sync();

  observer = new MutationObserver(sync);
  observer.observe(island, { attributes: true, attributeFilter: ['data-player-state'] });

  // One proxy, one toggle: the island owns playback, this only forwards the click.
  toggle?.addEventListener('click', () => {
    document.getElementById('island-player-toggle')?.click();
  }, { signal });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
