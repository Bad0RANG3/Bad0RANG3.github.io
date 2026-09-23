import './theme';
import './site';
import './service-worker';

// Decorative animation is split from the critical bundle and never requested
// on reading pages, where continuous canvas work competes with scrolling.
// Re-check after ClientRouter navigation because this module itself is cached.
const syncAtmosphere = () => {
  if (document.documentElement.dataset.ambientMotion === 'true') {
    void import('./atmosphere').then(({ startAtmosphere }) => startAtmosphere());
  }
};

document.addEventListener('astro:page-load', syncAtmosphere);
syncAtmosphere();
