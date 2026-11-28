// @ts-nocheck
export {};
// Extracted from SiteHeader.astro. Bundled and cached by Astro/Vite.
//
// `alwave.ts` is the vendored spectrum engine (MIT, kmgcc/apple-like-waves); the
// packages are not on npm, so the algorithm ships with the site instead of
// arriving through a dependency. Load it only after an explicit play, without
// holding up the audio, so opening the island never has to download an FFT.
(() => {
    const island = document.getElementById('site-island');
    const toggle = document.getElementById('site-island-toggle');
    const audio = document.getElementById('site-island-audio');
    if (!(island instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement) || !(audio instanceof HTMLAudioElement) || island.dataset.bound === '1') return;
    island.dataset.bound = '1';
    const songId = island.dataset.songId || '';
    const songDuration = Number(island.dataset.songDuration || 0);
    const playbackApiBase = island.dataset.apiBase || '';
    const localSource = island.dataset.audioSrc || '';
    const lyricsSource = island.dataset.lyricsSrc || '';
    const songTitle = island.dataset.songTitle || '当前歌曲';

    const panelPlay = document.getElementById('island-player-toggle');
    const restart = document.getElementById('island-player-restart');
    const forward = document.getElementById('island-player-forward');
    const scrubber = document.getElementById('island-player-scrubber');
    const elapsed = document.getElementById('island-player-elapsed');
    const duration = document.getElementById('island-player-duration');
    const status = document.getElementById('island-player-status');
    const lyric = document.getElementById('island-player-lyric');
    const volumeControl = document.getElementById('island-volume-control');
    const volumeButton = document.getElementById('island-volume-button');
    const volumeMute = document.getElementById('island-volume-mute');
    const volumeSlider = document.getElementById('island-volume-slider');
    const volumeValue = document.getElementById('island-volume-value');
    const audioFallback = island.dataset.audioFallback || '';
    let closeTimer = 0;
    // Set while we programmatically move focus back to the pill, so the
    // island's own `focusin` handler does not immediately re-open it.
    let restoringFocus = false;
    let isResolving = false;
    let loadUiTimer = 0;
    let lyricsTask = null;
    let fallbackTried = false;
    let lyricTimeline = [];
    let lastLyricText = '';
    let audioContext = null;
    let analyser = null;
    let audioSourceNode = null;
    let outputGain = null;
    // The capsules come from raw PCM, not from the browser's own spectrum: the
    // vendored pipeline owns the window, the Hann FFT and the band layout.
    let visualizerSamples = null;
    let visualizerAnalyzer = null;
    let visualizerEngine = null;
    let visualizerTask = null;
    let visualizerFrame = 0;
    let visualizerLastTime = null;
    // Output loudness is owned by us, not by the media element. See
    // `applyOutputLevel` for why that matters to the visualiser.
    let userVolume = 0.72;
    let userMuted = false;
    // One analyser feeds every canvas. The compact pill and the expanded panel
    // draw the same six bands at two scales, so expanding never changes the
    // rhythm — and both canvases only ever report what the samples contain.
    const VISUALIZER_BANDS = 6;
    const visualizerSilence = new Array(VISUALIZER_BANDS).fill(0);
    // The last frame handed to the renderers, kept so a refit (the island
    // morphing, a DPR change) can repaint at the new geometry without either
    // blanking the row or asking the engine for another tick.
    let visualizerTargets = visualizerSilence;
    const visualizerViews = [...document.querySelectorAll('[data-audio-visualizer]')]
      .filter((element) => element instanceof HTMLCanvasElement)
      .map((canvas) => ({ canvas, renderer: null, fittedWidth: 0, fittedHeight: 0 }));
    let visualizerObserver = null;

    const setVolumeMenuOpen = (open) => {
      island.dataset.volumeOpen = open ? 'true' : 'false';
      if (volumeButton instanceof HTMLButtonElement) volumeButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const setOpen = (open) => {
      window.clearTimeout(closeTimer);
      island.dataset.open = open ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) setVolumeMenuOpen(false);
      else void loadLyrics().then(updateLyric);
    };

    /* ------------------------------------------------------------------
       Canvas visualiser.

       Two canvases (the pill's tail and the expanded panel) draw the same six
       bands through one analyser, so expanding never changes the rhythm. CSS
       owns both boxes; this only reads them. The capsules start as dots and
       collapse back into dots when playback stops, which is why there is still
       no idle silhouette: an unlit canvas is transparent.
       ----------------------------------------------------------------- */
    // `paused` alone is not enough: a stalled stream keeps the element
    // un-paused while no samples arrive, and `data-player-state` is the honest
    // "the media says it is playing" signal. Both must agree.
    const isVisualizerPlaying = () => island.dataset.playerState === 'playing' && !audio.paused && !audio.ended;

    // `--island-wave` is the artwork's accent, so the capsules follow the token
    // instead of hardcoding a theme colour. Read on change, never per frame.
    const syncVisualizerColor = () => {
      const wave = window.getComputedStyle(island).getPropertyValue('--island-wave').trim();
      if (!wave) return;
      visualizerViews.forEach((view) => {
        if (view.renderer) view.renderer.setColor(wave);
      });
    };

    // Six capsules must fit the box with air on both sides, and each one rests
    // as a dot exactly its own width tall — so the width is what the layout
    // budget is really about. The pitch splits the box; the capsule takes most
    // of it and the rest becomes the gap.
    const fitVisualizerView = (view) => {
      const renderer = view.renderer;
      if (!renderer) return;
      const width = view.canvas.clientWidth;
      const height = view.canvas.clientHeight;
      renderer.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      renderer.resize(width, height);
      view.fittedWidth = width;
      view.fittedHeight = height;
      if (width <= 0 || height <= 0) return;
      const pitch = width / VISUALIZER_BANDS;
      renderer.capsuleWidth = Math.min(height * 0.42, pitch * 0.62);
      renderer.capsuleSpacing = Math.max(0, pitch - renderer.capsuleWidth);
      renderer.maxHeightRatio = 0.92;
    };

    const prepareCanvasVisualizer = () => {
      if (!visualizerEngine) return;
      const { AlwaveCanvasRenderer, DEFAULT_TUNING_PROFILE } = visualizerEngine;
      visualizerViews.forEach((view) => {
        if (view.renderer) return;
        try {
          view.renderer = new AlwaveCanvasRenderer(view.canvas, {
            bandCount: VISUALIZER_BANDS,
            color: '#ffffff',
            capsuleWidth: 2,
            capsuleSpacing: 1.4,
            maxHeightRatio: 0.92,
            widthExpansion: DEFAULT_TUNING_PROFILE.spring.widthExpansion,
            springDuration: DEFAULT_TUNING_PROFILE.spring.duration,
            springDamping: DEFAULT_TUNING_PROFILE.spring.damping,
            pauseDuration: DEFAULT_TUNING_PROFILE.spring.pauseDuration,
            pauseDamping: DEFAULT_TUNING_PROFILE.spring.pauseDamping,
          });
          // A canvas that has never been lit must not draw its dots yet.
          view.renderer.setPlaying(false);
        } catch {
          view.renderer = null;
        }
        // A renderer is born sized from its own attributes, which are only the
        // fallback for the first frame; the CSS box is the truth.
        fitVisualizerView(view);
      });
      syncVisualizerColor();
      // The island morphs between 196x40 and 372x176 and the canvases ride
      // `cqw`, so follow the box rather than guessing its end size.
      if (!visualizerObserver && typeof ResizeObserver === 'function') {
        visualizerObserver = new ResizeObserver(() => {
          visualizerViews.forEach((view) => {
            if (view.canvas.clientWidth === view.fittedWidth && view.canvas.clientHeight === view.fittedHeight) return;
            fitVisualizerView(view);
            // Repaint at the new geometry with whatever the springs hold now.
            if (view.renderer) view.renderer.render(visualizerTargets, 0, isVisualizerPlaying());
          });
        });
        visualizerViews.forEach((view) => visualizerObserver.observe(view.canvas));
      }
    };

    // Snap both canvases shut without animating: used before the first play and
    // when the audio graph turns out to be unavailable.
    const resetAudioVisualizer = () => {
      visualizerLastTime = null;
      if (visualizerAnalyzer) visualizerAnalyzer.reset();
      visualizerViews.forEach((view) => {
        if (!view.renderer) return;
        view.renderer.setPlaying(false);
        view.renderer.reset();
        view.renderer.render(visualizerSilence, 0, false);
      });
      if (visualizerFrame) window.cancelAnimationFrame(visualizerFrame);
      visualizerFrame = 0;
    };

    /* ------------------------------------------------------------------
       Visualiser colour: take it from the album cover itself.

       The bars are drawn on pure black, so a colour sampled verbatim from the
       artwork is often too dark to see. Sample the cover once into a 24x24
       canvas, score every pixel for "would this read as a colour on black"
       (saturation, mid lightness), then re-anchor the winner's HSL to a vivid,
       mid-light value. One `--island-wave` custom property drives every bar, so
       this is the whole theming hook.

       Wrapped in try/catch on purpose: a tainted canvas (cross-origin artwork),
       a decode failure or a missing element must all degrade to the default
       white rather than break the player.
       ------------------------------------------------------------------ */
    const rgbToHsl = (r: number, g: number, b: number) => {
      const maximum = Math.max(r, g, b);
      const minimum = Math.min(r, g, b);
      const l = (maximum + minimum) / 2;
      if (maximum === minimum) return { h: 0, s: 0, l };
      const d = maximum - minimum;
      const s = l > 0.5 ? d / (2 - maximum - minimum) : d / (maximum + minimum);
      let h: number;
      if (maximum === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (maximum === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
      return { h, s, l };
    };

    const hslToRgb = (h: number, s: number, l: number) => {
      if (s === 0) {
        const v = Math.round(l * 255);
        return [v, v, v];
      }
      const hue2rgb = (p: number, q: number, t: number) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      return [
        Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        Math.round(hue2rgb(p, q, h) * 255),
        Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
      ];
    };

    const applyCoverAccent = async () => {
      const art = island.querySelector('.island-player-art');
      if (!(art instanceof HTMLImageElement)) return;
      try {
        if (!art.complete) {
          await new Promise<void>((resolve) => {
            art.addEventListener('load', () => resolve(), { once: true });
            art.addEventListener('error', () => resolve(), { once: true });
          });
        }
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(art, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        let bestHsl: { h: number; s: number; l: number } | null = null;
        let bestScore = 0;
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] < 200) continue;
          const hsl = rgbToHsl(data[index] / 255, data[index + 1] / 255, data[index + 2] / 255);
          // Ignore near-black, near-white and near-grey pixels: they carry no hue.
          if (hsl.l < 0.14 || hsl.l > 0.9 || hsl.s < 0.18) continue;
          const score = hsl.s * (1 - Math.abs(hsl.l - 0.55));
          if (score > bestScore) {
            bestScore = score;
            bestHsl = hsl;
          }
        }
        if (!bestHsl || bestScore < 0.08) return;
        // Re-anchor to a value that is legible on black but still recognisably
        // the artwork's hue: clamp saturation up, pin lightness to a mid tone.
        const s = Math.min(0.92, Math.max(0.55, bestHsl.s * 1.3));
        const l = Math.min(0.72, Math.max(0.56, bestHsl.l));
        const [r, g, b] = hslToRgb(bestHsl.h, s, l);
        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        island.style.setProperty('--island-wave', hex);
        island.dataset.accent = hex;
        // The capsules are painted by canvas, so the token change has to be
        // pushed into them; CSS alone cannot recolour a painted bitmap.
        syncVisualizerColor();
      } catch {
        // Tainted canvas / decode failure: keep the default white bars.
      }
    };

    const renderAudioVisualizer = (now) => {
      visualizerFrame = 0;
      // While the optional engine downloads, audio can already be playing.
      // Its completion starts the visualiser; do not spin a silent frame loop.
      if (!visualizerAnalyzer) return;
      const playing = isVisualizerPlaying();
      const previous = visualizerLastTime;
      visualizerLastTime = now;
      // One tick is the frame we actually got, clamped the way the springs
      // expect it: a tab restored after a minute must not integrate a minute.
      const delta = previous === null ? 1 / 60 : Math.max(0.001, Math.min(1 / 30, (now - previous) / 1000));

      let targets = visualizerSilence;
      if (playing && analyser && visualizerSamples && visualizerAnalyzer) {
        // The engine wants the raw waveform, not the browser's dB spectrum:
        // its own Hann window and log-spaced bands do the rest.
        analyser.getFloatTimeDomainData(visualizerSamples);
        visualizerAnalyzer.pushSamples(visualizerSamples);
        targets = visualizerAnalyzer.step(delta);
      }
      visualizerTargets = targets;

      let collapsing = false;
      visualizerViews.forEach((view) => {
        if (!view.renderer) return;
        view.renderer.render(targets, delta, playing);
        if (!playing && !view.renderer.settled) collapsing = true;
      });

      if (playing) {
        setVisualizerMode('live');
        visualizerFrame = window.requestAnimationFrame(renderAudioVisualizer);
        return;
      }
      // Paused, the capsules fall into their dots under the slower, critically
      // damped solver. Only once they have stopped is the row allowed to go
      // dark — a frozen row at the last energy would claim audio that is gone.
      if (collapsing) {
        visualizerFrame = window.requestAnimationFrame(renderAudioVisualizer);
        return;
      }
      setVisualizerMode('idle');
    };

    // Called on every transition out of playback. It does not cut the row: it
    // hands the collapse to the springs and lets them finish it.
    const stopAudioVisualizer = () => {
      if (!visualizerViews.some((view) => view.renderer)) return;
      if (!visualizerFrame) visualizerFrame = window.requestAnimationFrame(renderAudioVisualizer);
    };

    const loadAudioVisualizer = () => {
      if (!audioContext || !analyser) return;
      visualizerTask ??= import('./alwave').then((engine) => {
        visualizerEngine = engine;
        visualizerAnalyzer = new engine.SpectrumAnalyzer({
          bandCount: VISUALIZER_BANDS,
          sampleRate: audioContext.sampleRate,
          tuningProfile: engine.DEFAULT_TUNING_PROFILE,
        });
        prepareCanvasVisualizer();
        if (isVisualizerPlaying() && !visualizerFrame) {
          visualizerFrame = window.requestAnimationFrame(renderAudioVisualizer);
        }
      }).catch(() => {
        // A failed decorative chunk must never interrupt the song. A later
        // play may retry, while the ordinary transport stays fully usable.
        visualizerTask = null;
        resetAudioVisualizer();
        setVisualizerMode('off');
      });
    };

    const prepareAudioGraph = async () => {
      if (!analyser) {
        const AudioContextConstructor = window.AudioContext || window['webkitAudioContext'];
        if (!AudioContextConstructor) return;
        try {
          audioContext = new AudioContextConstructor();
          analyser = audioContext.createAnalyser();
          // 2048 samples is the engine's window too, so one frame of the graph
          // is exactly one FFT window and nothing is resampled on the way in.
          analyser.fftSize = 2048;
          // No smoothing at the browser's end: the engine has its own release
          // curve, and two smoothers in series would make the capsules lag.
          analyser.smoothingTimeConstant = 0;
          visualizerSamples = new Float32Array(analyser.fftSize);
          audioSourceNode = audioContext.createMediaElementSource(audio);
          audioSourceNode.connect(analyser);
          // analyser -> gain -> speakers. The analyser therefore sees the
          // unattenuated track, so the capsules keep moving when the user turns
          // the volume down or mutes.
          outputGain = audioContext.createGain();
          analyser.connect(outputGain);
          outputGain.connect(audioContext.destination);
          applyOutputLevel();
        } catch (_) {
          audioContext = null;
          analyser = null;
          audioSourceNode = null;
          visualizerSamples = null;
          visualizerAnalyzer = null;
          return;
        }
      }
      if (audioContext?.state === 'suspended') await audioContext.resume();
    };

    const formatTime = (value) => {
      const seconds = Math.max(0, Math.floor(Number(value) || 0));
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    const formatDuration = (value) => {
      const seconds = Math.max(0, Math.round(Number(value) || 0));
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };

    // The island's own lyric line is the only place lyrics are shown: the
    // homepage card used to mirror them through `[data-live-lyric]` and a
    // `b0-player-lyric` event, both of which were removed with that copy.
    const publishLyric = (text) => {
      if (!text || text === lastLyricText) return;
      lastLyricText = text;
      if (lyric) lyric.textContent = text;
    };

    const updateLyric = () => {
      if (!lyricTimeline.length) return;
      const current = audio.currentTime || 0;
      let next = current < lyricTimeline[0].time ? '前奏里，故事正准备开始。' : lyricTimeline[0].text;
      for (let index = lyricTimeline.length - 1; index >= 0; index -= 1) {
        if (current >= lyricTimeline[index].time) {
          next = lyricTimeline[index].text;
          break;
        }
      }
      publishLyric(next);
    };

    const updateProgress = () => {
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : songDuration;
      const current = Math.min(total, audio.currentTime || 0);
      const progress = total > 0 ? `${(current / total) * 100}%` : '0%';
      if (scrubber instanceof HTMLInputElement) {
        scrubber.max = String(total);
        scrubber.value = String(current);
        scrubber.style.setProperty('--player-progress', progress);
      }
      if (elapsed) elapsed.textContent = formatTime(current);
      if (duration) duration.textContent = `−${formatDuration(Math.max(0, total - current))}`;
      updateLyric();
    };

    // Only the analyser loop can mark the waveform live. Loading and buffering
    // must not claim playback before the media's `playing` event.
    const setVisualizerMode = (mode) => {
      if (island.dataset.visualizer === mode) return;
      island.dataset.visualizer = mode;
    };

    const setPlayerState = (state, message) => {
      island.dataset.playerState = state;
      if (status) status.textContent = message;
      const playing = state === 'playing';
      const active = playing || (state === 'loading' && !audio.paused);
      island.dataset.playbackActive = String(active);
      const label = `${active ? '暂停' : '播放'} ${songTitle}`;
      if (panelPlay instanceof HTMLButtonElement) panelPlay.setAttribute('aria-label', label);
      if (!playing) setVisualizerMode(state === 'unavailable' ? 'off' : 'idle');
    };

    // Volume lives on a GainNode *after* the analyser, not on the media element.
    //
    // On a phone the waveform shows the track, not your speaker volume: muting
    // does not stop the bars. With `audio.volume` / `audio.muted` the element's
    // own attenuation is applied to what the MediaElementAudioSourceNode emits,
    // so muting fed the analyser digital silence and the bars went flat. Keeping
    // the element at unity and attenuating downstream means the analyser always
    // sees the full signal, and the silence happens where it belongs — after the
    // tap. `audio.volume` is only used as the fallback when the Web Audio graph
    // could not be built (no AudioContext), where there is no node to attenuate.
    const applyOutputLevel = () => {
      const level = userMuted ? 0 : userVolume;
      if (outputGain) {
        outputGain.gain.value = level;
        audio.volume = 1;
        audio.muted = false;
        return;
      }
      audio.volume = userVolume;
      audio.muted = userMuted;
    };

    const syncVolumeUI = () => {
      const level = userMuted ? 0 : userVolume;
      const percent = Math.round(level * 100);
      island.dataset.muted = level <= 0 ? 'true' : 'false';
      if (volumeSlider instanceof HTMLInputElement) {
        volumeSlider.value = String(level);
        volumeSlider.style.setProperty('--volume-progress', `${percent}%`);
      }
      if (volumeValue instanceof HTMLOutputElement) volumeValue.textContent = `${percent}%`;
      if (volumeMute instanceof HTMLButtonElement) volumeMute.setAttribute('aria-label', level <= 0 ? '取消静音' : '静音');
      if (volumeButton instanceof HTMLButtonElement) volumeButton.setAttribute('aria-label', `调整音量，当前 ${percent}%`);
    };

    try {
      // `localStorage.getItem` returns null when unset, and `Number(null)` is 0 —
      // which is finite and inside [0, 1], so the old guard let it through and
      // EVERY first-time visitor started at volume 0: the track "played", the
      // element volume was 0, the AnalyserNode only ever saw digital silence, and
      // the visualiser stayed flat forever. Reject null/'' explicitly before
      // coercing.
      const rawVolume = localStorage.getItem('b0-player-volume');
      const storedVolume = rawVolume === null || rawVolume.trim() === '' ? Number.NaN : Number(rawVolume);
      userVolume = Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1 ? storedVolume : 0.72;
      userMuted = localStorage.getItem('b0-player-muted') === 'true';
    } catch (_) {
      userVolume = 0.72;
      userMuted = false;
    }
    applyOutputLevel();

    const loadLyrics = () => {
      if (!lyricsSource) return Promise.resolve();
      if (lyricsTask) return lyricsTask;
      lyricsTask = (async () => {
        try {
          const response = await fetch(lyricsSource, { credentials: 'same-origin' });
          if (!response.ok) throw new Error(`lyrics-${response.status}`);
          const source = await response.text();
          lyricTimeline = source.split(/\r?\n/).flatMap((line) => {
            const text = line.replace(/\[[^\]]+\]/g, '').trim();
            if (!text) return [];
            return [...line.matchAll(/\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g)].map((match) => ({
              time: Number(match[1]) * 60 + Number(match[2]),
              text,
            }));
          }).sort((a, b) => a.time - b.time);
        } catch (_) { lyricsTask = null; }
      })();
      return lyricsTask;
    };

    // Native streaming starts as soon as enough audio has arrived. Do not fetch
    // a second copy or turn the entire song into a Blob before pressing play.
    const setLoadingState = (state) => {
      window.clearTimeout(loadUiTimer);
      island.setAttribute('aria-busy', String(state !== 'idle'));
      if (state === 'idle') {
        island.dataset.loading = 'idle';
        return;
      }
      // Delay feedback only. A warm cache should never flash a loader, and
      // playback is never held back to give the animation time on screen.
      if (island.dataset.loading !== 'idle') return;
      loadUiTimer = window.setTimeout(() => {
        if (island.dataset.playerState !== 'loading') return;
        island.dataset.loading = 'indeterminate';
      }, 180);
    };

    const loadLocalMedia = (url) => {
      audio.src = url;
      audio.dataset.sourceReady = 'true';
      audio.load();
      return audio.src;
    };

    const resolveSource = async () => {
      if (audio.dataset.sourceReady === 'true' && audio.src) return audio.src;
      if (localSource) return loadLocalMedia(localSource);
      if (!playbackApiBase) throw new Error('missing-source');
      const response = await fetch(`${playbackApiBase}/song/url/v1?id=${encodeURIComponent(songId)}&level=standard`, {
        credentials: 'omit',
        mode: 'cors',
      });
      if (!response.ok) throw new Error(`api-${response.status}`);
      const payload = await response.json();
      const source = payload?.data?.[0]?.url;
      if (typeof source !== 'string' || !/^https?:\/\//.test(source)) throw new Error('missing-stream-url');
      audio.crossOrigin = 'anonymous';
      audio.src = source;
      audio.dataset.sourceReady = 'true';
      audio.referrerPolicy = 'no-referrer';
      audio.load();
      return source;
    };

    const play = async () => {
      if (isResolving) return;
      isResolving = true;
      setLoadingState('indeterminate');
      setPlayerState('loading', '正在载入');
      try {
        await prepareAudioGraph();
        await resolveSource();
        if (scrubber instanceof HTMLInputElement) scrubber.disabled = false;
        await audio.play();
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setLoadingState('idle');
        audio.dataset.sourceReady = 'false';
        setOpen(true);
        setPlayerState('unavailable', navigator.onLine ? '音频不可用，点击重试' : '网络已断开，联网后重试');
      } finally {
        isResolving = false;
      }
    };

    const togglePlayback = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (audio.paused) void play();
      else audio.pause();
    };

    toggle.addEventListener('click', () => {
      setOpen(true);
    });
    panelPlay?.addEventListener('click', togglePlayback);
    restart?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      audio.currentTime = 0;
      updateProgress();
      if (audio.paused) void play();
    });
    forward?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : songDuration;
      audio.currentTime = Math.min(total, (audio.currentTime || 0) + 10);
      updateProgress();
    });
    volumeButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setVolumeMenuOpen(island.dataset.volumeOpen !== 'true');
    });
    volumeMute?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      userMuted = !userMuted;
      applyOutputLevel();
      try { localStorage.setItem('b0-player-muted', String(userMuted)); } catch (_) {}
      syncVolumeUI();
    });
    volumeSlider?.addEventListener('input', () => {
      if (!(volumeSlider instanceof HTMLInputElement)) return;
      userVolume = Math.min(1, Math.max(0, Number(volumeSlider.value)));
      userMuted = false;
      applyOutputLevel();
      try {
        localStorage.setItem('b0-player-volume', String(userVolume));
        localStorage.setItem('b0-player-muted', 'false');
      } catch (_) {}
      syncVolumeUI();
    });
    scrubber?.addEventListener('input', () => {
      if (!(scrubber instanceof HTMLInputElement) || audio.dataset.sourceReady !== 'true') return;
      audio.currentTime = Number(scrubber.value);
      updateProgress();
    });
    if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
      const openFromPointer = () => setOpen(true);
      const closeFromPointer = (event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && island.contains(nextTarget)) return;
        closeTimer = window.setTimeout(() => setOpen(false), 420);
      };
      island.addEventListener('pointerenter', openFromPointer);
      island.addEventListener('pointermove', openFromPointer, { passive: true });
      island.addEventListener('pointerleave', closeFromPointer);
    }
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const playerAction = target?.closest('[data-site-player-action]');
      if (playerAction) {
        togglePlayback(event);
        return;
      }
      if (target && volumeControl && !volumeControl.contains(target)) setVolumeMenuOpen(false);
      if (target && !island.contains(target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (island.dataset.volumeOpen === 'true') {
        setVolumeMenuOpen(false);
        if (volumeButton instanceof HTMLButtonElement) volumeButton.focus({ preventScroll: true });
        return;
      }
      if (island.dataset.open !== 'true') return;
      // Escape returns focus to the pill. `focusin` opens the island, so the
      // guard has to be set before focus moves and cleared after the current
      // focus event has been dispatched.
      restoringFocus = true;
      toggle.focus({ preventScroll: true });
      setOpen(false);
      window.setTimeout(() => { restoringFocus = false; }, 0);
    });
    island.addEventListener('focusin', () => {
      if (restoringFocus) return;
      setOpen(true);
    });
    island.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !island.contains(event.relatedTarget)) setOpen(false);
    });
    audio.addEventListener('loadedmetadata', () => {
      if (scrubber instanceof HTMLInputElement) scrubber.disabled = false;
      updateProgress();
    });
    audio.addEventListener('canplay', () => {
      if (scrubber instanceof HTMLInputElement) scrubber.disabled = false;
    });
    audio.addEventListener('stalled', () => {
      if (island.dataset.playerState === 'loading' && status) status.textContent = '网络较慢，正在缓冲';
    });
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('playing', () => {
      setLoadingState('idle');
      setPlayerState('playing', '正在播放');
      loadAudioVisualizer();
      updateLyric();
      if (!visualizerFrame) visualizerFrame = window.requestAnimationFrame(renderAudioVisualizer);
    });
    audio.addEventListener('waiting', () => {
      stopAudioVisualizer();
      if (!audio.paused) {
        setPlayerState('loading', '正在缓冲');
        setLoadingState('indeterminate');
      }
    });
    audio.addEventListener('pause', () => {
      setLoadingState('idle');
      stopAudioVisualizer();
      // A failed media request can enqueue pause after error. Preserve the
      // retryable error instead of replacing it with a misleading "paused".
      if (audio.paused && !audio.ended && !audio.error
        && island.dataset.playerState !== 'unavailable') setPlayerState('paused', '已暂停');
    });
    audio.addEventListener('ended', () => {
      setLoadingState('idle');
      stopAudioVisualizer();
      audio.currentTime = 0;
      updateProgress();
      setPlayerState('ready', '播放结束');
    });
    audio.addEventListener('error', () => {
      stopAudioVisualizer();
      setLoadingState('idle');
      // Only decoder failures get an alternative. Network failures must never
      // silently start the much larger lossless copy on a struggling link.
      // MEDIA_ERR_SRC_NOT_SUPPORTED (4) can also mean a failed HTTP request,
      // so only a confirmed decoding failure (3) may choose another format.
      if (!fallbackTried && audioFallback && audio.error?.code === 3) {
        fallbackTried = true;
        setPlayerState('loading', '正在切换音源');
        setLoadingState('indeterminate');
        loadLocalMedia(audioFallback);
        void audio.play().catch(() => {
          setLoadingState('idle');
          setPlayerState('unavailable', '音频加载失败');
        });
        return;
      }
      audio.dataset.sourceReady = 'false';
      setPlayerState('unavailable', '音频加载失败');
    });
    audio.addEventListener('volumechange', syncVolumeUI);

    const refreshForPage = () => {
      updateProgress();
      syncVolumeUI();
    };

    document.addEventListener('astro:before-preparation', () => setOpen(false));
    document.addEventListener('astro:page-load', refreshForPage);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshForPage, { once: true });
    else refreshForPage();

    // Opening loads lyrics; only an explicit play requests the audio.
    void applyCoverAccent();
    updateProgress();
    syncVolumeUI();
    // Nothing paints until the analyser exists, so the row starts dark rather
    // than showing a resting silhouette that claims audio.
    resetAudioVisualizer();
    setPlayerState(localSource || playbackApiBase ? 'ready' : 'unavailable', localSource ? '本地音频' : (playbackApiBase ? 'API 音源' : '无播放源'));
  })();

