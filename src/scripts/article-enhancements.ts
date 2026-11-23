// Article-only progressive enhancements. Every scroll-driven part of this
// module rides the shared animation frame from `lib/scroll`, and the reading
// history is written sparingly: localStorage is synchronous, and writing it for
// every scroll event causes visible jank on long posts.
import { SITE } from '../config/site';
import { initArticleCode } from './article-code';
import { initArticleLightbox } from './article-lightbox';
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
  const body = article?.querySelector('[data-article-body]');
  if (!(progress instanceof HTMLElement) || !(article instanceof HTMLElement) || !(body instanceof HTMLElement)) return;
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
  const outline = [...article.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')]
    .map((link) => ({ link, heading: document.getElementById(link.dataset.tocLink || '') }))
    .filter((item): item is { link: HTMLAnchorElement; heading: HTMLElement } => item.heading !== null);
  let headingPositions: number[] = [];
  let measuredOutline = outline;
  let activeLink: HTMLAnchorElement | null = null;
  let contentStart = 0;
  let scrollable = 0;
  // Cache geometry when layout changes; scroll frames only read scrollY.
  // Completion ends at the prose, before recommendations and comments.
  const measure = () => {
    const bounds = body.getBoundingClientRect();
    contentStart = Math.max(0, bounds.top + window.scrollY - 96);
    scrollable = Math.max(1, bounds.bottom + window.scrollY - window.innerHeight - contentStart);
    measuredOutline = outline.filter(({ heading }) => heading.getClientRects().length > 0);
    headingPositions = measuredOutline.map(({ heading }) => heading.getBoundingClientRect().top + window.scrollY);
    updateProgress();
  };

  const updateOutline = () => {
    let low = 0;
    let high = headingPositions.length;
    const position = window.scrollY + 100;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (headingPositions[middle] <= position) low = middle + 1;
      else high = middle;
    }
    const next = measuredOutline[low - 1]?.link ?? null;
    if (next === activeLink) return;
    activeLink?.classList.remove('is-active');
    activeLink?.removeAttribute('aria-current');
    activeLink = next;
    if (activeLink) {
      activeLink.classList.add('is-active');
      activeLink.setAttribute('aria-current', 'location');
    }
  };

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
    const value = Math.min(1, Math.max(0, (window.scrollY - contentStart) / scrollable));
    progress.style.transform = `scaleX(${value})`;
    scheduleHistory(value);
    updateOutline();
  };
  window.addEventListener('pagehide', flushHistory, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushHistory();
  }, { signal });

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
        window.scrollTo({ top: contentStart + scrollable * previous, behavior: reduceMotion ? 'auto' : 'smooth' });
        dismissResume();
      }, { signal });
      document.body.append(resumeButton);
      resumeTimer = window.setTimeout(dismissResume, 9000);
    }
  } catch {}

  initArticleCode(article, signal);
  const closeLightbox = initArticleLightbox(article, signal);

  measure();
  const stopScroll = onScrollFrame(updateProgress);
  window.addEventListener('resize', measure, { passive: true, signal });
  window.addEventListener('load', measure, { once: true, signal });
  article.addEventListener('load', measure, { capture: true, signal });
  article.addEventListener('toggle', measure, { capture: true, signal });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
  observer?.observe(body);
  observer?.observe(article);
  void document.fonts.ready.then(() => { if (!signal.aborted) measure(); });

  window.__b0ArticleEnhancementsCleanup = () => {
    stopScroll();
    controller.abort();
    dismissResume();
    flushHistory();
    observer?.disconnect();
    closeLightbox?.();
  };
};

document.addEventListener('astro:page-load', initArticleEnhancements);
// Tear down before ANY navigation, not only before the next article: otherwise
// scrolling a non-article page keeps recording progress for the post just left.
document.addEventListener('astro:before-swap', cleanupArticleEnhancements);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initArticleEnhancements, { once: true });
else initArticleEnhancements();
