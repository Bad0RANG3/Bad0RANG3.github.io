// Article-only progressive enhancements. Every scroll-driven part of this
// module rides the shared animation frame from `lib/scroll`, and the reading
// history is written sparingly: localStorage is synchronous, and writing it for
// every scroll event causes visible jank on long posts.
import { SITE } from '../config/site';
import { copyText } from '../lib/clipboard';
import { onScrollFrame } from '../lib/scroll';
import { readJsonArray } from '../lib/storage';

declare global {
  interface Window {
    __b0ArticleEnhancementsCleanup?: () => void;
  }
}

type PendingHistory = { progress: number; completed: boolean };
type HistoryEntry = { slug: string; at: number; progress: number; completed: boolean };

const cleanupArticleEnhancements = () => {
  const cleanup = window.__b0ArticleEnhancementsCleanup;
  window.__b0ArticleEnhancementsCleanup = undefined;
  cleanup?.();
};

const initArticleEnhancements = () => {
  const progress = document.querySelector('[data-reading-progress]');
  const article = document.querySelector('article[data-article]');
  if (!(progress instanceof HTMLElement) || !(article instanceof HTMLElement)) return;
  // The guard has to run BEFORE the teardown, not after it. `astro:page-load`
  // fires for the initial document as well as for every navigation, so on a
  // cold load this function is entered twice for the same article. Tearing
  // down first and bailing second left the article marked as enhanced with no
  // scroll listener at all: the progress bar stayed at scaleX(0) and the whole
  // first visit to a post was never written to the reading history. A second
  // call for an element that is already wired is a no-op; an element that has
  // just been swapped in still tears down whatever the previous one left.
  if (article.dataset.enhanced === '1') return;
  cleanupArticleEnhancements();
  article.dataset.enhanced = '1';

  // One controller owns every listener this module adds to the article, so
  // teardown is a single call and a listener can never outlive its element.
  const controller = new AbortController();
  const { signal } = controller;
  const historyKey = SITE.READING_HISTORY_STORAGE_KEY;
  const slug = article.dataset.slug || '';
  let historyTimer = 0;
  let pendingHistory: PendingHistory | null = null;
  let lastStoredProgress = -1;
  // Measured, never read on a scroll frame. `scrollHeight` is a layout read,
  // and asking for it inside the scroll frame is what forces the engine to
  // resolve layout on every frame of the gesture. The document only changes
  // height when something changes it, so it is measured at the moments that can
  // have happened: first run, resize, and after the images have loaded.
  let scrollable = 0;
  const measure = () => { scrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight); };

  const flushHistory = () => {
    window.clearTimeout(historyTimer);
    historyTimer = 0;
    if (!slug || !pendingHistory) return;
    const { progress: progressValue, completed } = pendingHistory;
    pendingHistory = null;
    if (!completed && Math.abs(progressValue - lastStoredProgress) < 0.03) return;
    try {
      const history = readJsonArray<HistoryEntry>(historyKey).filter((item) => item?.slug !== slug);
      history.unshift({ slug, at: Date.now(), progress: progressValue, completed });
      localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 20)));
      lastStoredProgress = progressValue;
    } catch {}
  };

  const scheduleHistory = (progressValue: number) => {
    if (progressValue <= 0.02) return;
    const completed = progressValue >= 0.98;
    if (completed && lastStoredProgress >= 0.98) return;
    pendingHistory = { progress: progressValue, completed };
    if (completed) flushHistory();
    else if (!historyTimer) historyTimer = window.setTimeout(flushHistory, 4000);
  };

  const updateProgress = () => {
    const value = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    progress.style.transform = `scaleX(${value})`;
    scheduleHistory(value);
  };
  measure();
  const stopScroll = onScrollFrame(updateProgress);
  window.addEventListener('resize', measure, { passive: true, signal });
  window.addEventListener('load', measure, { once: true, signal });
  window.addEventListener('pagehide', flushHistory, { signal });

  // Offer to jump back when the reader left this post part-way through. Read
  // before any new history is written, and never when a #fragment already
  // decided where the page should be.
  let resumeButton: HTMLButtonElement | null = null;
  let resumeTimer = 0;
  const dismissResume = () => {
    window.clearTimeout(resumeTimer);
    resumeButton?.remove();
    resumeButton = null;
  };
  try {
    const entry = readJsonArray<HistoryEntry>(historyKey).find((item) => item?.slug === slug);
    const previous = Number(entry?.progress);
    if (slug && !window.location.hash && window.scrollY < 80 && !entry?.completed && previous > 0.08 && previous < 0.95) {
      lastStoredProgress = previous;
      resumeButton = document.createElement('button');
      resumeButton.type = 'button';
      resumeButton.className = 'btn-brutal fixed bottom-6 left-1/2 z-50 -translate-x-1/2 shadow-lg';
      resumeButton.textContent = `继续上次阅读（${Math.round(previous * 100)}%）`;
      resumeButton.addEventListener('click', () => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: Math.max(0, scrollable * previous), behavior: reduceMotion ? 'auto' : 'smooth' });
        dismissResume();
      }, { signal });
      document.body.append(resumeButton);
      resumeTimer = window.setTimeout(dismissResume, 9000);
    }
  } catch {}

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
          bar.scrollTo({ left: Math.max(0, left - 12), behavior: 'smooth' });
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
    button.textContent = (await copyText(source?.textContent ?? '')) ? '已复制' : '复制失败';
    window.setTimeout(() => { button.textContent = '复制'; }, 1600);
  }, { signal });

  article.querySelectorAll('img').forEach((img) => {
    if (img.closest('a') || img.dataset.zoomBound === '1') return;
    img.dataset.zoomBound = '1';
    img.tabIndex = 0;
    // The trigger is an <img>, so role="button" discards its implicit image
    // role and with it the alt text as a name source. Name the trigger
    // explicitly. A decorative image (alt="") still needs a name here: once it
    // is a focusable button, an empty name is a WCAG 4.1.2 failure, so it falls
    // back to the same generic label the lightbox dialog already uses.
    img.setAttribute('role', 'button');
    if (!img.hasAttribute('aria-label')) {
      const label = img.alt.trim();
      img.setAttribute('aria-label', label ? `查看大图：${label}` : '查看大图');
    }
    const open = () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'image-lightbox';
      dialog.setAttribute('aria-label', img.alt ? `查看大图：${img.alt}` : '查看大图');
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'image-lightbox-close';
      close.setAttribute('aria-label', '关闭');
      close.textContent = '×';
      const enlarged = document.createElement('img');
      enlarged.src = img.currentSrc || img.src;
      enlarged.alt = img.alt || '';
      dialog.append(close, enlarged);
      dialog.addEventListener('click', (event) => { if (event.target === dialog || event.target === close) dialog.close(); });
      dialog.addEventListener('close', () => dialog.remove());
      document.body.append(dialog);
      dialog.showModal();
    };
    img.addEventListener('click', open, { signal });
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    }, { signal });
  });

  const links = [...article.querySelectorAll<HTMLElement>('[data-toc-link]')];
  const headings = links
    .map((link) => document.getElementById(link.getAttribute('data-toc-link') || ''))
    .filter((heading): heading is HTMLElement => Boolean(heading));
  let observer: IntersectionObserver | undefined;
  if (links.length && headings.length && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle('is-active', link.getAttribute('data-toc-link') === visible.target.id));
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0, 1] });
    headings.forEach((heading) => observer?.observe(heading));
  }

  window.__b0ArticleEnhancementsCleanup = () => {
    stopScroll();
    controller.abort();
    dismissResume();
    flushHistory();
    observer?.disconnect();
  };
};

document.addEventListener('astro:page-load', initArticleEnhancements);
// Tear down before ANY navigation, not only before the next article: otherwise
// scrolling a non-article page keeps recording progress for the post just left.
document.addEventListener('astro:before-swap', cleanupArticleEnhancements);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initArticleEnhancements, { once: true });
else initArticleEnhancements();
