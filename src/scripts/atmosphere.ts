// @ts-nocheck
export {};

/* Particle atmosphere.
   A fixed field of tiny, very faint periwinkle motes drifting slowly upward —
   the one decorative element the reference design leans on. It replaced the
   sakura petal field: same canvas, same ~30fps budget, different vocabulary.

   Two things keep it cheap enough to run behind a 5000px article:
     - every mote is blitted from one pre-rendered radial-gradient sprite, so a
       frame costs no path work at all (the petals used to be five stroked
       ellipses each);
     - the field is seeded once per width, so a mobile address bar sliding in
       and out does not teleport it.
   Density, alpha and colour all follow the theme: the dark theme needs more
   light per mote to stay visible on a near-black page. */
export const startAtmosphere = () => {
  const canvas = document.getElementById('atmosphere-canvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';
  const context = canvas.getContext('2d');
  if (!context) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FRAME_INTERVAL = 1000 / 30;
  const SPRITE_SIZE = 32;

  /* [core, edge] per theme. `paper` is the faint wash the reference site uses
     (its motes are rgba(84,103,232,.11)); `paper-dark` swaps to the lighter
     periwinkle the dark palette already uses for text accents. */
  const TONES = {
    paper: { core: '84, 103, 232', peak: 0.3, floor: 0.08 },
    'paper-dark': { core: '147, 161, 255', peak: 0.42, floor: 0.1 },
  };

  const spriteFor = (core) => {
    const sprite = document.createElement('canvas');
    sprite.width = SPRITE_SIZE;
    sprite.height = SPRITE_SIZE;
    const g = sprite.getContext('2d');
    const half = SPRITE_SIZE / 2;
    const gradient = g.createRadialGradient(half, half, 0, half, half, half);
    // A soft edge rather than a hard one: at 1-3px a flat circle aliases into a
    // grey square on a white page.
    gradient.addColorStop(0, `rgba(${core}, 1)`);
    gradient.addColorStop(0.55, `rgba(${core}, 0.72)`);
    gradient.addColorStop(1, `rgba(${core}, 0)`);
    g.fillStyle = gradient;
    g.beginPath();
    g.arc(half, half, half, 0, Math.PI * 2);
    g.fill();
    return sprite;
  };

  const sprites = {
    paper: spriteFor(TONES.paper.core),
    'paper-dark': spriteFor(TONES['paper-dark'].core),
  };
  let theme = document.documentElement.dataset.theme === 'paper-dark' ? 'paper-dark' : 'paper';

  let motes = [];
  let frame = 0;
  let lastFrame = 0;
  let width = 0;
  let height = 0;

  const seed = () => {
    const tone = TONES[theme];
    const amount = Math.min(190, Math.max(36, Math.round((width * height) / 11_000)));
    motes = Array.from({ length: amount }, () => {
      // Two thirds of the field is barely-there dust; the rest is a little
      // brighter so the drift reads as movement rather than noise.
      const bright = Math.random() < 0.34;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: bright ? 0.9 + Math.random() * 1.5 : 0.45 + Math.random() * 0.85,
        alpha: bright
          ? tone.peak * (0.55 + Math.random() * 0.45)
          : tone.floor * (0.6 + Math.random() * 0.8),
        rise: 0.05 + Math.random() * 0.22,
        sway: 6 + Math.random() * 26,
        swaySpeed: 0.00016 + Math.random() * 0.00035,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.0005 + Math.random() * 0.0011,
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
    const drift = Math.sin(time * mote.swaySpeed + mote.phase) * mote.sway;
    const pulse = 0.62 + 0.38 * Math.sin(time * mote.twinkle * 6 + mote.phase);
    const radius = mote.radius * 3.2;
    context.globalAlpha = Math.min(tone.peak, mote.alpha * pulse);
    context.drawImage(sprites[theme], mote.x + drift - radius, mote.y - radius, radius * 2, radius * 2);
  };

  const render = (now = performance.now()) => {
    frame = 0;
    // ClientRouter persists this canvas between pages; a detached node means the
    // whole atmosphere was replaced, so stop instead of burning frames.
    if (!canvas.isConnected) return;
    if (now - lastFrame < FRAME_INTERVAL) {
      if (!reduceMotion.matches) frame = requestAnimationFrame(render);
      return;
    }
    lastFrame = now;

    context.clearRect(0, 0, width, height);
    motes.forEach((mote) => {
      draw(mote, now);
      if (reduceMotion.matches) return;
      mote.y -= mote.rise;
      if (mote.y + mote.radius * 3 < 0) {
        mote.y = height + mote.radius * 3;
        mote.x = Math.random() * width;
      }
    });
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

  // The theme switch changes the field's colour and its alpha, so the sprites
  // are reseeded rather than merely repainted.
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

  // The field keeps drifting while the reader scrolls: it is a fixed overlay and
  // should feel alive on long pages. Cost stays bounded by the ~30fps step, the
  // capped DPR and the sprite cache, so scroll frames are not starved.
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
