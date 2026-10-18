// @ts-nocheck
export {};
// Extracted from SiteHeader.astro. Bundled and cached by Astro/Vite.
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
    const cueLabel = document.getElementById('island-section-label');
    const volumeControl = document.getElementById('island-volume-control');
    const volumeButton = document.getElementById('island-volume-button');
    const volumeMute = document.getElementById('island-volume-mute');
    const volumeSlider = document.getElementById('island-volume-slider');
    const volumeValue = document.getElementById('island-volume-value');
    let closeTimer = 0;
    let cueTimer = 0;
    let cueCleanup = () => {};
    // Set while we programmatically move focus back to the pill, so the
    // island's own `focusin` handler does not immediately re-open it.
    let restoringFocus = false;
    let isResolving = false;
    let lyricTimeline = [];
    let lastLyricText = '';
    let audioContext = null;
    let analyser = null;
    let audioSourceNode = null;
    let outputGain = null;
    let visualizerData = null;
    let visualizerFrame = 0;
    let visualizerAutoGain = 1;
    // Output loudness is owned by us, not by the media element. See
    // `applyOutputLevel` for why that matters to the visualiser.
    let userVolume = 0.72;
    let userMuted = false;
    const visualizerBandEdges = [55, 180, 400, 900, 2200, 6000, 16000];
    const visualizerBandGains = [0.9, 0.96, 1.04, 1.14, 1.3, 1.48];
    const visualizerGroups = [...document.querySelectorAll('[data-audio-visualizer]')]
      .map((element) => ({
        element,
        expanded: element instanceof HTMLElement && element.dataset.audioVisualizer === 'expanded',
        bars: [...element.querySelectorAll('i')],
        levels: Array.from({ length: element.querySelectorAll('i').length }, () => 4),
      }))
      .filter((group) => group.bars.length > 0);
    const visualizerBars = visualizerGroups.flatMap((group) => group.bars);

    const setVolumeMenuOpen = (open) => {
      island.dataset.volumeOpen = open ? 'true' : 'false';
      if (volumeButton instanceof HTMLButtonElement) volumeButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const setOpen = (open) => {
      window.clearTimeout(closeTimer);
      island.dataset.open = open ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        window.clearTimeout(cueTimer);
        island.dataset.cueActive = 'false';
      }
      if (!open) setVolumeMenuOpen(false);
    };

    const setVisualizerBaseline = () => {
      visualizerAutoGain = 1;
      visualizerGroups.forEach((group) => {
        group.levels.fill(4);
        group.bars.forEach((bar) => {
          if (!(bar instanceof HTMLElement)) return;
          bar.style.setProperty('--visualizer-height', '4px');
          bar.style.setProperty('--visualizer-opacity', '0.44');
        });
      });
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
      } catch {
        // Tainted canvas / decode failure: keep the default white bars.
      }
    };

    const renderAudioVisualizer = () => {
      visualizerFrame = 0;
      if (!analyser || !visualizerData || audio.paused || !visualizerBars.length) {
        setVisualizerBaseline();
        return;
      }

      analyser.getByteFrequencyData(visualizerData);
      const binWidth = (audioContext?.sampleRate || 48000) / analyser.fftSize;
      const bandEnergies = visualizerBandGains.map((gain, index) => {
        const start = Math.max(1, Math.floor(visualizerBandEdges[index] / binWidth));
        const end = Math.min(
          visualizerData.length,
          Math.max(start + 1, Math.ceil(visualizerBandEdges[index + 1] / binWidth)),
        );
        let squareTotal = 0;
        let samples = 0;
        for (let cursor = start; cursor < end; cursor += 1) {
          const amplitude = visualizerData[cursor] / 255;
          squareTotal += amplitude * amplitude;
          samples += 1;
        }
        return (samples ? Math.sqrt(squareTotal / samples) : 0) * gain;
      });

      // Keep quiet masters lively without flattening the difference between bands.
      const loudestBand = Math.max(0.01, ...bandEnergies);
      const targetGain = Math.min(2.35, Math.max(0.82, 0.72 / loudestBand));
      visualizerAutoGain += (targetGain - visualizerAutoGain) * (targetGain < visualizerAutoGain ? 0.09 : 0.025);

      visualizerGroups.forEach((group) => {
        group.bars.forEach((bar, index) => {
          if (!(bar instanceof HTMLElement)) return;
          const energy = Math.max(0, (bandEnergies[index] || 0) * visualizerAutoGain - 0.035);
          const intensity = Math.min(1, Math.pow(energy / 0.72, 0.7));
          const maximum = group.expanded
            ? Math.max(24, (group.element instanceof HTMLElement ? group.element.clientHeight : 44) * 0.82)
            : 20;
          const targetHeight = 4 + intensity * (maximum - 4);
          const previousHeight = group.levels[index] || 4;
          const response = targetHeight > previousHeight ? 0.48 : 0.2;
          const height = previousHeight + (targetHeight - previousHeight) * response;
          group.levels[index] = height;
          bar.style.setProperty('--visualizer-height', `${height.toFixed(2)}px`);
          bar.style.setProperty('--visualizer-opacity', String(0.42 + intensity * 0.58));
        });
      });
      visualizerFrame = window.requestAnimationFrame(renderAudioVisualizer);
    };

    const stopAudioVisualizer = () => {
      if (visualizerFrame) window.cancelAnimationFrame(visualizerFrame);
      visualizerFrame = 0;
      setVisualizerBaseline();
    };

    const prepareAudioGraph = async () => {
      if (!analyser) {
        const AudioContextConstructor = window.AudioContext || window['webkitAudioContext'];
        if (!AudioContextConstructor) return;
        try {
          audioContext = new AudioContextConstructor();
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          analyser.minDecibels = -78;
          analyser.maxDecibels = -18;
          analyser.smoothingTimeConstant = 0.68;
          visualizerData = new Uint8Array(analyser.frequencyBinCount);
          audioSourceNode = audioContext.createMediaElementSource(audio);
          audioSourceNode.connect(analyser);
          // analyser -> gain -> speakers. The analyser therefore sees the
          // unattenuated track, so the bars keep moving when the user turns the
          // volume down or mutes.
          outputGain = audioContext.createGain();
          analyser.connect(outputGain);
          outputGain.connect(audioContext.destination);
          applyOutputLevel();
        } catch (_) {
          audioContext = null;
          analyser = null;
          audioSourceNode = null;
          visualizerData = null;
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

    const publishLyric = (text) => {
      if (!text) return;
      const changed = text !== lastLyricText;
      lastLyricText = text;
      if (lyric) lyric.textContent = text;
      document.querySelectorAll('[data-live-lyric]').forEach((node) => {
        node.textContent = text;
      });
      if (changed) document.dispatchEvent(new CustomEvent('b0-player-lyric', { detail: { text } }));
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
      document.querySelectorAll('[data-live-elapsed]').forEach((node) => { node.textContent = formatTime(current); });
      document.querySelectorAll('[data-live-duration]').forEach((node) => { node.textContent = formatTime(total); });
      document.querySelectorAll('[data-live-progress]').forEach((node) => {
        if (node instanceof HTMLElement) node.style.setProperty('--live-progress', progress);
      });
      updateLyric();
    };

    // The island's visualiser is a claim about what you can hear, so the CSS
    // is told which of three honest states it is in:
    //   live  frames from the analyser (set by the rAF loop itself)
    //   idle  a source exists but nothing is playing -> static rest bars
    //   off   no playable source at all -> flat dashes
    // Only `live` animates. `idle` used to breathe on a 3.6s loop, which read as
    // "audio is playing" when it was not; the bars now hold still until the
    // analyser actually has frames.
    const setVisualizerMode = (mode) => {
      if (island.dataset.visualizer === mode) return;
      island.dataset.visualizer = mode;
    };

    const setPlayerState = (state, message) => {
      island.dataset.playerState = state;
      if (status) status.textContent = message;
      const playing = state === 'playing';
      const label = `${playing ? '暂停' : '播放'} ${songTitle}`;
      if (panelPlay instanceof HTMLButtonElement) panelPlay.setAttribute('aria-label', label);
      setVisualizerMode(playing ? 'live' : (state === 'unavailable' ? 'off' : 'idle'));
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

    const loadLyrics = async () => {
      if (!lyricsSource) return;
      try {
        const response = await fetch(lyricsSource, { credentials: 'same-origin' });
        if (!response.ok) return;
        const source = await response.text();
        lyricTimeline = source.split(/\r?\n/).flatMap((line) => {
          const text = line.replace(/\[[^\]]+\]/g, '').trim();
          if (!text) return [];
          return [...line.matchAll(/\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g)].map((match) => ({
            time: Number(match[1]) * 60 + Number(match[2]),
            text,
          }));
        }).sort((a, b) => a.time - b.time);
      } catch (_) {}
    };

    const resolveSource = async () => {
      if (audio.dataset.sourceReady === 'true' && audio.src) return audio.src;
      if (localSource) {
        audio.src = localSource;
        audio.dataset.sourceReady = 'true';
        audio.load();
        return audio.src;
      }
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
      setPlayerState('loading', '正在载入');
      try {
        await prepareAudioGraph();
        await resolveSource();
        if (scrubber instanceof HTMLInputElement) scrubber.disabled = false;
        await audio.play();
      } catch (_) {
        setOpen(true);
        setPlayerState('unavailable', '音频不可用');
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
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('play', () => {
      setPlayerState('playing', '正在播放');
      updateLyric();
      if (!visualizerFrame) visualizerFrame = window.requestAnimationFrame(renderAudioVisualizer);
    });
    audio.addEventListener('pause', () => {
      stopAudioVisualizer();
      if (!audio.ended) setPlayerState('paused', '已暂停');
    });
    audio.addEventListener('ended', () => {
      stopAudioVisualizer();
      audio.currentTime = 0;
      updateProgress();
      setPlayerState('ready', '播放结束');
    });
    audio.addEventListener('error', () => setPlayerState('unavailable', '音频加载失败'));
    audio.addEventListener('volumechange', syncVolumeUI);

    const pulseSection = (label) => {
      if (!label || island.dataset.open === 'true') return;
      if (cueLabel) cueLabel.textContent = label;
      window.clearTimeout(cueTimer);
      island.dataset.cueActive = 'true';
      cueTimer = window.setTimeout(() => { island.dataset.cueActive = 'false'; }, 1500);
    };

    const bindSectionCues = () => {
      cueCleanup();
      cueCleanup = () => {};
      const cueSections = [...document.querySelectorAll('[data-island-cue]')];
      if (!cueSections.length) return;
      let currentSection = '';
      let frame = 0;
      const syncSection = () => {
        frame = 0;
        const marker = window.innerHeight * 0.42;
        let active = cueSections[0];
        cueSections.forEach((section) => {
          if (section.getBoundingClientRect().top <= marker) active = section;
        });
        const label = active instanceof HTMLElement ? active.dataset.islandCue || '' : '';
        if (!label || label === currentSection) return;
        currentSection = label;
        pulseSection(label);
      };
      const scheduleSync = () => {
        if (!frame) frame = requestAnimationFrame(syncSection);
      };
      window.addEventListener('scroll', scheduleSync, { passive: true });
      window.addEventListener('resize', scheduleSync, { passive: true });
      cueCleanup = () => {
        window.removeEventListener('scroll', scheduleSync);
        window.removeEventListener('resize', scheduleSync);
        if (frame) cancelAnimationFrame(frame);
      };
      syncSection();
    };

    const refreshForPage = () => {
      bindSectionCues();
      updateProgress();
      syncVolumeUI();
    };

    document.addEventListener('astro:before-preparation', () => setOpen(false));
    document.addEventListener('astro:page-load', refreshForPage);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshForPage, { once: true });
    else refreshForPage();

    void loadLyrics().then(() => updateLyric());
    void applyCoverAccent();
    updateProgress();
    syncVolumeUI();
    setVisualizerBaseline();
    setPlayerState(localSource || playbackApiBase ? 'ready' : 'unavailable', localSource ? '本地音频' : (playbackApiBase ? 'API 音源' : '无播放源'));
  })();

