// @ts-nocheck
// Extracted from BaseLayout.astro. Bundled and cached by Astro/Vite.
import { SITE } from '../config/site';

const themeStorageKey = SITE.THEME_STORAGE_KEY;
const themeLight = SITE.THEME;
const themeDark = 'paper-dark';
const themeColorLight = SITE.THEME_COLOR;
const themeColorDark = SITE.THEME_COLOR_DARK;
    /* Theme controller.
       Lives in <head> and binds document-level listeners once. Astro's
       ClientRouter de-duplicates identical inline scripts, so a per-page
       script would stop running after the first navigation; delegating and
       reacting to the transition events keeps the theme correct everywhere. */
    (function () {
      var LIGHT = themeLight;
      var DARK = themeDark;
      var media = window.matchMedia('(prefers-color-scheme: dark)');

      function systemTheme() { return media.matches ? DARK : LIGHT; }

      function storedTheme() {
        try {
          var stored = localStorage.getItem(themeStorageKey);
          if (stored === DARK || stored === LIGHT) return stored;
        } catch (e) {}
        return systemTheme();
      }

      function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === DARK ? DARK : LIGHT;
      }

      function updateToggleUI(theme) {
        var button = document.getElementById('theme-toggle');
        if (!button) return;
        var isDark = theme === DARK;
        button.setAttribute('aria-label', isDark ? '切换亮色模式' : '切换深色模式');
        button.setAttribute('title', isDark ? '切换到亮色' : '切换到深色');
        button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      }

      function paint(doc, theme) {
        var root = doc.documentElement;
        root.setAttribute('data-theme', theme);
        root.style.colorScheme = theme === DARK ? 'dark' : 'light';
        root.setAttribute('data-theme-ready', 'true');
        var meta = doc.getElementById('meta-theme-color') || doc.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === DARK ? themeColorDark : themeColorLight);
      }

      function applyTheme(theme, persist) {
        var next = theme === DARK ? DARK : LIGHT;
        paint(document, next);
        if (persist) {
          try { localStorage.setItem(themeStorageKey, next); } catch (e) {}
        }
        updateToggleUI(next);
        window.dispatchEvent(new CustomEvent('b0-theme-change', { detail: { theme: next } }));
      }

      function syncTheme() { applyTheme(storedTheme(), false); }

      // Always repaint on execution: this script can re-run once during the
      // first ClientRouter navigation. Painting is idempotent.
      paint(document, storedTheme());

      // Register listeners only once per page session.
      if (window.__b0ThemeBound) return;
      window.__b0ThemeBound = true;

      // Paint the incoming document before ClientRouter swaps it in, so the
      // SSR light default never flashes over a dark preference.
      document.addEventListener('astro:before-swap', function (event) {
        var incoming = event.newDocument;
        if (incoming && incoming.documentElement) paint(incoming, storedTheme());
      });

      // Belt-and-suspenders: re-assert after the swap in case anything else
      // touched the root attributes.
      document.addEventListener('astro:after-swap', function () {
        paint(document, storedTheme());
      });

      // Last line of defence: if any other script (older cached bundle, an
      // extension, a transition race) rewrites data-theme, snap it back to the
      // preference we actually resolved. Idempotent, so it cannot loop.
      new MutationObserver(function () {
        var wanted = storedTheme();
        if (document.documentElement.getAttribute('data-theme') !== wanted) paint(document, wanted);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      // Delegated so the control keeps working after the header is replaced.
      document.addEventListener('click', function (event) {
        var target = event.target;
        var button = target instanceof Element ? target.closest('#theme-toggle') : null;
        if (button) applyTheme(currentTheme() === DARK ? LIGHT : DARK, true);
      });

      media.addEventListener?.('change', function () {
        try {
          if (localStorage.getItem(themeStorageKey)) return;
        } catch (e) {}
        applyTheme(systemTheme(), false);
      });

      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncTheme, { once: true });
      else syncTheme();
      document.addEventListener('astro:page-load', syncTheme);
      window.addEventListener('pageshow', syncTheme);
    })();
  
