// @ts-nocheck
export {};

/* Sparse, translucent particles drift in short paths and fade away, matching
   the reference's animated SVG background. The field stays fixed to the
   viewport and uses simple circles so particles remain crisp rather than
   reading as blurred star glows. */
export const startAtmosphere = () => {
  const canvas = document.getElementById('atmosphere-canvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';
  const context = canvas.getContext('2d');
  if (!context) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FRAME_INTERVAL = 1000 / 30;

  /* The reference uses rgba(84, 103, 232, 0.11) dots on white. Keep the same
     restrained contrast in dark mode with the theme's light periwinkle. */
  const TONES = {
    paper: { core: '84, 103, 232', alpha: 0.11 },
    'paper-dark': { core: '147, 161, 255', alpha: 0.11 },
  };
  let theme = document.documentElement.dataset.theme === 'paper-dark' ? 'paper-dark' : 'paper';

  let motes = [];
  let frame = 0;
  let lastFrame = 0;
  let width = 0;
  let height = 0;

  const seed = () => {
    motes = Array.from({ length: 87 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const travel = 20 + Math.random() * 100;
      const period = 5000;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        dx: Math.cos(angle) * travel * (width / 640),
        dy: Math.sin(angle) * travel * (height / 480),
        radius: 0.2 + Math.pow(Math.random(), 0.85) * 2.8,
        active: Math.random() < 0.4,
        period,
        lifetime: 1000 + Math.random() * 2000,
        phase: Math.random() * period,
      };
    });
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const previousWidth = width;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Mobile browsers fire resize whenever the address bar slides in or out,
    // which only changes the height. Reseeding then would teleport the field
    // mid-scroll, so keep it unless the width actually changed.
    if (!motes.length || width !== previousWidth || motes.length === 0) seed();
  };

  const draw = (mote, time) => {
    const tone = TONES[theme];
    if (!mote.active) return;
    const age = (time + mote.phase) % mote.period;
    if (age >= mote.lifetime) return;

    const progress = age / mote.period;
    const eased = progress * progress;
    const fadeProgress = age / mote.lifetime;
    const fade = fadeProgress < 0.55 ? 1 : 1 - (fadeProgress - 0.55) / 0.45;
    context.globalAlpha = tone.alpha * fade;
    context.fillStyle = `rgb(${tone.core})`;
    context.beginPath();
    context.ellipse(
      mote.x + mote.dx * eased,
      mote.y + mote.dy * eased,
      mote.radius * (width / 640) * (0.8 + progress * 0.4),
      mote.radius * (height / 480) * (0.8 + progress * 0.4),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  };

  const render = (now = performance.now()) => {
    frame = 0;
    // ClientRouter persists this canvas between pages; a detached node means the
    // whole atmosphere was replaced, so stop instead of burning frames.
    if (!canvas.isConnected) return;
    if (!reduceMotion.matches && now - lastFrame < FRAME_INTERVAL) {
      frame = requestAnimationFrame(render);
      return;
    }
    lastFrame = now;

    context.clearRect(0, 0, width, height);
    motes.forEach((mote) => draw(mote, now));
    context.globalAlpha = 1;

    if (!reduceMotion.matches) frame = requestAnimationFrame(render);
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!canvas.isConnected) return;
    lastFrame = 0;
    resize();
    render();
  };

  // Re-seed on a theme switch so the color change takes effect immediately.
  const themeObserver = new MutationObserver(() => {
    const next = document.documentElement.dataset.theme === 'paper-dark' ? 'paper-dark' : 'paper';
    if (next === theme) return;
    theme = next;
    seed();
    refresh();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Coalesce resize bursts (rotation, address bar animation) into one frame.
  let resizeFrame = 0;
  const scheduleRefresh = () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; refresh(); });
  };

  // The fixed field keeps moving while the reader scrolls. The 30fps cap and
  // capped DPR keep its work bounded behind long pages.
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  reduceMotion.addEventListener?.('change', refresh);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    // Resume where the motes were instead of reseeding the whole field.
    if (!document.hidden && canvas.isConnected && width > 0) {
      lastFrame = 0;
      render();
    }
  });

  // The canvas is a decorative overlay, so there is no reason to spend frames on
  // it while the initial render is still settling. Start the ambient loop once
  // the page has loaded and the browser is idle; readers who asked for reduced
  // motion get their single static frame immediately.
  const start = () => refresh();
  if (reduceMotion.matches) {
    start();
  } else if (document.readyState === 'complete') {
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1500 });
    else window.setTimeout(start, 200);
  } else {
    window.addEventListener('load', () => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1500 });
      else window.setTimeout(start, 200);
    }, { once: true });
  }
};
