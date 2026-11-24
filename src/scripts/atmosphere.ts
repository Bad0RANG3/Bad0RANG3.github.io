import keyframes from '../data/atmosphere-keyframes.json';

// Reproduce the 640 × 480 SVG background embedded in https://synthion.space/.
// Its 87 circles share a five-second timeline, with linear interpolation of
// position, radius and opacity. The supplied keyframes encode the outward
// acceleration; do not replace them with a constant-speed particle emitter.
//
// The loop is intentionally uncapped: one paint per native animation frame, so
// a 144 Hz or 240 Hz panel plays the motion at the cadence it was authored for
// instead of a stepped-down approximation. `elapsed` accumulates the real
// frame deltas, which is what keeps the five-second period wall-clock exact —
// the field moves the same distance per second at 24 Hz and at 240 Hz.
//
// "No ceiling" is not the same as "no budget". Nothing here is requested from
// a timer and no extra frame is ever scheduled for a paint that already
// happened, so the loop costs exactly the frames the display was going to run.
// The rest of the file keeps the cheap parts cheap: the backdrop buffer is
// capped at 1 device pixel per CSS pixel, keyframes are column-major typed
// arrays sampled without allocation, and devices that declare themselves small
// get a still frame instead of a loop.
const PERIOD = 5000;
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
  const controller = new AbortController();
  const { signal } = controller;
  let width = 0;
  let height = 0;
  let scaleX = 1;
  let scaleY = 1;
  let frame = 0;
  let resizeFrame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let color = document.documentElement.dataset.theme === 'paper-dark' ? DARK : LIGHT;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    // The buffer stays at one pixel per CSS pixel. This layer is an 11% alpha
    // haze; a HiDPI backing store would only add fill cost and a texture upload
    // per frame for detail nobody can see.
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(1, 0, 0, 1, 0, 0);
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
    cancelAnimationFrame(resizeFrame);
    themeObserver.disconnect();
    controller.abort();
  };

  const render = (now = performance.now()) => {
    frame = 0;
    if (!canvas.isConnected) { stop(); return; }
    const motion = !reduceMotion.matches && !still;
    // Advance the timeline by what actually elapsed, then ask for the next
    // native frame. A tab that was hidden or a device that stalled simply
    // resumes at the right point in the loop instead of jumping ahead.
    if (lastFrame && motion) elapsed += now - lastFrame;
    lastFrame = now;
    paint();
    if (motion) frame = requestAnimationFrame(render);
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    if (!canvas.isConnected) { stop(); return; }
    lastFrame = 0;
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
    frame = 0;
    lastFrame = 0;
    if (!document.hidden) refresh();
  }, { signal });

  refresh();
};
