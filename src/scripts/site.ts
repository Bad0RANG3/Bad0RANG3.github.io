// @ts-nocheck
// Progressive chrome that has to survive ClientRouter navigations: the
// back-to-top control, the navigation drawer and responsive table wrapping.
// Page transitions themselves are handled by <ClientRouter />, so there is
// no custom enter/leave animation to run here.
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

/* Navigation drawer (MobileDrawer.astro). The dialog is replaced on every
   navigation, so everything is delegated from document and bound once. */
const getDrawer = () => {
  const dialog = document.getElementById('mobile-drawer');
  return dialog instanceof HTMLDialogElement ? dialog : null;
};
const setDrawerExpanded = (value) => {
  document.querySelectorAll('[data-drawer-trigger]').forEach((trigger) => trigger.setAttribute('aria-expanded', String(value)));
};
const closeDrawer = (dialog) => {
  const panel = dialog.querySelector('.drawer-panel');
  if (!dialog.open || panel?.classList.contains('animate-out')) return;
  if (!panel) {
    dialog.close();
    return;
  }
  panel.classList.add('animate-out');
  panel.addEventListener('animationend', () => {
    panel.classList.remove('animate-out');
    if (dialog.open) dialog.close();
  }, { once: true });
};
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const dialog = getDrawer();
  if (!target || !dialog) return;
  if (target.closest('[data-drawer-trigger]')) {
    if (!dialog.open) {
      dialog.showModal();
      setDrawerExpanded(true);
    }
  } else if (dialog.contains(target) && target.closest('[data-close-drawer]')) {
    event.preventDefault();
    closeDrawer(dialog);
  }
});
// `cancel` (Escape) and `close` do not bubble, so catch them while capturing.
document.addEventListener('cancel', (event) => {
  const dialog = getDrawer();
  if (!dialog || event.target !== dialog) return;
  event.preventDefault();
  closeDrawer(dialog);
}, true);
document.addEventListener('close', (event) => {
  const dialog = getDrawer();
  if (!dialog || event.target !== dialog) return;
  dialog.querySelector('.drawer-panel')?.classList.remove('animate-out');
  setDrawerExpanded(false);
}, true);

/* Back to top. The button itself is persisted across navigations, so the
   listener is bound once here rather than on every page load. */
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = () => backToTop.classList.toggle('visible', window.scrollY > LAYOUT.BACK_TO_TOP_THRESHOLD);
  window.addEventListener('scroll', toggle, { passive: true });
  // The CSS reduced-motion rule cannot reach a scripted smooth scroll.
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }));
  toggle();
}
