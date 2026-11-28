/* -----------------------------------------------------------------
   alwave — vendored spectrum visualiser.

   Source: https://github.com/kmgcc/apple-like-waves (@alwave/core +
   @alwave/canvas, MIT). The packages are not published to npm, so the
   algorithm lives here verbatim rather than behind a dependency: a
   2048-point Hann-windowed real FFT, logarithmic octave binning with
   per-band calibration, the reference-envelope attack chain, and the
   second-order damped spring that turns band energies into capsule
   heights. Only the Web Audio bridge is omitted — `player.ts` already
   owns an AnalyserNode and hands us the time-domain samples.

   Numbers are not tuned here. Swift and Web agree to <1e-5, and the
   tuning profile is the whole of the behaviour, so anything edited
   below is a fork, not a port.
   ----------------------------------------------------------------- */

export interface SpringTuning {
  duration: number;
  damping: number;
  widthExpansion: number;
  pauseDuration: number;
  pauseDamping: number;
}

export interface TuningProfile {
  version: string;
  baseEdges: number[];
  gains: number[];
  exponents: number[];
  punch: number[];
  referenceKernel: number[];
  punchBase: number;
  gateLow: number;
  slowTau: number;
  deadbandLow: number;
  deadbandHigh: number;
  multiBandLowEdge: number;
  windowCalibration: number[];
  subBandTrim: number;
  spring: SpringTuning;
}

export const DEFAULT_TUNING_PROFILE: TuningProfile = {
  version: '1.0.0',
  baseEdges: [20.0, 81.0, 170.0, 527.0, 1500.0, 4500.0, 10000.0],
  gains: [0.706, 0.706, 0.433, 0.433, 0.339, 0.3],
  exponents: [1.15, 0.85, 0.75, 0.85, 0.7, 0.75],
  punch: [3.45, 2.07, 3.45, 11.5, 1.38, 1.38],
  referenceKernel: [0.5, 0.3, 0.2],
  punchBase: 1.05,
  gateLow: 0.35,
  slowTau: 0.8,
  deadbandLow: 0.01,
  deadbandHigh: 0.06,
  multiBandLowEdge: 40.0,
  windowCalibration: [1.828, 1.765, 1.324, 1.351, 1.369, 1.424],
  subBandTrim: 0.85,
  spring: {
    duration: 0.325,
    damping: 0.83,
    widthExpansion: 0.145,
    pauseDuration: 0.6,
    pauseDamping: 1.0,
  },
};

/* ----------------------------------------------------------------- */

export class BandLayout {
  public readonly edges: number[];
  public readonly parent: number[];
  public readonly binWidth: number;

  public static readonly defaultBaseEdges: readonly number[] = [
    20.0, 81.0, 170.0, 527.0, 1500.0, 4500.0, 10000.0,
  ];

  constructor(edges: number[], parent?: number[], binWidth = 0) {
    this.edges = edges;
    this.parent = parent ?? Array.from({ length: Math.max(0, edges.length - 1) }, (_, i) => i);
    this.binWidth = binWidth;
  }

  public get count(): number {
    return Math.max(0, this.edges.length - 1);
  }

  public get centres(): number[] {
    const res: number[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      res[i] = Math.sqrt(this.edges[i] * this.edges[i + 1]);
    }
    return res;
  }

  public get widths(): number[] {
    const res: number[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      res[i] = this.edges[i + 1] - this.edges[i];
    }
    return res;
  }

  public get octaves(): number[] {
    const res: number[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      res[i] = Math.log2(this.edges[i + 1] / this.edges[i]);
    }
    return res;
  }

  public get densityScale(): number[] {
    const res: number[] = new Array(this.count);
    const defaultBase = BandLayout.defaultBaseEdges;
    for (let i = 0; i < this.count; i++) {
      const p = Math.min(Math.max(this.parent[i], 0), 5);
      if (this.binWidth <= 0) {
        const pw = defaultBase[p + 1] - defaultBase[p];
        res[i] = pw / this.widths[i];
      } else {
        const selfBins = this.binCount(this.edges[i], this.edges[i + 1]);
        const parentLo = p === 0 ? this.edges[0] : defaultBase[p];
        const parentBins = this.binCount(parentLo, defaultBase[p + 1]);
        res[i] = parentBins / selfBins;
      }
    }
    return res;
  }

  public binCount(lo: number, hi: number): number {
    if (this.binWidth <= 0) return 1.0;
    const first = Math.ceil(lo / this.binWidth);
    const last = Math.ceil(hi / this.binWidth);
    return Math.max(1.0, last - first);
  }

  public static smoothCal(
    v: readonly number[],
    f: number,
    baseEdges: readonly number[] = BandLayout.defaultBaseEdges
  ): number {
    if (v.length < 6) return v[0] ?? 0;
    const anchors: number[] = new Array(6);
    for (let i = 0; i < 6; i++) {
      anchors[i] = Math.log2(Math.sqrt(baseEdges[i] * baseEdges[i + 1]));
    }
    const x = Math.log2(Math.max(f, 1e-9));
    if (x <= anchors[0]) return v[0];
    if (x >= anchors[5]) return v[5];

    for (let i = 0; i < 5; i++) {
      if (x < anchors[i + 1]) {
        const t = (x - anchors[i]) / (anchors[i + 1] - anchors[i]);
        const s = t * t * (3.0 - 2.0 * t);
        return v[i] + (v[i + 1] - v[i]) * s;
      }
    }
    return v[5];
  }

  public static make(
    n: number,
    binWidth: number,
    baseEdges: readonly number[] = BandLayout.defaultBaseEdges,
    lowEdge = 40.0
  ): BandLayout {
    const base = Array.from(baseEdges);
    if (n <= 6) {
      return new BandLayout(
        base,
        Array.from({ length: Math.max(0, base.length - 1) }, (_, i) => i),
        binWidth
      );
    }

    const lo0 = Math.min(Math.max(lowEdge, 20.0), base[1] * 0.9);
    const lows = Array.from({ length: 6 }, (_, i) => (i === 0 ? lo0 : base[i]));

    const firstBin = (p: number) => Math.ceil(lows[p] / binWidth - 1e-9);
    const lastBin = (p: number) => Math.ceil(base[p + 1] / binWidth - 1e-9);

    const avail = Array.from({ length: 6 }, (_, p) => Math.max(1, lastBin(p) - firstBin(p)));
    const oct = Array.from({ length: 6 }, (_, p) => Math.log2(base[p + 1] / lows[p]));
    const totalOct = oct.reduce((a, b) => a + b, 0.0);

    const ideal = oct.map((o) => (n * o) / totalOct);
    const alloc = Array.from({ length: 6 }, (_, p) =>
      Math.min(Math.max(1, Math.floor(ideal[p])), avail[p])
    );
    const carry = Array.from({ length: 6 }, (_, p) => ideal[p] - Math.floor(ideal[p]));
    let delta = n - alloc.reduce((a, b) => a + b, 0);

    while (delta > 0) {
      let bestCandidate = -1;
      let maxCarry = -Infinity;
      for (let p = 0; p < 6; p++) {
        if (alloc[p] < avail[p] && carry[p] > maxCarry) {
          maxCarry = carry[p];
          bestCandidate = p;
        }
      }
      if (bestCandidate === -1) break;
      alloc[bestCandidate] += 1;
      carry[bestCandidate] -= 1;
      delta -= 1;
    }

    while (delta < 0) {
      let bestCandidate = -1;
      let minCarry = Infinity;
      for (let p = 0; p < 6; p++) {
        if (alloc[p] > 1 && carry[p] < minCarry) {
          minCarry = carry[p];
          bestCandidate = p;
        }
      }
      if (bestCandidate === -1) break;
      alloc[bestCandidate] -= 1;
      carry[bestCandidate] += 1;
      delta += 1;
    }

    while (delta > 0) {
      let bestCandidate = -1;
      let minRatio = Infinity;
      for (let p = 0; p < 6; p++) {
        const ratio = oct[p] / alloc[p];
        if (ratio < minRatio) {
          minRatio = ratio;
          bestCandidate = p;
        }
      }
      if (bestCandidate === -1) break;
      alloc[bestCandidate] += 1;
      delta -= 1;
    }

    const edges: number[] = [];
    const parent: number[] = [];

    for (let p = 0; p < 6; p++) {
      const lo = lows[p];
      const hi = base[p + 1];
      const b0 = firstBin(p);
      const b1 = lastBin(p);
      const m = Math.max(1, Math.min(alloc[p], Math.max(1, b1 - b0)));

      const bounds: number[] = [b0];
      for (let j = 1; j < m; j++) {
        const hz = lo * Math.pow(hi / lo, j / m);
        let b = Math.ceil(hz / binWidth - 1e-9);
        const lastBound = bounds[bounds.length - 1] ?? b0;
        b = Math.max(b, lastBound + 1);
        b = Math.min(b, b1 - (m - j));
        bounds.push(b);
      }
      bounds.push(b1);

      for (let j = 0; j < m; j++) {
        const e = j === 0 ? lo : bounds[j] * binWidth;
        edges.push(Math.min(Math.max(e, lo), hi));
        parent.push(p);
      }
    }
    edges.push(base[6]);

    return new BandLayout(edges, parent, binWidth);
  }

  public isWholeParentBand(
    index: number,
    baseEdges: readonly number[] = BandLayout.defaultBaseEdges
  ): boolean {
    if (index >= this.parent.length) return false;
    const p = Math.min(Math.max(this.parent[index], 0), 5);
    return (
      Math.abs(this.edges[index] - baseEdges[p]) < 0.01 &&
      Math.abs(this.edges[index + 1] - baseEdges[p + 1]) < 0.01
    );
  }
}

/* -----------------------------------------------------------------
   Real-valued FFT at Apple Accelerate vDSP scaling: packed real
   forward transform is 2 * |DFT|, so DC and Nyquist read from
   (real[0], real[half]) and every other bin from (real[k], imag[k]),
   all normalised by 1 / halfSize.
   ----------------------------------------------------------------- */

export class RealFFT {
  public readonly fftSize: number;
  public readonly halfSize: number;
  private readonly window: Float32Array;
  private readonly bitRev: Int32Array;
  private readonly cosTable: Float32Array;
  private readonly sinTable: Float32Array;
  private readonly real: Float32Array;
  private readonly imag: Float32Array;
  private readonly mags: Float32Array;
  private readonly magScale: number;

  constructor(fftSize = 2048) {
    if (fftSize < 2 || (fftSize & (fftSize - 1)) !== 0) {
      throw new Error(`fftSize must be a power of 2 >= 2, got ${fftSize}`);
    }
    this.fftSize = fftSize;
    this.halfSize = fftSize / 2;
    this.magScale = Math.fround(1.0 / this.halfSize);

    this.window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      this.window[i] = Math.fround(0.5 - 0.5 * Math.cos((2.0 * Math.PI * i) / fftSize));
    }

    const bits = Math.round(Math.log2(fftSize));
    this.bitRev = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      let rev = 0;
      for (let b = 0; b < bits; b++) {
        rev = (rev << 1) | ((i >> b) & 1);
      }
      this.bitRev[i] = rev;
    }

    this.cosTable = new Float32Array(fftSize);
    this.sinTable = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const angle = (-2.0 * Math.PI * i) / fftSize;
      this.cosTable[i] = Math.fround(Math.cos(angle));
      this.sinTable[i] = Math.fround(Math.sin(angle));
    }

    this.real = new Float32Array(fftSize);
    this.imag = new Float32Array(fftSize);
    this.mags = new Float32Array(this.halfSize);
  }

  public computeMagnitudes(samples: Float32Array | number[]): Float32Array {
    if (samples.length < this.fftSize) {
      return new Float32Array(0);
    }

    const n = this.fftSize;
    const real = this.real;
    const imag = this.imag;
    const win = this.window;
    const bitRev = this.bitRev;
    const cosTable = this.cosTable;
    const sinTable = this.sinTable;

    for (let i = 0; i < n; i++) {
      const j = bitRev[i];
      real[j] = Math.fround(samples[i] * win[i]);
      imag[j] = 0.0;
    }

    for (let m = 2; m <= n; m <<= 1) {
      const m2 = m >> 1;
      const step = n / m;
      for (let j = 0; j < m2; j++) {
        const k = j * step;
        const wr = cosTable[k];
        const wi = sinTable[k];

        for (let i = j; i < n; i += m) {
          const idx2 = i + m2;
          const tr = Math.fround(Math.fround(wr * real[idx2]) - Math.fround(wi * imag[idx2]));
          const ti = Math.fround(Math.fround(wr * imag[idx2]) + Math.fround(wi * real[idx2]));

          real[idx2] = Math.fround(real[i] - tr);
          imag[idx2] = Math.fround(imag[i] - ti);
          real[i] = Math.fround(real[i] + tr);
          imag[i] = Math.fround(imag[i] + ti);
        }
      }
    }

    const half = this.halfSize;
    const scale = this.magScale;

    const dcNyquist = Math.fround(2.0 * Math.fround(Math.hypot(real[0], real[half])));
    this.mags[0] = Math.fround(dcNyquist * scale);

    for (let k = 1; k < half; k++) {
      const mag = Math.fround(2.0 * Math.fround(Math.hypot(real[k], imag[k])));
      this.mags[k] = Math.fround(mag * scale);
    }

    return this.mags;
  }

  public static bands(
    mags: Float32Array | number[],
    binWidth: number,
    layout: BandLayout,
    cleanAssignment = false
  ): number[] {
    const count = layout.count;
    if (count <= 0 || mags.length === 0) return [];
    const kFactor = 2.0 * Math.sqrt(8.0 / 3.0);
    const row: number[] = new Array(count).fill(0.0);
    let band = 0;

    for (let k = 0; k < mags.length; k++) {
      const f = k * binWidth;
      const m = mags[k];

      if (cleanAssignment) {
        if (f < layout.edges[0] || f >= layout.edges[count]) continue;
        while (band + 1 < count && f >= layout.edges[band + 1]) {
          band++;
        }
        row[band] += m;
        continue;
      }

      const lo = layout.edges[band];
      const hi = layout.edges[band + 1];
      if (f < lo || f > hi) {
        if (band + 1 < count && f >= hi) {
          while (band + 1 < count && f >= layout.edges[band + 1]) {
            band++;
          }
        }
        row[band] += m / (hi - lo);
      } else {
        row[band] += m;
      }
    }

    for (let b = 0; b < count; b++) {
      row[b] *= kFactor;
    }
    return row;
  }
}

/* ----------------------------------------------------------------- */

export class RingBuffer {
  private readonly buffer: Float32Array;
  private readonly capacity: number;
  private writeIndex = 0;
  private filled = 0;

  constructor(capacity = 2048) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  public push(samples: Float32Array | number[]): void {
    const len = samples.length;
    if (len === 0) return;

    if (len >= this.capacity) {
      const start = len - this.capacity;
      for (let i = 0; i < this.capacity; i++) {
        this.buffer[i] = samples[start + i];
      }
      this.writeIndex = 0;
      this.filled = this.capacity;
      return;
    }

    let srcOffset = 0;
    let remaining = len;

    while (remaining > 0) {
      const chunk = Math.min(remaining, this.capacity - this.writeIndex);
      for (let i = 0; i < chunk; i++) {
        this.buffer[this.writeIndex + i] = samples[srcOffset + i];
      }
      this.writeIndex = (this.writeIndex + chunk) % this.capacity;
      srcOffset += chunk;
      remaining -= chunk;
    }

    this.filled = Math.min(this.capacity, this.filled + len);
  }

  public getLatest(out: Float32Array): boolean {
    if (out.length !== this.capacity) {
      throw new Error(`Output buffer length (${out.length}) must match capacity (${this.capacity})`);
    }
    if (this.filled < this.capacity) {
      out.fill(0);
      const start = (this.writeIndex - this.filled + this.capacity) % this.capacity;
      const targetStart = this.capacity - this.filled;
      for (let i = 0; i < this.filled; i++) {
        out[targetStart + i] = this.buffer[(start + i) % this.capacity];
      }
      return false;
    }

    const start = this.writeIndex;
    const firstChunk = this.capacity - start;
    for (let i = 0; i < firstChunk; i++) {
      out[i] = this.buffer[start + i];
    }
    for (let i = 0; i < start; i++) {
      out[firstChunk + i] = this.buffer[i];
    }
    return true;
  }

  public reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.filled = 0;
  }
}

/* -----------------------------------------------------------------
   Per-band state machine: nonlinear compression, a slow envelope that
   decides whether the section is quiet, and an attack boost measured
   against a 3-tap reference envelope so a transient never gets eaten
   by the release. This is where "lively" comes from — not from the
   renderer, which only integrates.
   ----------------------------------------------------------------- */

export class SpectrumChain {
  public readonly bandCount: number;
  public readonly layout: BandLayout;
  public gain: number[];
  public exponent: number[];
  public punch: number[];

  private history: [number[], number[], number[]];
  private slow: number[];
  public readonly output: number[];

  constructor(bandCount: number, layout: BandLayout, profile: TuningProfile) {
    this.bandCount = bandCount;
    this.layout = layout;
    const centres = layout.centres;
    this.gain = centres.map((f) => BandLayout.smoothCal(profile.gains, f, profile.baseEdges));
    this.exponent = centres.map((f) => BandLayout.smoothCal(profile.exponents, f, profile.baseEdges));
    this.punch = centres.map((f) => BandLayout.smoothCal(profile.punch, f, profile.baseEdges));

    const n = Math.max(1, layout.count);
    this.history = [
      new Array(n).fill(0.0),
      new Array(n).fill(0.0),
      new Array(n).fill(0.0),
    ];
    this.slow = new Array(n).fill(0.0);
    this.output = new Array(n).fill(0.0);
  }

  public step(
    acc: readonly number[],
    dt: number,
    reactivity: number,
    noiseGateScale: number,
    profile: TuningProfile
  ): number[] {
    const n = this.output.length;
    if (n === 0) return [];

    const value: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const energy = i < acc.length ? acc[i] : 0.0;
      const raw = energy * this.gain[i];
      value[i] = Math.min(1.0, Math.max(0.0, Math.pow(Math.max(0.0, raw), this.exponent[i])));
    }

    const stepDt = Math.max(0.001, Math.min(0.2, dt));
    const alpha = 1.0 - Math.exp(-stepDt / Math.max(1e-6, profile.slowTau));
    for (let i = 0; i < n; i++) {
      this.slow[i] += (value[i] - this.slow[i]) * alpha;
    }

    const smoothed: number[] = new Array(n).fill(0.0);
    for (let k = 0; k < profile.referenceKernel.length; k++) {
      const weight = profile.referenceKernel[k];
      const src = this.history[Math.min(k, 2)];
      for (let i = 0; i < n; i++) {
        smoothed[i] += weight * src[i];
      }
    }

    const low = profile.deadbandLow * Math.max(0.0, noiseGateScale);
    const high = profile.deadbandHigh * Math.max(0.0, noiseGateScale);

    for (let i = 0; i < n; i++) {
      const rise = Math.max(0.0, value[i] - smoothed[i]);
      const gate = Math.min(1.0, Math.max(0.0, 1.0 - this.slow[i] / Math.max(1e-6, profile.gateLow)));
      const amount = (this.punch[i] * gate + profile.punchBase) * Math.max(0.0, reactivity);
      const shape = high > low ? Math.min(1.0, Math.max(0.0, (rise - low) / (high - low))) : 1.0;
      this.output[i] = Math.fround(Math.min(1.0, Math.max(0.0, value[i] + amount * rise * shape)));
    }

    this.history[2] = [...this.history[1]];
    this.history[1] = [...this.history[0]];
    this.history[0] = [...value];

    return this.output;
  }

  public reset(): void {
    const n = this.output.length;
    this.history = [
      new Array(n).fill(0.0),
      new Array(n).fill(0.0),
      new Array(n).fill(0.0),
    ];
    this.slow = new Array(n).fill(0.0);
    this.output.fill(0.0);
  }
}

/* ----------------------------------------------------------------- */

export interface SpectrumAnalyzerOptions {
  bandCount?: number;
  sampleRate?: number;
  tuningProfile?: TuningProfile;
  reactivity?: number;
  noiseGateScale?: number;
}

export class SpectrumAnalyzer {
  public readonly bandCount: number;
  public readonly sampleRate: number;
  public readonly windowSize = 2048;

  public reactivity: number;
  public noiseGateScale: number;
  public tuningProfile: TuningProfile;

  private readonly ringBuffer: RingBuffer;
  private readonly fft: RealFFT;
  private readonly layout: BandLayout;
  private readonly baseLayout: BandLayout;
  private readonly chain: SpectrumChain;
  private readonly windowBuf: Float32Array;

  constructor(options: SpectrumAnalyzerOptions = {}) {
    const bandCount = Math.max(1, options.bandCount ?? 6);
    const sampleRate = Math.max(1.0, options.sampleRate ?? 48000.0);
    const tuningProfile = options.tuningProfile ?? DEFAULT_TUNING_PROFILE;

    this.bandCount = bandCount;
    this.sampleRate = sampleRate;
    this.tuningProfile = tuningProfile;
    this.reactivity = Math.max(0.0, options.reactivity ?? 1.0);
    this.noiseGateScale = Math.max(0.0, options.noiseGateScale ?? 1.0);

    this.ringBuffer = new RingBuffer(this.windowSize);
    this.fft = new RealFFT(this.windowSize);
    this.windowBuf = new Float32Array(this.windowSize);

    const binWidth = this.sampleRate / this.windowSize;
    this.baseLayout = new BandLayout(
      Array.from(tuningProfile.baseEdges),
      Array.from({ length: Math.max(0, tuningProfile.baseEdges.length - 1) }, (_, i) => i),
      binWidth
    );

    this.layout = BandLayout.make(
      bandCount,
      binWidth,
      tuningProfile.baseEdges,
      tuningProfile.multiBandLowEdge
    );

    this.chain = new SpectrumChain(bandCount, this.layout, tuningProfile);
  }

  public pushSamples(pcm: Float32Array | number[]): void {
    this.ringBuffer.push(pcm);
  }

  /** Advances one tick by `dt` seconds and returns band energies in [0, 1]. */
  public step(dt: number): number[] {
    this.ringBuffer.getLatest(this.windowBuf);
    const mags = this.fft.computeMagnitudes(this.windowBuf);

    if (mags.length === 0) {
      return this.chain.step(
        new Array(this.bandCount).fill(0.0),
        dt,
        this.reactivity,
        this.noiseGateScale,
        this.tuningProfile
      );
    }

    const binWidth = this.sampleRate / this.windowSize;

    const baseMags = RealFFT.bands(mags, binWidth, this.baseLayout, false);
    const coarse: number[] = new Array(Math.min(6, baseMags.length));
    for (let i = 0; i < coarse.length; i++) {
      coarse[i] = baseMags[i] / this.tuningProfile.windowCalibration[i];
    }

    let acc: number[];
    if (this.bandCount <= 6) {
      acc = coarse;
    } else {
      const rows = RealFFT.bands(mags, binWidth, this.layout, true);
      const weights = this.layout.densityScale;
      acc = new Array(this.layout.count).fill(0.0);
      for (let i = 0; i < this.layout.count; i++) {
        const p = Math.min(Math.max(this.layout.parent[i], 0), 5);
        const scale = this.tuningProfile.windowCalibration[p];
        if (this.layout.isWholeParentBand(i, this.tuningProfile.baseEdges)) {
          acc[i] = coarse[p];
        } else {
          acc[i] = (rows[i] * weights[i]) / scale * this.tuningProfile.subBandTrim;
        }
      }
    }

    return this.chain.step(acc, dt, this.reactivity, this.noiseGateScale, this.tuningProfile);
  }

  public reset(): void {
    this.ringBuffer.reset();
    this.chain.reset();
  }
}

export function createSpectrumAnalyzer(options?: SpectrumAnalyzerOptions): SpectrumAnalyzer {
  return new SpectrumAnalyzer(options);
}

/* -----------------------------------------------------------------
   Capsule physics: a second-order damped harmonic oscillator solved
   in closed form (not integrated), so the settle time is exactly
   `duration` regardless of frame rate. ζ = 0.83 is underdamped and
   overshoots by ~0.9%: heights arrive with a little life in them
   instead of easing into place like a CSS transition.
   ----------------------------------------------------------------- */

export class CapsuleSpringSolver {
  public response: number;
  public dampingFraction: number;

  constructor(response = 0.2282, dampingFraction = 0.83) {
    this.response = Math.max(0.001, response);
    this.dampingFraction = Math.max(0.0, dampingFraction);
  }

  public static fromDuration(
    duration = 0.325,
    dampingFraction = 0.83
  ): CapsuleSpringSolver {
    const omega = 8.95 / Math.max(0.01, duration);
    const response = (2.0 * Math.PI) / omega;
    return new CapsuleSpringSolver(response, dampingFraction);
  }

  public static step(
    position: number,
    velocity: number,
    target: number,
    omega: number,
    zeta: number,
    dt: number
  ): { position: number; velocity: number } {
    if (omega <= 0.0 || dt <= 0.0) {
      return { position, velocity };
    }

    const d0 = position - target;
    const v0 = velocity;
    const edge = 0.0001;

    if (zeta < 1.0 - edge) {
      const omegaD = omega * Math.sqrt(Math.max(0.0, 1.0 - zeta * zeta));
      const e = Math.exp(-zeta * omega * dt);
      const cosw = Math.cos(omegaD * dt);
      const sinw = Math.sin(omegaD * dt);
      const a = d0;
      const b = (v0 + zeta * omega * d0) / Math.max(1e-12, omegaD);
      const d = e * (a * cosw + b * sinw);
      const v =
        e *
        (-zeta * omega * (a * cosw + b * sinw) +
          omegaD * (-a * sinw + b * cosw));
      return { position: target + d, velocity: v };
    } else if (zeta <= 1.0 + edge) {
      const e = Math.exp(-omega * dt);
      const a = d0;
      const b = v0 + omega * d0;
      const d = (a + b * dt) * e;
      const v = (b - omega * (a + b * dt)) * e;
      return { position: target + d, velocity: v };
    } else {
      const s = Math.sqrt(Math.max(0.0, zeta * zeta - 1.0));
      const r1 = -omega * (zeta - s);
      const r2 = -omega * (zeta + s);
      const denom = r2 - r1;
      const c2 = Math.abs(denom) > 1e-12 ? (v0 - r1 * d0) / denom : 0.0;
      const c1 = d0 - c2;
      const e1 = Math.exp(r1 * dt);
      const e2 = Math.exp(r2 * dt);
      const d = c1 * e1 + c2 * e2;
      const v = c1 * r1 * e1 + c2 * r2 * e2;
      return { position: target + d, velocity: v };
    }
  }
}

export class CapsuleSpringFollower {
  public count: number;
  public solver: CapsuleSpringSolver;
  public positions: number[];
  public velocities: number[];

  constructor(
    count = 6,
    solver: CapsuleSpringSolver = CapsuleSpringSolver.fromDuration(0.325, 0.83)
  ) {
    this.count = Math.max(1, count);
    this.solver = solver;
    this.positions = new Array(this.count).fill(0.0);
    this.velocities = new Array(this.count).fill(0.0);
  }

  /** Clamps dt to a 30 Hz floor and sub-steps at 120 Hz for precision. */
  public step(targets: readonly number[], rawDt: number): number[] {
    const dt = Math.max(0.0, Math.min(rawDt, 1.0 / 30.0));
    if (dt <= 0.0) return this.positions;

    const omega = (2.0 * Math.PI) / Math.max(0.001, this.solver.response);
    const zeta = this.solver.dampingFraction;
    const maxStep = 1.0 / 120.0;
    let remaining = dt;

    while (remaining > 0.0) {
      const stepDt = Math.min(remaining, maxStep);
      const limit = Math.min(this.count, targets.length);
      for (let i = 0; i < limit; i++) {
        const { position, velocity } = CapsuleSpringSolver.step(
          this.positions[i],
          this.velocities[i],
          targets[i],
          omega,
          zeta,
          stepDt
        );
        this.positions[i] = position;
        this.velocities[i] = velocity;
      }
      remaining -= stepDt;
    }

    return this.positions;
  }

  public isSettled(
    targets: readonly number[],
    positionEpsilon = 0.0008,
    velocityEpsilon = 0.0016
  ): boolean {
    const limit = Math.min(this.count, targets.length);
    for (let i = 0; i < limit; i++) {
      if (Math.abs(targets[i] - this.positions[i]) > positionEpsilon) return false;
      if (Math.abs(this.velocities[i]) > velocityEpsilon) return false;
    }
    return true;
  }

  public reset(to = 0.0): void {
    this.positions.fill(to);
    this.velocities.fill(0.0);
  }
}

/* -----------------------------------------------------------------
   Geometry. Bars are centred on their own slot, so a growing bar
   widens around its axis instead of lurching to one side, and the
   resting height is the capsule width — i.e. a dot, not a zero-height
   bar (which would be invisible).
   ----------------------------------------------------------------- */

export interface CapsuleRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

export class CapsuleMetrics {
  public barWidth: number;
  public spacing: number;
  public minHeight: number;
  public maxBarHeight: number;
  public originX: number;
  public centerY: number;
  public cornerRadius: number;
  public widthExpansion: number;

  constructor(
    barWidth: number,
    spacing: number,
    minHeight: number,
    maxBarHeight: number,
    originX: number,
    centerY: number,
    cornerRadius: number,
    widthExpansion = 0.145
  ) {
    this.barWidth = barWidth;
    this.spacing = spacing;
    this.minHeight = minHeight;
    this.maxBarHeight = maxBarHeight;
    this.originX = originX;
    this.centerY = centerY;
    this.cornerRadius = cornerRadius;
    this.widthExpansion = widthExpansion;
  }

  public static centered(
    boundsWidth: number,
    boundsHeight: number,
    count: number,
    capsuleWidth = 4.0,
    capsuleSpacing = 3.0,
    maxHeightRatio = 0.9,
    widthExpansion = 0.145
  ): CapsuleMetrics {
    const n = Math.max(1, count);
    const totalWidth = n * capsuleWidth + Math.max(0, n - 1) * capsuleSpacing;
    return new CapsuleMetrics(
      capsuleWidth,
      capsuleSpacing,
      capsuleWidth,
      boundsHeight * maxHeightRatio,
      (boundsWidth - totalWidth) * 0.5,
      boundsHeight * 0.5,
      capsuleWidth * 0.5,
      widthExpansion
    );
  }

  public frame(index: number, normalizedHeight: number): CapsuleRect {
    const value = Math.min(1.0, Math.max(0.0, normalizedHeight));
    const height = this.minHeight + (this.maxBarHeight - this.minHeight) * value;
    const width = this.barWidth * (1.0 + this.widthExpansion * value);
    const centerX =
      this.originX + index * (this.barWidth + this.spacing) + this.barWidth * 0.5;
    return {
      x: centerX - width * 0.5,
      y: this.centerY - height * 0.5,
      width,
      height,
      cornerRadius: width * 0.5,
    };
  }
}

/* -----------------------------------------------------------------
   2D renderer. Backing store is `css * devicePixelRatio`, the
   context is scaled once per frame so every geometry stays in CSS
   pixels, and heights are the spring follower's solved positions.
   Paused, the targets are all zero: the bars collapse into their dots
   under the slower, critically damped pause solver instead of
   freezing at whatever energy the last frame happened to catch.
   ----------------------------------------------------------------- */

export interface CanvasRendererOptions {
  bandCount?: number;
  color?: string;
  capsuleWidth?: number;
  capsuleSpacing?: number;
  widthExpansion?: number;
  maxHeightRatio?: number;
  springDuration?: number;
  springDamping?: number;
  pauseDuration?: number;
  pauseDamping?: number;
  dpr?: number;
}

export class AlwaveCanvasRenderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  public bandCount: number;
  public color: string;
  public capsuleWidth: number;
  public capsuleSpacing: number;
  public widthExpansion: number;
  public maxHeightRatio: number;
  public dpr: number;

  private isPlaying = true;
  private readonly playSolver: CapsuleSpringSolver;
  private readonly pauseSolver: CapsuleSpringSolver;
  private readonly follower: CapsuleSpringFollower;

  private cssWidth = 0;
  private cssHeight = 0;

  constructor(canvas: HTMLCanvasElement, options: CanvasRendererOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context from canvas');
    }
    this.ctx = ctx;

    this.bandCount = Math.max(1, options.bandCount ?? 6);
    this.color = options.color ?? '#ffffff';
    this.capsuleWidth = options.capsuleWidth ?? 4.0;
    this.capsuleSpacing = options.capsuleSpacing ?? 3.0;
    this.widthExpansion = options.widthExpansion ?? 0.145;
    this.maxHeightRatio = options.maxHeightRatio ?? 0.9;
    this.dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    this.playSolver = CapsuleSpringSolver.fromDuration(
      options.springDuration ?? 0.325,
      options.springDamping ?? 0.83
    );
    this.pauseSolver = CapsuleSpringSolver.fromDuration(
      options.pauseDuration ?? 0.6,
      options.pauseDamping ?? 1.0
    );

    this.follower = new CapsuleSpringFollower(this.bandCount, this.playSolver);

    this.resize();
  }

  /** True once every capsule has reached its dot and stopped moving. */
  public get settled(): boolean {
    return this.follower.isSettled(new Array(this.bandCount).fill(0.0));
  }

  public setPlaying(playing: boolean): void {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      this.follower.solver = playing ? this.playSolver : this.pauseSolver;
    }
  }

  public setColor(color: string): void {
    this.color = color;
  }

  public resize(width?: number, height?: number): void {
    const w = width ?? (this.canvas.clientWidth || 0);
    const h = height ?? (this.canvas.clientHeight || 0);

    this.cssWidth = w;
    this.cssHeight = h;

    const physicalWidth = Math.round(w * this.dpr);
    const physicalHeight = Math.round(h * this.dpr);

    if (this.canvas.width !== physicalWidth || this.canvas.height !== physicalHeight) {
      this.canvas.width = physicalWidth;
      this.canvas.height = physicalHeight;
    }
  }

  public render(energyTargets: readonly number[], dt: number, isPlaying?: boolean): void {
    if (isPlaying !== undefined) {
      this.setPlaying(isPlaying);
    }

    const targets = this.isPlaying
      ? energyTargets
      : new Array(this.bandCount).fill(0.0);

    const positions = this.follower.step(targets, dt);

    const ctx = this.ctx;
    const dpr = this.dpr;
    const width = this.cssWidth;
    const height = this.cssHeight;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const metrics = CapsuleMetrics.centered(
      width,
      height,
      this.bandCount,
      this.capsuleWidth,
      this.capsuleSpacing,
      this.maxHeightRatio,
      this.widthExpansion
    );

    ctx.fillStyle = this.color;
    for (let i = 0; i < this.bandCount; i++) {
      const normH = i < positions.length ? positions[i] : 0.0;
      const rect = metrics.frame(i, normH);
      this.drawCapsule(rect.x, rect.y, rect.width, rect.height, rect.cornerRadius);
    }

    ctx.restore();
  }

  private drawCapsule(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    const ctx = this.ctx;
    const r = Math.min(radius, width * 0.5, height * 0.5);

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.arcTo(x + width, y, x + width, y + r, r);
      ctx.lineTo(x + width, y + height - r);
      ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
      ctx.lineTo(x + r, y + height);
      ctx.arcTo(x, y + height, x, y + height - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
    ctx.fill();
  }

  public reset(): void {
    this.follower.reset();
  }
}
