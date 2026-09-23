// Article-only progressive enhancements. Keep scroll work inside one animation
// frame and persist reading history sparingly: localStorage is synchronous and
// writing it for every scroll event causes visible jank on long posts.
export {};

declare global {
  interface Window {
    __b0ArticleEnhancementsCleanup?: () => void;
  }
}

type PendingHistory = { progress: number; completed: boolean };

const initArticleEnhancements = () => {
  window.__b0ArticleEnhancementsCleanup?.();

  const progress = document.querySelector('[data-reading-progress]');
  const article = document.querySelector('article[data-article]');
  if (!(progress instanceof HTMLElement) || !(article instanceof HTMLElement) || article.dataset.enhanced === '1') return;
  article.dataset.enhanced = '1';

  const historyKey = 'b0-reading-history';
  const slug = article.dataset.slug || '';
  let frame = 0;
  let historyTimer = 0;
  let pendingHistory: PendingHistory | null = null;
  let lastStoredProgress = -1;

  const flushHistory = () => {
    window.clearTimeout(historyTimer);
    historyTimer = 0;
    if (!slug || !pendingHistory) return;
    const { progress: progressValue, completed } = pendingHistory;
    pendingHistory = null;
    if (!completed && Math.abs(progressValue - lastStoredProgress) < 0.03) return;
    try {
      const value = JSON.parse(localStorage.getItem(historyKey) || '[]');
      const history = Array.isArray(value) ? value.filter((item) => item?.slug !== slug) : [];
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
    frame = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progress.style.transform = `scaleX(${value})`;
    scheduleHistory(value);
  };
  const scheduleProgressUpdate = () => {
    if (!frame) frame = window.requestAnimationFrame(updateProgress);
  };

  window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
  window.addEventListener('resize', scheduleProgressUpdate, { passive: true });
  window.addEventListener('pagehide', flushHistory);
  scheduleProgressUpdate();

  article.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('[data-code-block]')) return;
    const block = document.createElement('div');
    block.className = 'code-block';
    block.dataset.codeBlock = '1';
    pre.replaceWith(block);
    block.append(pre);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.copyCode = '1';
    button.className = 'code-copy';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制代码');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent ?? '');
        button.textContent = '已复制';
      } catch {
        button.textContent = '复制失败';
      }
      window.setTimeout(() => { button.textContent = '复制'; }, 1600);
    });
    block.append(button);
  });

  article.querySelectorAll('img').forEach((img) => {
    if (img.closest('a') || img.dataset.zoomBound === '1') return;
    img.dataset.zoomBound = '1';
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    const open = () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'image-lightbox';
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
    img.addEventListener('click', open);
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
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
    window.removeEventListener('scroll', scheduleProgressUpdate);
    window.removeEventListener('resize', scheduleProgressUpdate);
    window.removeEventListener('pagehide', flushHistory);
    if (frame) window.cancelAnimationFrame(frame);
    flushHistory();
    observer?.disconnect();
  };
};

document.addEventListener('astro:page-load', initArticleEnhancements);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initArticleEnhancements, { once: true });
else initArticleEnhancements();
