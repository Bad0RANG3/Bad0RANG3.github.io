/**
 * Homepage motion.
 *
 * The only live element is the now-playing pill: it stays collapsed until the
 * island reports real audio, then expands and mirrors that state. Everything
 * else on the page (card cascade, hover lift) is plain CSS.
 */

const PLAYER_LABELS = {
  idle: '准备播放',
  loading: '正在载入',
  playing: '正在播放',
  paused: '已暂停',
  ready: '播放结束',
  unavailable: '音频不可用',
} as const;

/** States worth showing: there is audio in the pipe. */
const ACTIVE_STATES = new Set(['playing', 'paused', 'loading']);

let observer: MutationObserver | undefined;

const teardown = () => {
  observer?.disconnect();
  observer = undefined;
};

const init = () => {
  teardown();

  const island = document.getElementById('site-island');
  const pill = document.querySelector<HTMLElement>('[data-now-pill]');
  if (!island || !pill) return;

  const stateLabel = pill.querySelector<HTMLElement>('[data-now-state-label]');
  const toggle = pill.querySelector<HTMLButtonElement>('[data-now-toggle]');

  const sync = () => {
    const state = (island.dataset.playerState ?? 'idle') as keyof typeof PLAYER_LABELS;
    const visible = ACTIVE_STATES.has(state);
    const playing = state === 'playing';

    pill.dataset.visible = String(visible);
    pill.dataset.playing = String(playing);
    pill.toggleAttribute('inert', !visible);
    pill.setAttribute('aria-hidden', String(!visible));

    if (stateLabel) stateLabel.textContent = PLAYER_LABELS[state] ?? PLAYER_LABELS.idle;
    if (toggle) {
      toggle.textContent = playing ? '暂停' : '播放';
      toggle.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    }
  };

  sync();

  observer = new MutationObserver(sync);
  observer.observe(island, { attributes: true, attributeFilter: ['data-player-state'] });

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
