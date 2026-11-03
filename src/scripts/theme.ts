// Theme controller. The first paint is already handled by the small inline
// script in `BaseLayout.astro`'s <head>, which resolves the stored preference
// before the SSR light default can flash; that script has to stay inline
// because a module would arrive after the first paint. This file owns
// everything that happens afterwards, and reads its constants from
// `config/site` rather than from a second copy injected into the document.
//
// ClientRouter replaces the markup on every navigation but evaluates each
// module once per visit, so every listener here is document-level and every
// repaint is idempotent.
import { SITE } from '../config/site';

const LIGHT = SITE.THEME;
const DARK = SITE.THEME_DARK;
const media = window.matchMedia('(prefers-color-scheme: dark)');

const systemTheme = () => (media.matches ? DARK : LIGHT);

const storedTheme = () => {
  try {
    const stored = localStorage.getItem(SITE.THEME_STORAGE_KEY);
    if (stored === DARK || stored === LIGHT) return stored;
  } catch {}
  return systemTheme();
};

const currentTheme = () => (document.documentElement.getAttribute('data-theme') === DARK ? DARK : LIGHT);

const paint = (doc: Document, theme: string) => {
  const root = doc.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === DARK ? 'dark' : 'light';
  root.setAttribute('data-theme-ready', 'true');
  const meta = doc.getElementById('meta-theme-color') ?? doc.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === DARK ? SITE.THEME_COLOR_DARK : SITE.THEME_COLOR);
};

const updateToggleUI = (theme: string) => {
  const isDark = theme === DARK;
  document.querySelectorAll('#theme-toggle, [data-theme-toggle]').forEach((button) => {
    button.setAttribute('aria-label', isDark ? '切换亮色模式' : '切换深色模式');
    button.setAttribute('title', isDark ? '切换到亮色' : '切换到深色');
    button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  });
};

const applyTheme = (theme: string, persist: boolean) => {
  const next = theme === DARK ? DARK : LIGHT;
  paint(document, next);
  if (persist) {
    try { localStorage.setItem(SITE.THEME_STORAGE_KEY, next); } catch {}
  }
  updateToggleUI(next);
  window.dispatchEvent(new CustomEvent('b0-theme-change', { detail: { theme: next } }));
};

const syncTheme = () => applyTheme(storedTheme(), false);

// Repaint once on evaluation. Idempotent, and the only thing that fixes the
// page if the inline script could not run (storage disabled, a strict CSP).
applyTheme(storedTheme(), false);

// Paint the incoming document before ClientRouter swaps it in, so the SSR
// light default never flashes over a dark preference.
document.addEventListener('astro:before-swap', (event) => {
  const incoming = (event as { newDocument?: Document }).newDocument;
  if (incoming?.documentElement) paint(incoming, storedTheme());
});

// Belt and suspenders: re-assert after the swap in case anything else touched
// the root attributes.
document.addEventListener('astro:after-swap', syncTheme);

// Last line of defence: if any other script (an older cached bundle, an
// extension, a transition race) rewrites `data-theme`, snap it back to the
// preference that was actually resolved. Idempotent, so it cannot loop.
new MutationObserver(() => {
  const wanted = storedTheme();
  if (document.documentElement.getAttribute('data-theme') !== wanted) paint(document, wanted);
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// Delegated, so the control keeps working after the header is replaced.
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('#theme-toggle, [data-theme-toggle]') : null;
  if (button) applyTheme(currentTheme() === DARK ? LIGHT : DARK, true);
});

media.addEventListener('change', () => {
  try {
    if (localStorage.getItem(SITE.THEME_STORAGE_KEY)) return;
  } catch {}
  applyTheme(systemTheme(), false);
});

document.addEventListener('astro:page-load', syncTheme);
window.addEventListener('pageshow', syncTheme);
