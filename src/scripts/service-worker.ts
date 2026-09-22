// Extracted from BaseLayout.astro. Bundled and cached by Astro/Vite.
// The base-aware URLs are rendered onto <html> by BaseLayout so the
// service worker path stays visible to the smoke test.
const root = document.documentElement;
const isProduction = import.meta.env.PROD;
const serviceWorkerUrl = root.dataset.serviceWorker || '/sw.js';
const serviceWorkerScope = root.dataset.serviceWorkerScope || '/';
if (!isProduction && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
    } else if ('serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope }).catch(() => {});
      });
    }
  
