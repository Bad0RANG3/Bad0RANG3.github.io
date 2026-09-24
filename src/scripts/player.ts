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
    let isResolving = false;
    let lyricTimeline = [];
    let lastLyricText = '';
    let audioContext = null;
    let analyser = null;
    let audioSourceNode = null;
    let visualizerData = null;
    let visualizerFrame = 0;
    let visualizerAutoGain = 1;
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
          analyser.connect(audioContext.destination);
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

    const setPlayerState = (state, message) => {
      island.dataset.playerState = state;
      if (status) status.textContent = message;
      const playing = state === 'playing';
      const label = `${playing ? '暂停' : '播放'} ${songTitle}`;
      if (panelPlay instanceof HTMLButtonElement) panelPlay.setAttribute('aria-label', label);
    };

    const syncVolumeUI = () => {
      const level = audio.muted ? 0 : audio.volume;
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
      const storedVolume = Number(localStorage.getItem('b0-player-volume'));
      if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1) audio.volume = storedVolume;
      else audio.volume = 0.72;
      audio.muted = localStorage.getItem('b0-player-muted') === 'true';
    } catch (_) {
      audio.volume = 0.72;
    }

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
      audio.muted = !audio.muted;
      try { localStorage.setItem('b0-player-muted', String(audio.muted)); } catch (_) {}
      syncVolumeUI();
    });
    volumeSlider?.addEventListener('input', () => {
      if (!(volumeSlider instanceof HTMLInputElement)) return;
      audio.volume = Math.min(1, Math.max(0, Number(volumeSlider.value)));
      audio.muted = false;
      try {
        localStorage.setItem('b0-player-volume', String(audio.volume));
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
      if (event.key === 'Escape') {
        if (island.dataset.volumeOpen === 'true') {
          setVolumeMenuOpen(false);
          if (volumeButton instanceof HTMLButtonElement) volumeButton.focus({ preventScroll: true });
          return;
        }
        toggle.focus({ preventScroll: true });
        setOpen(false);
      }
    });
    island.addEventListener('focusin', () => setOpen(true));
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
    updateProgress();
    syncVolumeUI();
    setVisualizerBaseline();
    setPlayerState(localSource || playbackApiBase ? 'ready' : 'unavailable', localSource ? '本地音频' : (playbackApiBase ? 'API 音源' : '无播放源'));
  })();

