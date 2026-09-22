// @ts-nocheck
// Extracted from BaseLayout.astro. Bundled and cached by Astro/Vite.
import { LAYOUT } from '../config/ui';

const backToTopThreshold = LAYOUT.BACK_TO_TOP_THRESHOLD;
    /* ── Page transition + back-to-top + table wrapping ── */
    (function(){
      const BACK_TO_TOP_THRESHOLD = backToTopThreshold;

      const getPageRoot = () => {
        const el = document.querySelector('.page-enter');
        return el instanceof HTMLElement ? el : null;
      };

      const triggerPageEnter = () => {
        const root = getPageRoot();
        if (!root) return;
        root.style.animation = 'none';
        void root.offsetWidth;
        root.style.animation = '';
      };

      /* Keep article tables readable on narrow screens without widening the page. */
      const wrapTables = () => {
        document.querySelectorAll('.prose table').forEach((tbl) => {
          if (tbl.parentElement && tbl.parentElement.classList.contains('table-wrapper')) return;
          const wrapper = document.createElement('div');
          wrapper.className = 'table-wrapper';
          tbl.parentNode.insertBefore(wrapper, tbl);
          wrapper.appendChild(tbl);
        });
      };

      /* Init */
      const init = () => {
        const root = getPageRoot();
        if (root) root.classList.remove('is-leaving');
        triggerPageEnter();
        wrapTables();
      };

      document.addEventListener('astro:page-load', init);
      window.addEventListener('pageshow', () => {
        const root = getPageRoot();
        if (root) {
          root.classList.remove('is-leaving');
          triggerPageEnter();
        }
      });
      init();

      /* Back to top */
      const backBtn = document.getElementById('back-to-top');
      if (backBtn) {
        const toggleBtn = () => { backBtn.classList.toggle('visible', window.scrollY > BACK_TO_TOP_THRESHOLD); };
        window.addEventListener('scroll', toggleBtn, { passive: true });
        backBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
      }
    })();
  
