import type { DailyRecord, ComputedStats } from "./types";

export function computeStats(data: DailyRecord[]): ComputedStats {
  const total = data.length;
  let up = 0,
    down = 0,
    flat = 0;
  const returns: number[] = [];
  let bestDay = { date: "", pct: -Infinity };
  let worstDay = { date: "", pct: Infinity };
  let cum = 1;
  let curUp = 0,
    curDown = 0,
    longestUp = 0,
    longestDown = 0;

  for (const d of data) {
    if (d.direction === "Up") up += 1;
    else if (d.direction === "Down") down += 1;
    else flat += 1;

    if (d.pnl_percent !== null) {
      returns.push(d.pnl_percent);
      cum *= 1 + d.pnl_percent / 100;
      if (d.pnl_percent > bestDay.pct) bestDay = { date: d.date, pct: d.pnl_percent };
      if (d.pnl_percent < worstDay.pct) worstDay = { date: d.date, pct: d.pnl_percent };
    }

    if (d.direction === "Up") {
      curUp += 1;
      curDown = 0;
      if (curUp > longestUp) longestUp = curUp;
    } else if (d.direction === "Down") {
      curDown += 1;
      curUp = 0;
      if (curDown > longestDown) longestDown = curDown;
    } else {
      curUp = 0;
      curDown = 0;
    }
  }

  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);

  return {
    total,
    up,
    down,
    flat,
    upPercent: (up / (up + down)) * 100,
    meanDaily: mean,
    stdDaily: std,
    annualisedVol: std * Math.sqrt(252),
    cumulativeReturn: cum,
    bestDay: bestDay.date ? bestDay : { date: data[0]?.date ?? "", pct: 0 },
    worstDay: worstDay.date ? worstDay : { date: data[0]?.date ?? "", pct: 0 },
    longestUpStreak: longestUp,
    longestDownStreak: longestDown,
    lastClose: data[data.length - 1]?.close ?? 0,
    firstClose: data[0]?.close ?? 0,
  };
}
