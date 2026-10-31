import tracks from '../data/atmosphere-keyframes.json';

// Reproduce the 640 × 480 SVG background embedded in https://synthion.space/.
// Its 87 circles share a five-second timeline, with linear interpolation of
// position, radius and opacity. The supplied keyframes encode the outward
// acceleration; do not replace them with a constant-speed particle emitter.
const PERIOD = 5000;
const FRAME_INTERVAL = 1000 / 30;
const sample = (values: number[], progress: number) => {
  const index = progress * (values.length - 1);
  const first = Math.floor(index);
  return values[first] + (values[Math.min(first + 1, values.length - 1)] - values[first]) * (index - first);
};

export const startAtmosphere = () => {
  const canvas = document.getElementById('atmosphere-canvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.bound === '1') return;
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.dataset.bound = '1';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let width = 0;
  let height = 0;
  let frame = 0;
  let resizeFrame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let theme = document.documentElement.dataset.theme;

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const paint = () => {
    const progress = (elapsed % PERIOD) / PERIOD;
    context.clearRect(0, 0, width, height);
    context.fillStyle = theme === 'paper-dark' ? 'rgb(147, 161, 255)' : 'rgb(84, 103, 232)';
    for (const track of tracks) {
      const opacity = sample(track.opacity, progress);
      if (opacity <= 0) continue;
      const radius = sample(track.radius, progress);
      context.globalAlpha = 0.11 * opacity;
      context.beginPath();
      // The source SVG uses preserveAspectRatio="none" and background-size:
      // 100% 100%, stretching both positions and radii with the viewport.
      context.ellipse(
        sample(track.x, progress) * width / 640,
        sample(track.y, progress) * height / 480,
        radius * width / 640,
        radius * height / 480,
        0, 0, Math.PI * 2,
      );
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(resizeFrame);
    themeObserver.disconnect();
    controller.abort();
  };

  const render = (now = performance.now()) => {
    frame = 0;
    if (!canvas.isConnected) { stop(); return; }
    if (!reduceMotion.matches && lastFrame && now - lastFrame < FRAME_INTERVAL) {
      frame = requestAnimationFrame(render);
      return;
    }
    if (lastFrame && !reduceMotion.matches) elapsed += now - lastFrame;
    lastFrame = now;
    paint();
    if (!reduceMotion.matches) frame = requestAnimationFrame(render);
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    if (!canvas.isConnected) { stop(); return; }
    lastFrame = 0;
    resize();
    if (reduceMotion.matches) elapsed = 0;
    if (!document.hidden) render();
  };

  const themeObserver = new MutationObserver(() => {
    theme = document.documentElement.dataset.theme;
    if (canvas.isConnected) paint();
    else stop();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.addEventListener('resize', () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; refresh(); });
  }, { passive: true, signal });
  reduceMotion.addEventListener('change', refresh, { signal });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    if (!document.hidden) refresh();
  }, { signal });

  refresh();
};
