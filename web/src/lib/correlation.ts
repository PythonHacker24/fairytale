import type { DailyRecord } from "./types";

export type AlignedReturns = {
  dates: string[];
  a: number[];
  b: number[];
};

/** Inner-join two time series on date, keeping rows where both have pnl_percent. */
export function alignReturns(a: DailyRecord[], b: DailyRecord[]): AlignedReturns {
  const bMap = new Map(b.map((d) => [d.date, d.pnl_percent]));
  const dates: string[] = [];
  const ax: number[] = [];
  const bx: number[] = [];
  for (const d of a) {
    if (d.pnl_percent === null) continue;
    const bv = bMap.get(d.date);
    if (bv === undefined || bv === null) continue;
    dates.push(d.date);
    ax.push(d.pnl_percent);
    bx.push(bv);
  }
  return { dates, a: ax, b: bx };
}

export type PairStats = {
  n: number;
  meanA: number;
  meanB: number;
  stdA: number;
  stdB: number;
  covariance: number;
  correlation: number;
  betaAonB: number;
  betaBonA: number;
  intercept: number;
  /** Slope and intercept for regression of a on b — used to draw the trend line on a scatter. */
  regression: { slope: number; intercept: number };
};

export function pairStats(a: number[], b: number[]): PairStats {
  const n = a.length;
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  cov /= n - 1;
  varA /= n - 1;
  varB /= n - 1;
  const stdA = Math.sqrt(varA);
  const stdB = Math.sqrt(varB);
  const correlation = cov / (stdA * stdB);
  const betaAonB = cov / varB; // A = α + β·B
  const betaBonA = cov / varA;
  const intercept = meanA - betaAonB * meanB;
  return {
    n,
    meanA,
    meanB,
    stdA,
    stdB,
    covariance: cov,
    correlation,
    betaAonB,
    betaBonA,
    intercept,
    regression: { slope: betaAonB, intercept },
  };
}
