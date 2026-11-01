// The homepage owns these listeners; none should survive a ClientRouter swap.
let cleanup: (() => void) | undefined;

const initHeroMotion = () => {
  cleanup?.();
  cleanup = undefined;
  const hero = document.querySelector<HTMLElement>('.home-hero');
  const portrait = hero?.querySelector<HTMLElement>('[data-hero-portrait]');
  if (!hero || !portrait) return;

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let visible = true;
  let bounds: DOMRect | undefined;
  let frame = 0;
  let x = 0;
  let y = 0;

  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    bounds = undefined;
    for (const property of ['--hero-x', '--hero-y', '--hero-rx', '--hero-ry']) {
      portrait.style.removeProperty(property);
    }
  };
  const sync = () => {
    const paused = document.hidden || !visible || reducedMotion.matches;
    hero.toggleAttribute('data-motion-paused', paused);
    if (paused || !finePointer.matches) reset();
  };
  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }) : undefined;
  observer?.observe(hero);

  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches || !finePointer.matches || document.hidden || !visible) return;
    bounds ??= hero.getBoundingClientRect();
    x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      portrait.style.setProperty('--hero-x', `${x * 6}px`);
      portrait.style.setProperty('--hero-y', `${y * 4}px`);
      portrait.style.setProperty('--hero-rx', `${-y * 1.5}deg`);
      portrait.style.setProperty('--hero-ry', `${x * 2}deg`);
    });
  }, { passive: true, signal });
  hero.addEventListener('pointerleave', reset, { signal });
  hero.addEventListener('pointercancel', reset, { signal });
  window.addEventListener('blur', reset, { signal });
  window.addEventListener('resize', reset, { passive: true, signal });
  window.addEventListener('scroll', reset, { passive: true, signal });
  document.addEventListener('visibilitychange', sync, { signal });
  reducedMotion.addEventListener('change', sync, { signal });
  finePointer.addEventListener('change', sync, { signal });
  sync();

  cleanup = () => {
    controller.abort();
    observer?.disconnect();
    reset();
    hero.removeAttribute('data-motion-paused');
  };
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroMotion, { once: true });
} else {
  initHeroMotion();
}
document.addEventListener('astro:page-load', initHeroMotion);
document.addEventListener('astro:before-swap', () => {
  cleanup?.();
  cleanup = undefined;
});

export {};
