import keyframes from '../data/atmosphere-keyframes.json';

// Reproduce the 640 × 480 SVG background embedded in https://synthion.space/.
// Its 87 circles share a five-second timeline, with linear interpolation of
// position, radius and opacity. The supplied keyframes encode the outward
// acceleration; do not replace them with a constant-speed particle emitter.
//
// This is the only thing on the site that keeps running after load, so it is
// also the only thing that can make a slow machine feel slow. Profiling says
// the drawing is free (< 0.1 ms of main thread for all 87 ellipses) and that
// the cost is the *frame*: every animation frame drags a style recalculation, a
// pre-paint, a layer update and a compositor commit behind it, whether or not
// anything was drawn. The loop is therefore built around "how few frames",
// not "how cheap a frame". ARCHITECTURE.md §6 has the measurements.
const PERIOD = 5000;
// Cadence ceiling. A panel at or below this keeps its native cadence; anything
// faster is stepped down to a whole number of panel frames, which keeps the
// motion even instead of beating against the refresh.
const TARGET_FPS = 60;
const TARGET_INTERVAL = 1000 / TARGET_FPS;
// What a device reporting four cores or fewer may ask for. The field moves
// about a third of a pixel per frame at 60 Hz, so halving the rate is not
// something the eye can find, and it halves the pipeline cost on exactly the
// machines that cannot spare it.
const MODEST_FPS = 30;
// The floor the adaptive controller may fall back to.
const FLOOR_INTERVAL = 1000 / 24;
// A painted frame this much later than requested means the device is behind.
const OVERRUN = 1.35;
// Raw rAF deltas are sampled on the first frames (and again after a resize or a
// tab return); the shortest of them estimates one panel frame.
const PROBE_FRAMES = 12;
const MIN_FRAME = 1000 / 240;
const MAX_FRAME = 1000 / 30;
// Where the loop parks when it must not animate. A frozen progress 0 frame is
// nearly empty — most circles have not faded in yet — so the still image comes
// from the busiest part of the loop instead.
const STILL_PROGRESS = 0.34;
// The source SVG stretches with the viewport (`preserveAspectRatio="none"` and
// `background-size: 100% 100%`), so both positions and radii scale per axis.
const SOURCE_WIDTH = 640;
const SOURCE_HEIGHT = 480;
const ALPHA = 0.11;
const DARK = 'rgb(147, 161, 255)';
const LIGHT = 'rgb(84, 103, 232)';

// The source data gives every track 21 keyframes and pads its own tail by
// repeating the final value. The file therefore stores each property only up to
// its last changing keyframe (`k[track][property]`) and this is where the rest
// is put back. Dropping those repeats would be lossless for the *value* but not
// for the *timing*: the sampler spreads whatever it is given across the whole
// five-second period, so a shortened array would keep drifting where the
// original had already settled.
const FRAMES = 21;

/**
 * Column-major keyframe views. Rebuilding four typed arrays once and slicing a
 * view per track means the paint loop never touches a boxed number, never
 * allocates, and never looks a property up by name.
 */
const buildTracks = () => {
  const count = keyframes.k.length;
  const columns = [keyframes.x, keyframes.y, keyframes.radius, keyframes.opacity].map((values, property) => {
    const column = new Float32Array(count * FRAMES);
    let read = 0;
    for (let index = 0; index < count; index += 1) {
      const stored = keyframes.k[index][property];
      const base = index * FRAMES;
      for (let frame = 0; frame < stored; frame += 1) column[base + frame] = values[read + frame];
      for (let frame = stored; frame < FRAMES; frame += 1) column[base + frame] = values[read + stored - 1];
      read += stored;
    }
    return column;
  });
  const view = (column: Float32Array, index: number) => column.subarray(index * FRAMES, (index + 1) * FRAMES);
  return Array.from({ length: count }, (_, index) => ({
    x: view(columns[0], index),
    y: view(columns[1], index),
    radius: view(columns[2], index),
    opacity: view(columns[3], index),
  }));
};

const tracks = buildTracks();

/** Linear interpolation across one track's keyframes at `progress` in [0, 1). */
const at = (values: Float32Array, progress: number) => {
  const last = values.length - 1;
  const index = progress * last;
  const first = index | 0;
  const value = values[first];
  return value + (values[first < last ? first + 1 : first] - value) * (index - first);
};

export const startAtmosphere = () => {
  const canvas = document.getElementById('atmosphere-canvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.bound === '1') return;
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.dataset.bound = '1';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Two advisory hints. `hardwareConcurrency` exists everywhere this site runs;
  // `deviceMemory` is Chromium-only and coarse, so a browser that does not
  // report it simply keeps the animation.
  const cores = navigator.hardwareConcurrency || 0;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  const still = (typeof memory === 'number' && memory > 0 && memory <= 2) || (cores > 0 && cores <= 2);
  const modest = cores > 0 && cores <= 4;
  const ceiling = modest ? 1000 / MODEST_FPS : TARGET_INTERVAL;
  const controller = new AbortController();
  const { signal } = controller;
  let width = 0;
  let height = 0;
  let scaleX = 1;
  let scaleY = 1;
  let frame = 0;
  let timer = 0;
  let resizeFrame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let color = document.documentElement.dataset.theme === 'paper-dark' ? DARK : LIGHT;
  // Cadence learned from the display, and the interval the loop actually uses
  // once the adaptive controller has had its say.
  let displayFrame = 1000 / 60;
  let baseInterval = ceiling;
  let frameInterval = ceiling;
  let overrun = 0;
  let probing = true;
  let probe: number[] = [];

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    scaleX = width / SOURCE_WIDTH;
    scaleY = height / SOURCE_HEIGHT;
  };

  const paint = () => {
    const progress = (elapsed % PERIOD) / PERIOD;
    context.clearRect(0, 0, width, height);
    context.fillStyle = color;
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      const opacity = at(track.opacity, progress);
      if (opacity <= 0) continue;
      const radius = at(track.radius, progress);
      context.globalAlpha = ALPHA * opacity;
      context.beginPath();
      context.ellipse(
        at(track.x, progress) * scaleX,
        at(track.y, progress) * scaleY,
        radius * scaleX,
        radius * scaleY,
        0, 0, Math.PI * 2,
      );
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
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
    const ratio = ceiling / displayFrame;
    // A panel that already sits at or under the ceiling keeps its native
    // cadence; anything faster is stepped down to a whole frame multiple.
    baseInterval = displayFrame * (ratio < 1.15 ? 1 : Math.ceil(ratio));
    frameInterval = baseInterval;
    overrun = 0;
    probing = false;
    probe = [];
  };

  const render = (now = performance.now()) => {
    frame = 0;
    if (!canvas.isConnected) { stop(); return; }
    const motion = !reduceMotion.matches && !still;
    if (lastFrame && motion) {
      const delta = now - lastFrame;
      elapsed += delta;
      if (probing) {
        // Probing paints every raw frame, so the deltas describe the panel
        // rather than this loop's own throttle.
        probe.push(delta);
        if (probe.length === PROBE_FRAMES) settle();
      } else {
        // How late the frame that just came due actually arrived. A device that
        // keeps overrunning its own requested cadence is already behind, so the
        // decoration gives up frames rather than competing for them. Half a
        // panel frame of slack is discounted: a frame landing on the far side
        // of vsync is not the device struggling.
        const late = delta - frameInterval - displayFrame / 2;
        overrun = overrun * 0.7 + Math.max(0, late) * 0.3;
        if (overrun > displayFrame * (OVERRUN - 1)) frameInterval = Math.min(frameInterval * 1.3, FLOOR_INTERVAL);
        else if (overrun < displayFrame * 0.05) frameInterval = Math.max(frameInterval * 0.85, baseInterval);
      }
    }
    lastFrame = now;
    paint();
    if (!motion) return;
    if (probing) {
      frame = requestAnimationFrame(render);
      return;
    }
    // Pace on a timer, paint on an animation frame: one of each per paint. An
    // animation frame that turns out to be early still costs a whole style /
    // prepaint / commit pass, which on a 120 Hz panel was half of everything
    // this decoration ever asked for. The period still holds because `elapsed`
    // accumulates the deltas that really happened.
    timer = window.setTimeout(() => {
      timer = 0;
      frame = requestAnimationFrame(render);
    }, Math.max(0, frameInterval - displayFrame));
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    timer = 0;
    if (!canvas.isConnected) { stop(); return; }
    lastFrame = 0;
    // Re-learn the cadence: the window may have moved to another display, and a
    // loop that had throttled itself must get a chance to run at full rate.
    probing = true;
    probe = [];
    overrun = 0;
    resize();
    if (reduceMotion.matches || still) elapsed = PERIOD * STILL_PROGRESS;
    if (!document.hidden) render();
  };

  const themeObserver = new MutationObserver(() => {
    color = document.documentElement.dataset.theme === 'paper-dark' ? DARK : LIGHT;
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
    window.clearTimeout(timer);
    frame = 0;
    timer = 0;
    lastFrame = 0;
    if (!document.hidden) refresh();
  }, { signal });

  refresh();
};
