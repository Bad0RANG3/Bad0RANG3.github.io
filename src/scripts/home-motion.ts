/**
 * Homepage live column.
 *
 * The sidebar player is a mirror, never an independent player: it reads the
 * island's real `data-player-state`, forwards clicks to the island's own button,
 * and shows the lyric line the island is currently on. Progress and timings come
 * from the `[data-live-*]` hooks that player.ts already updates globally.
 */

const PLAYER_LABELS = {
  idle: '准备播放',
  loading: '正在载入',
  playing: '正在播放',
  paused: '已暂停',
  ready: '播放结束',
  unavailable: '音频不可用',
} as const;

let observer: MutationObserver | undefined;
let lyricListener: ((event: Event) => void) | undefined;

const teardown = () => {
  observer?.disconnect();
  observer = undefined;
  if (lyricListener) {
    document.removeEventListener('b0-player-lyric', lyricListener);
    lyricListener = undefined;
  }
};

const init = () => {
  teardown();

  const island = document.getElementById('site-island');
  const card = document.querySelector<HTMLElement>('[data-now-card]');
  if (!island || !card) return;

  const stateLabel = card.querySelector<HTMLElement>('[data-now-state-label]');
  const toggle = card.querySelector<HTMLButtonElement>('[data-now-toggle]');
  const toggleCopy = card.querySelector<HTMLElement>('[data-now-toggle-copy]');
  const lyric = card.querySelector<HTMLElement>('[data-now-lyric]');
  const placeholder = lyric?.textContent?.trim() ?? '';

  const sync = () => {
    const state = (island.dataset.playerState ?? 'idle') as keyof typeof PLAYER_LABELS;
    const playing = state === 'playing';

    card.dataset.playing = String(playing);
    if (stateLabel) stateLabel.textContent = PLAYER_LABELS[state] ?? PLAYER_LABELS.idle;

    if (toggle) {
      toggle.dataset.playing = String(playing);
      toggle.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    }
    if (toggleCopy) toggleCopy.textContent = playing ? '暂停' : '播放';

    // A finished or unavailable track should not leave a stale lyric on screen.
    if (lyric && (state === 'ready' || state === 'unavailable')) lyric.textContent = placeholder;
  };

  sync();

  observer = new MutationObserver(sync);
  observer.observe(island, { attributes: true, attributeFilter: ['data-player-state'] });

  lyricListener = (event) => {
    const text = (event as CustomEvent<{ text?: string }>).detail?.text;
    if (lyric && typeof text === 'string' && text.trim()) lyric.textContent = text.trim();
  };
  document.addEventListener('b0-player-lyric', lyricListener);

  toggle?.addEventListener('click', () => {
    document.getElementById('island-player-toggle')?.click();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
