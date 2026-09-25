// @ts-nocheck
// Progressive chrome that has to survive ClientRouter navigations: the
// back-to-top control and responsive table wrapping. Page transitions
// themselves are handled by <ClientRouter />, so there is no custom
// enter/leave animation to run here.
import { LAYOUT } from '../config/ui';

/* Keep article tables readable on narrow screens without widening the page. */
const wrapTables = () => {
  document.querySelectorAll('.prose table').forEach((table) => {
    if (table.parentElement?.classList.contains('table-wrapper')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
};

const init = () => wrapTables();

document.addEventListener('astro:page-load', init);
init();

/* Back to top. The button itself is persisted across navigations, so the
   listener is bound once here rather than on every page load. */
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
  const toggle = () => backToTop.classList.toggle('visible', window.scrollY > LAYOUT.BACK_TO_TOP_THRESHOLD);
  window.addEventListener('scroll', toggle, { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  toggle();
}
