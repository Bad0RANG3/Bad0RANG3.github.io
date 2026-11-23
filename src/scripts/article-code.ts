import { copyText } from '../lib/clipboard';

export const initArticleCode = (article: HTMLElement, signal: AbortSignal) => {
  // Code blocks: every block gets the same top bar — language on the left, copy
  // chip on the right — so a plain fence and a tabbed group share one frame
  // height and one place for the chip. A tabbed group already has its bar, so
  // there the chip simply joins it instead of getting a second strip.
  article.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-block')) return;
    if (pre.closest('[data-code-tabs]')?.querySelector('[data-copy-code]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.copyCode = '1';
    button.className = 'code-copy';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制代码');

    const group = pre.closest<HTMLElement>('[data-code-tabs]');
    if (group) {
      const tabsBar = group.querySelector<HTMLElement>('.code-tabs-bar');
      if (!tabsBar) return;
      tabsBar.append(button);
      return;
    }

    const block = document.createElement('div');
    block.className = 'code-block';
    block.dataset.codeBlock = '1';
    pre.replaceWith(block);

    const bar = document.createElement('div');
    bar.className = 'code-block-bar';
    // An unlabelled fence renders as `text`; printing that would put a noise
    // word on every ASCII diagram, so those bars keep only the copy chip.
    const language = (pre.dataset.language ?? '').trim();
    if (language && language !== 'text') {
      const label = document.createElement('span');
      label.className = 'code-lang';
      label.textContent = language;
      bar.append(label);
    }
    bar.append(button);
    block.append(bar, pre);
  });

  // Tabbed code groups. The markup is server-rendered, so the bar and panels
  // are already in place before this runs; without this script every panel
  // stays visible and stacked, which is degraded but readable. Wiring only
  // hides the panels that are not selected, so nothing is ever unreachable
  // because a bundle failed.
  article.querySelectorAll<HTMLElement>('[data-code-tabs]').forEach((group) => {
    const tabs = [...group.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panels = [...group.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    if (tabs.length < 2 || tabs.length !== panels.length) return;
    const bar = group.querySelector<HTMLElement>('.code-tabs-tabs') ?? group.querySelector<HTMLElement>('.code-tabs-bar');

    const activate = (index: number, focus = false) => {
      const next = Math.min(Math.max(index, 0), tabs.length - 1);
      tabs.forEach((tab, position) => {
        const selected = position === next;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        panels[position].hidden = !selected;
      });
      group.dataset.active = String(next);
      if (focus) tabs[next].focus();
      // Keep the selected pill inside the bar's viewport on a phone.
      if (bar) {
        const left = tabs[next].offsetLeft;
        const right = left + tabs[next].offsetWidth;
        if (left < bar.scrollLeft || right > bar.scrollLeft + bar.clientWidth) {
          bar.scrollTo({ left: Math.max(0, left - 12), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
      }
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(index), { signal });
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const step = event.key === 'ArrowRight' ? 1 : -1;
          activate((index + step + tabs.length) % tabs.length, true);
          return;
        }
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          activate(event.key === 'Home' ? 0 : tabs.length - 1, true);
        }
      }, { signal });
    });

    group.dataset.ready = '1';
    activate(Number(group.dataset.active ?? 0) || 0);
  });

  // One delegated listener rather than one closure per block: the maimai
  // reference post carries 40 code blocks, and every one of them used to keep
  // its own listener alive for the whole visit.
  article.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-copy-code]') : null;
    if (!(button instanceof HTMLButtonElement)) return;
    // The chip sits in the bar, which is a sibling of the panel, so the code is
    // read from the nearest frame. Inside a tabbed group only the visible panel
    // counts — copying a hidden tab would ship the wrong commands silently.
    const frame = button.closest('[data-code-tabs], [data-code-block]');
    const source = frame
      ? [...frame.querySelectorAll('pre')].find((pre) => !pre.closest('[hidden]'))
      : button.parentElement?.querySelector('pre');
    // `copyText` owns the fallback, so an insecure context or a denied
    // permission still lands in "已复制" instead of telling the reader it failed.
    const copied = await copyText(source?.textContent ?? '');
    if (signal.aborted) return;
    button.textContent = copied ? '已复制' : '复制失败';
    window.setTimeout(() => { if (!signal.aborted) button.textContent = '复制'; }, 1600);
  }, { signal });
};
