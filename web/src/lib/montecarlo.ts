import type { DailyRecord } from "./types";

export type Method = "gbm" | "bootstrap";

export type MCInputs = {
  s0: number;
  daily: DailyRecord[];
  lookbackDays: number | "all";
  daysAhead: number;
  paths: number;
  method: Method;
  seed: number;
};

export type MCResult = {
  inputs: MCInputs;
  /** Sample paths to draw (e.g., 100) — flat [path][day] */
  samplePaths: number[][];
  /** Percentile bands at each day */
  bands: { p: number; values: Float64Array }[];
  /** Final prices across ALL simulated paths */
  finalPrices: Float64Array;
  /** Summary stats */
  summary: {
    n: number;
    mean: number;
    median: number;
    std: number;
    p5: number; p25: number; p75: number; p95: number;
    probLoss: number;        // P(final < s0)
    probGain10: number;      // P(final >= s0 * 1.10)
    probDouble: number;      // P(final >= s0 * 2)
    cagrMedian: number;      // annualised
    cagrP5: number;
    cagrP95: number;
    /** Fitted log-return mean & std used in GBM, in % per day */
    fittedMu: number;
    fittedSigma: number;
  };
};

// ── seeded RNG (mulberry32) ─────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// Box-Muller — returns a single N(0,1) sample
function nextNormal(rng: () => number): number {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = rng();
  u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── helpers ─────────────────────────────────────────────────────────────────
function logReturns(daily: DailyRecord[], lookbackDays: number | "all"): number[] {
  const slice = lookbackDays === "all" ? daily : daily.slice(-lookbackDays);
  const out: number[] = [];
  for (const d of slice) {
    if (d.prev_close === null || d.prev_close <= 0 || d.close <= 0) continue;
    out.push(Math.log(d.close / d.prev_close));
  }
  return out;
}

function meanStd(arr: number[]): { mean: number; std: number } {
  const n = arr.length;
  let mean = 0;
  for (const x of arr) mean += x;
  mean /= n;
  let v = 0;
  for (const x of arr) v += (x - mean) ** 2;
  v /= n - 1;
  return { mean, std: Math.sqrt(v) };
}

function quantile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── main simulator ──────────────────────────────────────────────────────────
export function simulate(inputs: MCInputs): MCResult {
  const { s0, daily, lookbackDays, daysAhead, paths, method, seed } = inputs;
  const rng = mulberry32(seed);

  const histLog = logReturns(daily, lookbackDays);
  const { mean: muLog, std: sigLog } = meanStd(histLog);

  // Allocate flat [path][day] matrix (excluding s0 column)
  const matrix = new Float64Array(paths * daysAhead);

  for (let p = 0; p < paths; p++) {
    let s = s0;
    for (let t = 0; t < daysAhead; t++) {
      let r: number;
      if (method === "gbm") {
        r = muLog + sigLog * nextNormal(rng);
      } else {
        // bootstrap: pick one historical log return uniformly at random
        const idx = Math.floor(rng() * histLog.length);
        r = histLog[idx];
      }
      s = s * Math.exp(r);
      matrix[p * daysAhead + t] = s;
    }
  }

  // ── percentile bands per day ────────────────────────────────────────────
  const percentiles = [0.05, 0.25, 0.5, 0.75, 0.95];
  const bands = percentiles.map((p) => ({ p, values: new Float64Array(daysAhead + 1) }));
  bands.forEach((b) => (b.values[0] = s0));

  const column = new Float64Array(paths);
  for (let t = 0; t < daysAhead; t++) {
    for (let p = 0; p < paths; p++) column[p] = matrix[p * daysAhead + t];
    column.sort();
    for (const band of bands) {
      band.values[t + 1] = quantile(column, band.p);
    }
  }

  // ── final-price distribution ────────────────────────────────────────────
  const finalPrices = new Float64Array(paths);
  for (let p = 0; p < paths; p++) finalPrices[p] = matrix[p * daysAhead + (daysAhead - 1)];
  const sortedFinal = new Float64Array(finalPrices);
  sortedFinal.sort();

  // ── sample paths for visualization (up to 100, evenly spaced) ───────────
  const sampleN = Math.min(100, paths);
  const samplePaths: number[][] = [];
  const stride = Math.max(1, Math.floor(paths / sampleN));
  for (let p = 0; p < paths && samplePaths.length < sampleN; p += stride) {
    const path: number[] = [s0];
    for (let t = 0; t < daysAhead; t++) path.push(matrix[p * daysAhead + t]);
    samplePaths.push(path);
  }

  // ── summary stats ───────────────────────────────────────────────────────
  let mean = 0;
  for (let i = 0; i < paths; i++) mean += finalPrices[i];
  mean /= paths;
  let variance = 0;
  for (let i = 0; i < paths; i++) variance += (finalPrices[i] - mean) ** 2;
  variance /= paths - 1;
  const std = Math.sqrt(variance);

  const p5 = quantile(sortedFinal, 0.05);
  const p25 = quantile(sortedFinal, 0.25);
  const median = quantile(sortedFinal, 0.5);
  const p75 = quantile(sortedFinal, 0.75);
  const p95 = quantile(sortedFinal, 0.95);

  let lossCount = 0, gain10Count = 0, doubleCount = 0;
  for (let i = 0; i < paths; i++) {
    const f = finalPrices[i];
    if (f < s0) lossCount += 1;
    if (f >= s0 * 1.1) gain10Count += 1;
    if (f >= s0 * 2) doubleCount += 1;
  }

  const years = daysAhead / 252;
  const annualize = (p: number) => Math.pow(p / s0, 1 / years) - 1;

  return {
    inputs,
    samplePaths,
    bands,
    finalPrices,
    summary: {
      n: paths,
      mean,
      median,
      std,
      p5, p25, p75, p95,
      probLoss: lossCount / paths,
      probGain10: gain10Count / paths,
      probDouble: doubleCount / paths,
      cagrMedian: annualize(median),
      cagrP5: annualize(p5),
      cagrP95: annualize(p95),
      fittedMu: muLog * 100, // express as % per day for display
      fittedSigma: sigLog * 100,
    },
  };
}

// Project trading days forward as ISO date strings (skip weekends — good enough for charting)
export function projectDates(start: Date, n: number): string[] {
  const out: string[] = [start.toISOString().slice(0, 10)];
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    out.push(d.toISOString().slice(0, 10));
    added += 1;
  }
  return out;
}
