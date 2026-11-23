// Extracted from BaseLayout.astro. Bundled and cached by Astro/Vite.
// The base-aware URLs are rendered onto <html> by BaseLayout so the
// service worker path stays visible to the smoke test.
const root = document.documentElement;
const isProduction = import.meta.env.PROD;
const serviceWorkerUrl = root.dataset.serviceWorker || '/sw.js';
const serviceWorkerScope = root.dataset.serviceWorkerScope || '/';
if ('serviceWorker' in navigator) {
  if (!isProduction) {
    const scope = new URL(serviceWorkerScope, location.href).href;
    void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
      registrations.filter((registration) => registration.scope === scope
        && (registration.active ?? registration.waiting ?? registration.installing)?.scriptURL === new URL(serviceWorkerUrl, location.href).href)
        .map((registration) => registration.unregister()),
    )).catch(() => {});
  } else if (location.protocol === 'https:') {
    const register = () => {
      void navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope }).catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}
