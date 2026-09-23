export {};

const initComments = () => {
  document.querySelectorAll<HTMLElement>('[data-comments]').forEach((root) => {
    if (root.dataset.bound === '1') return;
    root.dataset.bound = '1';
    const container = root.querySelector('[data-giscus-container]');
    if (!(container instanceof HTMLElement)) return;

    const load = () => {
      if (container.dataset.loaded === '1') return;
      container.dataset.loaded = '1';
      const script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      const themeDark = root.dataset.themeDark || 'dark';
      const attributes = {
        'data-repo': root.dataset.repo,
        'data-repo-id': root.dataset.repoId,
        'data-category': root.dataset.category,
        'data-category-id': root.dataset.categoryId,
        'data-mapping': 'pathname',
        'data-strict': '0',
        'data-reactions-enabled': '1',
        'data-emit-metadata': '0',
        'data-input-position': 'bottom',
        'data-theme': document.documentElement.getAttribute('data-theme') === themeDark ? 'dark' : 'light',
        'data-lang': 'zh-CN',
      };
      Object.entries(attributes).forEach(([key, value]) => { if (value) script.setAttribute(key, value); });
      container.replaceChildren(script);
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      }, { rootMargin: '800px 0px' });
      observer.observe(root);
    } else {
      globalThis.setTimeout(load, 1500);
    }

    if (!window.__b0GiscusThemeBound) {
      window.__b0GiscusThemeBound = true;
      window.addEventListener('b0-theme-change', (event) => {
        const activeRoot = document.querySelector<HTMLElement>('[data-comments]');
        const darkTheme = activeRoot?.dataset.themeDark || 'dark';
        const theme = (event as CustomEvent).detail?.theme === darkTheme ? 'dark' : 'light';
        const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
        iframe?.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app');
      });
    }
  });
};

declare global {
  interface Window { __b0GiscusThemeBound?: boolean; }
}

document.addEventListener('astro:page-load', initComments);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initComments, { once: true });
else initComments();
