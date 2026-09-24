// @ts-nocheck
export {};

/* Sakura atmosphere.
   The flowers were originally redrawn as five stroked ellipses every frame.
   Each tone is now rasterised once into an offscreen sprite and blitted with
   drawImage, which keeps the same look for a fraction of the per-frame path
   work. Particle counts and DPR are capped, and the loop steps at ~30fps. */
export const startAtmosphere = () => {
  const canvas = document.getElementById('sakura-canvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';
  const context = canvas.getContext('2d');
  if (!context) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FLOWER_R = 64;
  const FRAME_INTERVAL = 1000 / 30;
  let blossoms = [];
  let motes = [];
  let frame = 0;
  let lastFrame = 0;
  let running = false;
  let scrollTimer = 0;
  let width = 0;
  let height = 0;

  const flowerSprites = [
    ['#ff91af', '#ffd3df'],
    ['#e56e91', '#ffb6c9'],
    ['#b174b7', '#efafd5'],
  ].map(([outer, inner]) => {
    const sprite = document.createElement('canvas');
    sprite.width = FLOWER_R * 2;
    sprite.height = FLOWER_R * 2;
    const g = sprite.getContext('2d');
    g.translate(FLOWER_R, FLOWER_R);
    g.lineWidth = Math.max(0.7, FLOWER_R * 0.018);
    g.strokeStyle = outer;
    for (let petal = 0; petal < 5; petal += 1) {
      g.save();
      g.rotate((Math.PI * 2 * petal) / 5);
      g.beginPath();
      g.ellipse(0, -FLOWER_R * 0.37, FLOWER_R * 0.25, FLOWER_R * 0.46, 0, 0, Math.PI * 2);
      g.fillStyle = petal % 2 === 0 ? outer : inner;
      g.fill();
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, FLOWER_R * 0.13, 0, Math.PI * 2);
    g.fillStyle = '#ffe2c5';
    g.fill();
    return sprite;
  });

  const seed = () => {
    const amount = Math.min(56, Math.max(28, Math.round((width * height) / 52000)));
    blossoms = Array.from({ length: amount }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 16 + Math.random() * 38,
      depth: 0.38 + Math.random() * 0.62,
      speed: 0.18 + Math.random() * 0.34,
      sway: 0.00042 + Math.random() * 0.00058,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.08 + Math.random() * 0.15,
      spin: (Math.random() - 0.5) * 0.0026,
      angle: Math.random() * Math.PI,
      tone: index % 3,
    }));

    motes = Array.from({ length: Math.min(24, Math.max(12, Math.round(width / 84))) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2.8,
      speed: 0.18 + Math.random() * 0.36,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.08 + Math.random() * 0.14,
    }));
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    seed();
  };

  const drawBlossom = (flower, time) => {
    const driftX = Math.sin(time * flower.sway + flower.phase) * 34 * flower.depth;
    const driftY = Math.cos(time * flower.sway * 0.72 + flower.phase) * 20 * flower.depth;
    const edgeDistance = Math.abs((flower.x / Math.max(width, 1)) - 0.5) * 2;
    const radius = flower.radius;
    context.save();
    context.translate(flower.x + driftX, flower.y + driftY);
    context.rotate(flower.angle);
    context.globalAlpha = flower.alpha * (0.42 + edgeDistance * 0.58);
    context.drawImage(flowerSprites[flower.tone], -radius, -radius, radius * 2, radius * 2);
    context.restore();
  };

  const drawMote = (mote, time) => {
    context.save();
    context.translate(mote.x + Math.sin(time * 0.00045 + mote.phase) * 18, mote.y);
    context.rotate(mote.phase + time * 0.00016);
    context.globalAlpha = mote.alpha;
    context.fillStyle = '#ffd1df';
    context.beginPath();
    context.ellipse(0, 0, mote.size * 1.8, mote.size, Math.PI / 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const render = (now = performance.now()) => {
    frame = 0;
    // ClientRouter persists this canvas between pages; a detached node means the
    // whole atmosphere was replaced, so stop instead of burning frames.
    if (!canvas.isConnected) return;
    if (now - lastFrame < FRAME_INTERVAL) {
      if (!reduceMotion.matches && running) frame = requestAnimationFrame(render);
      return;
    }
    lastFrame = now;

    context.clearRect(0, 0, width, height);
    blossoms.forEach((flower) => {
      drawBlossom(flower, now);
      if (!reduceMotion.matches) {
        flower.y += flower.speed;
        flower.angle += flower.spin;
      }
      if (flower.y - flower.radius > height + 50) {
        flower.x = Math.random() * width;
        flower.y = -flower.radius - Math.random() * height * 0.18;
      }
    });

    motes.forEach((mote) => {
      drawMote(mote, now);
      if (!reduceMotion.matches) mote.y += mote.speed;
      if (mote.y > height + 12) {
        mote.x = Math.random() * width;
        mote.y = -12;
      }
    });

    if (!reduceMotion.matches && running) frame = requestAnimationFrame(render);
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!canvas.isConnected) { running = false; return; }
    lastFrame = 0;
    running = true;
    resize();
    render();
  };

  // Articles are long, so the reader spends a lot of time scrolling. Freeze the
  // decorative loop while scroll frames are being produced and resume once the
  // motion settles. The BGA stays on screen while reading, but it never competes
  // with scroll work on the critical path.
  const pauseForScroll = () => {
    if (reduceMotion.matches) return;
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      if (document.hidden || !canvas.isConnected) return;
      running = true;
      lastFrame = 0;
      render();
    }, 160);
  };

  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('scroll', pauseForScroll, { passive: true });
  reduceMotion.addEventListener?.('change', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(frame); frame = 0; }
    else refresh();
  });

  // The canvas is a decorative overlay, so there is no reason to spend frames
  // on it while the initial render is still settling. Start the ambient loop
  // once the page has loaded and the browser is idle. Users who asked for
  // reduced motion get their single static frame immediately.
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
