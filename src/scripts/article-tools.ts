const initArticleTools = () => {
  document.querySelectorAll<HTMLElement>('[data-article-tools]').forEach((root) => {
    if (root.dataset.bound === '1') return;
    root.dataset.bound = '1';
    const slug = root.dataset.slug || '';
    const key = 'b0-bookmarks';
    const read = (): string[] => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
      } catch { return []; }
    };
    const save = (items: string[]) => { try { localStorage.setItem(key, JSON.stringify(items)); } catch {} };
    const bookmark = root.querySelector('[data-bookmark]');
    const label = root.querySelector('[data-bookmark-label]');
    const sync = () => {
      const active = read().includes(slug);
      bookmark?.setAttribute('aria-pressed', String(active));
      bookmark?.classList.toggle('text-primary', active);
      if (label) label.textContent = active ? '已收藏' : '收藏';
    };
    bookmark?.addEventListener('click', () => {
      const items = read();
      save(items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug]);
      sync();
    });
    root.querySelector('[data-share-link]')?.addEventListener('click', async () => {
      const copyLabel = root.querySelector('[data-copy-link-label]');
      try {
        if (navigator.share) await navigator.share({ title: root.dataset.title || document.title, url: window.location.href });
        else {
          await navigator.clipboard.writeText(window.location.href);
          if (copyLabel) copyLabel.textContent = '已复制链接';
        }
      } catch { if (copyLabel) copyLabel.textContent = '请手动复制'; }
      window.setTimeout(() => { if (copyLabel) copyLabel.textContent = '分享'; }, 1800);
    });
    sync();
  });
};

document.addEventListener('astro:page-load', initArticleTools);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initArticleTools, { once: true });
else initArticleTools();

