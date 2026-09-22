// Extracted from BaseLayout.astro. Bundled and cached by Astro/Vite.
import { ROUTES } from '../config/routes';
import { withBase } from '../lib/urls';

const isProduction = import.meta.env.PROD;
const serviceWorkerUrl = withBase(ROUTES.SERVICE_WORKER);
const serviceWorkerScope = withBase(ROUTES.HOME);
if (!isProduction && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
    } else if ('serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope }).catch(() => {});
      });
    }
  
