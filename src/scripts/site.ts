// @ts-nocheck
// Progressive chrome that has to survive ClientRouter navigations: the
// back-to-top control and the navigation drawer. Article tables are wrapped
// at build time by plugins/rehype-wrap-tables.mjs. Page transitions
// themselves are handled by <ClientRouter />.
import { LAYOUT } from '../config/ui';
import { onScrollFrame } from '../lib/scroll';

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
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !panel) { dialog.close(); return; }
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
  } else if (dialog.contains(target) && target.closest('[data-open-search]')) {
    dialog.close();
  } else if (dialog.contains(target) && target.closest('a[href]')) {
    dialog.close();
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
   listener is bound once here rather than on every page load. The class is only
   written when it actually changes: `classList.toggle` on every scroll event
   invalidated style for the whole document even when the answer was the same,
   which showed up as a style recalculation on each of the ~80 scroll events a
   second that a trackpad produces. */
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  onScrollFrame(() => {
    const next = window.scrollY > LAYOUT.BACK_TO_TOP_THRESHOLD;
    if (next === visible) return;
    visible = next;
    backToTop.classList.toggle('visible', next);
  });
  // The CSS reduced-motion rule cannot reach a scripted smooth scroll.
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }));
}
