import tracks from '../data/atmosphere-keyframes.json';

// Reproduce the 640 × 480 SVG background embedded in https://synthion.space/.
// Its 87 circles share a five-second timeline, with linear interpolation of
// position, radius and opacity. The supplied keyframes encode the outward
// acceleration; do not replace them with a constant-speed particle emitter.
const PERIOD = 5000;
// The loop rides requestAnimationFrame, so it can follow the panel instead of a
// hard 30 fps — but a 144 Hz display would then fill 87 ellipses 144 times a
// second. The cadence is therefore learned from the display and capped: raw rAF
// deltas are sampled on the first frames (and again after a resize or a tab
// return), the shortest of them estimates one panel frame, and the loop then
// steps a whole number of those frames, landing just under the cap. Whole-frame
// pacing keeps the motion even — no beat judder against the panel — and the cap
// keeps a high-refresh phone from burning battery on a decorative background.
const TARGET_FPS = 90;
const TARGET_INTERVAL = 1000 / TARGET_FPS;
const PROBE_FRAMES = 12;
const MIN_FRAME = 1000 / 240;
const MAX_FRAME = 1000 / 30;
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
  // Cadence learned from the display: the duration of one panel frame, and the
  // throttled interval the loop actually uses.
  let displayFrame = 1000 / 60;
  let frameInterval = TARGET_INTERVAL;
  let probing = true;
  let probe: number[] = [];

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

  // Convert the probed deltas into a pacing interval. The shortest delta is the
  // cleanest read on the panel: a loaded or janky frame only ever stretches a
  // delta, never shortens it. The estimate is clamped so a wild sample cannot
  // pretend the display is faster than 240 Hz or slower than 30 Hz, and the
  // interval is then rounded up to a whole number of panel frames so the loop
  // stays locked to vsync instead of drifting in and out of phase with it.
  const settle = () => {
    const shortest = Math.min(...probe);
    if (probe.length >= 4 && Number.isFinite(shortest)) {
      displayFrame = Math.min(Math.max(shortest, MIN_FRAME), MAX_FRAME);
    }
    const ratio = TARGET_INTERVAL / displayFrame;
    // A panel that already sits at the cap keeps its native cadence; anything
    // faster is stepped down to the next whole frame multiple.
    frameInterval = displayFrame * (ratio < 1.15 ? 1 : Math.ceil(ratio));
    probing = false;
    probe = [];
  };

  const render = (now = performance.now()) => {
    frame = 0;
    if (!canvas.isConnected) { stop(); return; }
    const motion = !reduceMotion.matches;
    if (lastFrame && motion) {
      const delta = now - lastFrame;
      if (probing) {
        // Probing paints every raw frame, so the deltas describe the panel
        // rather than this loop's own throttle.
        probe.push(delta);
        if (probe.length === PROBE_FRAMES) settle();
      } else if (delta + displayFrame / 2 < frameInterval) {
        // Early frame: leave lastFrame where it is, so the next painted frame
        // still accounts for the whole elapsed span and the 5s period holds.
        // The half-frame slack matters: rAF timestamps land a hair either side
        // of the exact refresh interval, and comparing them head-on would skip
        // frames that are on time (a 60 Hz panel painting 40 fps).
        frame = requestAnimationFrame(render);
        return;
      }
      elapsed += delta;
    }
    lastFrame = now;
    paint();
    if (motion) frame = requestAnimationFrame(render);
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    if (!canvas.isConnected) { stop(); return; }
    lastFrame = 0;
    // Re-learn the cadence: the window may have moved to another display.
    probing = true;
    probe = [];
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
