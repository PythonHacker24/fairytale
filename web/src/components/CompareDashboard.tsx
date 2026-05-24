"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AssetPicker from "./AssetPicker";
import ChartCard from "./ChartCard";
import {
  CompareCumulative,
  CompareDistribution,
  CompareVolatility,
  CompareScatter,
  CompareYearly,
  COMPARE_COLORS,
} from "./charts/CompareCharts";
import { loadAssetDaily, loadAssetManifest } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { alignReturns, pairStats } from "@/lib/correlation";
import type { AssetMeta, DailyRecord, ComputedStats } from "@/lib/types";

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

type Loaded = { meta: AssetMeta; data: DailyRecord[]; stats: ComputedStats };

const DEFAULT_A = "NIFTY50";
const DEFAULT_B = "SENSEX";

export default function CompareDashboard() {
  const router = useRouter();
  const search = useSearchParams();
  const [manifest, setManifest] = useState<AssetMeta[] | null>(null);
  const [aSlug, setASlug] = useState(search.get("a") ?? DEFAULT_A);
  const [bSlug, setBSlug] = useState(search.get("b") ?? DEFAULT_B);
  const [a, setA] = useState<Loaded | null>(null);
  const [b, setB] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load manifest once
  useEffect(() => {
    loadAssetManifest().then(setManifest).catch((e) => setError(String(e)));
  }, []);

  // Sync URL when selections change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("a", aSlug);
    params.set("b", bSlug);
    router.replace(`/compare?${params.toString()}`, { scroll: false });
  }, [aSlug, bSlug, router]);

  // Load A
  useEffect(() => {
    if (!manifest) return;
    const meta = manifest.find((m) => m.slug === aSlug);
    if (!meta) return;
    setA(null);
    loadAssetDaily(aSlug).then((data) => setA({ meta, data, stats: computeStats(data) }));
  }, [aSlug, manifest]);

  // Load B
  useEffect(() => {
    if (!manifest) return;
    const meta = manifest.find((m) => m.slug === bSlug);
    if (!meta) return;
    setB(null);
    loadAssetDaily(bSlug).then((data) => setB({ meta, data, stats: computeStats(data) }));
  }, [bSlug, manifest]);

  const aligned = useMemo(() => (a && b ? alignReturns(a.data, b.data) : null), [a, b]);
  const pair = useMemo(() => (aligned && aligned.a.length > 0 ? pairStats(aligned.a, aligned.b) : null), [aligned]);

  if (error) {
    return <div className="p-10 text-down text-sm">Failed to load: {error}</div>;
  }
  if (!manifest) {
    return <div className="p-10 text-text-faint text-xs">Loading…</div>;
  }

  const aSeries = a
    ? { name: a.meta.name, data: a.data, color: COMPARE_COLORS.A_COLOR, light: COMPARE_COLORS.A_LIGHT }
    : null;
  const bSeries = b
    ? { name: b.meta.name, data: b.data, color: COMPARE_COLORS.B_COLOR, light: COMPARE_COLORS.B_LIGHT }
    : null;

  return (
    <>
      <div className="px-10 pt-10 pb-6 border-b border-border">
        <div className="text-[11px] tracking-[0.2em] text-text-faint uppercase">Compare</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Side-by-side analysis</h1>
        <div className="mt-5 flex flex-wrap gap-4 max-w-3xl">
          <AssetPicker
            assets={manifest}
            value={aSlug}
            onChange={setASlug}
            label="Asset A"
            color={COMPARE_COLORS.A_COLOR}
            disabled={bSlug}
          />
          <div className="self-end pb-2 text-text-faint text-xs">vs</div>
          <AssetPicker
            assets={manifest}
            value={bSlug}
            onChange={setBSlug}
            label="Asset B"
            color={COMPARE_COLORS.B_COLOR}
            disabled={aSlug}
          />
        </div>
      </div>

      {(!a || !b) && (
        <div className="p-10">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[100px] bg-panel border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {a && b && aSeries && bSeries && (
        <div className="p-10 space-y-10">
          {/* Side-by-side stat table */}
          <StatTable a={a} b={b} pair={pair} />

          <ChartCard
            title="Cumulative Returns"
            subtitle="Growth of ₹1, both lines on the same axis"
            height={440}
          >
            <CompareCumulative a={aSeries} b={bSeries} />
          </ChartCard>

          <ChartCard
            title="Return Distribution"
            subtitle="Overlay of both histograms with their normal-distribution fits"
            height={460}
          >
            <CompareDistribution a={aSeries} b={bSeries} />
          </ChartCard>

          <VolComparison a={a} b={b} aSeries={aSeries} bSeries={bSeries} />

          <ChartCard
            title="Correlation Scatter"
            subtitle="Each dot = one trading day · regression line, r, β, α"
            height={460}
          >
            {aligned && <CompareScatter aligned={aligned} a={aSeries} b={bSeries} />}
          </ChartCard>

          <ChartCard title="Yearly Returns" subtitle="Compounded return per calendar year" height={440}>
            <CompareYearly a={aSeries} b={bSeries} />
          </ChartCard>
        </div>
      )}
    </>
  );
}

// ── Stat comparison table ──────────────────────────────────────────────────
function StatTable({ a, b, pair }: { a: Loaded; b: Loaded; pair: ReturnType<typeof pairStats> | null }) {
  const aYears = years(a);
  const bYears = years(b);
  const aCAGR = (Math.pow(a.stats.cumulativeReturn, 1 / aYears) - 1) * 100;
  const bCAGR = (Math.pow(b.stats.cumulativeReturn, 1 / bYears) - 1) * 100;

  const rows: Array<{
    label: string;
    aVal: string;
    bVal: string;
    aNum: number;
    bNum: number;
    higherIsBetter: boolean;
    suffix?: string;
  }> = [
    {
      label: "Total Return",
      aVal: fmt((a.stats.cumulativeReturn - 1) * 100, 2) + "%",
      bVal: fmt((b.stats.cumulativeReturn - 1) * 100, 2) + "%",
      aNum: a.stats.cumulativeReturn,
      bNum: b.stats.cumulativeReturn,
      higherIsBetter: true,
    },
    {
      label: "CAGR",
      aVal: fmt(aCAGR, 2) + "%",
      bVal: fmt(bCAGR, 2) + "%",
      aNum: aCAGR,
      bNum: bCAGR,
      higherIsBetter: true,
    },
    {
      label: "Up Day %",
      aVal: fmt(a.stats.upPercent, 1) + "%",
      bVal: fmt(b.stats.upPercent, 1) + "%",
      aNum: a.stats.upPercent,
      bNum: b.stats.upPercent,
      higherIsBetter: true,
    },
    {
      label: "Avg Daily Return",
      aVal: fmt(a.stats.meanDaily, 3) + "%",
      bVal: fmt(b.stats.meanDaily, 3) + "%",
      aNum: a.stats.meanDaily,
      bNum: b.stats.meanDaily,
      higherIsBetter: true,
    },
    {
      label: "Daily σ",
      aVal: fmt(a.stats.stdDaily, 3) + "%",
      bVal: fmt(b.stats.stdDaily, 3) + "%",
      aNum: a.stats.stdDaily,
      bNum: b.stats.stdDaily,
      higherIsBetter: false,
    },
    {
      label: "Annualised σ",
      aVal: fmt(a.stats.annualisedVol, 2) + "%",
      bVal: fmt(b.stats.annualisedVol, 2) + "%",
      aNum: a.stats.annualisedVol,
      bNum: b.stats.annualisedVol,
      higherIsBetter: false,
    },
    {
      label: "Sharpe (μ/σ × √252)",
      aVal: fmt((a.stats.meanDaily / a.stats.stdDaily) * Math.sqrt(252), 2),
      bVal: fmt((b.stats.meanDaily / b.stats.stdDaily) * Math.sqrt(252), 2),
      aNum: (a.stats.meanDaily / a.stats.stdDaily) * Math.sqrt(252),
      bNum: (b.stats.meanDaily / b.stats.stdDaily) * Math.sqrt(252),
      higherIsBetter: true,
    },
    {
      label: "Best Day",
      aVal: `+${fmt(a.stats.bestDay.pct, 2)}%`,
      bVal: `+${fmt(b.stats.bestDay.pct, 2)}%`,
      aNum: a.stats.bestDay.pct,
      bNum: b.stats.bestDay.pct,
      higherIsBetter: true,
    },
    {
      label: "Worst Day",
      aVal: `${fmt(a.stats.worstDay.pct, 2)}%`,
      bVal: `${fmt(b.stats.worstDay.pct, 2)}%`,
      aNum: a.stats.worstDay.pct,
      bNum: b.stats.worstDay.pct,
      higherIsBetter: true, // less-negative is better
    },
    {
      label: "Longest Up Streak",
      aVal: `${a.stats.longestUpStreak} days`,
      bVal: `${b.stats.longestUpStreak} days`,
      aNum: a.stats.longestUpStreak,
      bNum: b.stats.longestUpStreak,
      higherIsBetter: true,
    },
    {
      label: "Longest Down Streak",
      aVal: `${a.stats.longestDownStreak} days`,
      bVal: `${b.stats.longestDownStreak} days`,
      aNum: a.stats.longestDownStreak,
      bNum: b.stats.longestDownStreak,
      higherIsBetter: false,
    },
  ];

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-[11px] tracking-[0.18em] text-text-faint uppercase">
          Side-by-side stats
        </div>
        {pair && (
          <div className="text-[11px] text-text-dim mt-1.5 tabular-nums">
            Aligned days: <span className="text-text">{pair.n.toLocaleString()}</span> ·
            Correlation: <span className="text-text">{pair.correlation.toFixed(3)}</span> ·
            Beta ({a.meta.name} vs {b.meta.name}): <span className="text-text">{pair.betaAonB.toFixed(3)}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr] text-[12px]">
        <div className="px-5 py-2.5 text-text-faint uppercase tracking-[0.15em] text-[10px] border-b border-border">
          Metric
        </div>
        <div className="px-5 py-2.5 text-right border-b border-border">
          <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: COMPARE_COLORS.A_COLOR }} />
            <span className="text-text-faint">{a.meta.name}</span>
          </span>
        </div>
        <div className="px-5 py-2.5 text-right border-b border-border">
          <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: COMPARE_COLORS.B_COLOR }} />
            <span className="text-text-faint">{b.meta.name}</span>
          </span>
        </div>
        {rows.map((r) => {
          const aWins = r.higherIsBetter ? r.aNum > r.bNum : r.aNum < r.bNum;
          const bWins = r.higherIsBetter ? r.bNum > r.aNum : r.bNum < r.aNum;
          return (
            <div key={r.label} className="contents">
              <div className="px-5 py-2.5 text-text-dim border-t border-border">{r.label}</div>
              <div className={`px-5 py-2.5 text-right tabular-nums border-t border-border ${aWins ? "text-up" : "text-text"}`}>{r.aVal}</div>
              <div className={`px-5 py-2.5 text-right tabular-nums border-t border-border ${bWins ? "text-up" : "text-text"}`}>{r.bVal}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function years(d: Loaded): number {
  const data = d.data;
  return (new Date(data[data.length - 1].date).getTime() - new Date(data[0].date).getTime()) / (365.25 * 86400 * 1000);
}

// ── Volatility comparison block (KPI strip + full-width chart) ──────────────
function VolComparison({
  a,
  b,
  aSeries,
  bSeries,
}: {
  a: Loaded;
  b: Loaded;
  aSeries: { name: string; data: DailyRecord[]; color: string; light: string };
  bSeries: { name: string; data: DailyRecord[]; color: string; light: string };
}) {
  // Compute trailing 1-year vol from the last 252 daily returns
  const trailingVol = (d: Loaded) => {
    const r = d.data
      .slice(-252)
      .map((x) => x.pnl_percent)
      .filter((v): v is number => v !== null);
    if (r.length < 50) return d.stats.annualisedVol;
    const m = r.reduce((s, x) => s + x, 0) / r.length;
    const v = r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1);
    return Math.sqrt(v) * Math.sqrt(252);
  };
  const aRecentVol = trailingVol(a);
  const bRecentVol = trailingVol(b);
  const volSpread = aRecentVol - bRecentVol;
  const volRatio = aRecentVol / bRecentVol;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <VolStat
          label={`${a.meta.name} σ (1y)`}
          value={`${aRecentVol.toFixed(2)}%`}
          sub={`Lifetime: ${a.stats.annualisedVol.toFixed(2)}%`}
          color={COMPARE_COLORS.A_COLOR}
        />
        <VolStat
          label={`${b.meta.name} σ (1y)`}
          value={`${bRecentVol.toFixed(2)}%`}
          sub={`Lifetime: ${b.stats.annualisedVol.toFixed(2)}%`}
          color={COMPARE_COLORS.B_COLOR}
        />
        <VolStat
          label="Vol Spread (1y)"
          value={`${volSpread >= 0 ? "+" : ""}${volSpread.toFixed(2)} pts`}
          sub={`${a.meta.name} − ${b.meta.name}`}
          color={volSpread >= 0 ? COMPARE_COLORS.A_COLOR : COMPARE_COLORS.B_COLOR}
        />
        <VolStat
          label="Vol Ratio (1y)"
          value={`${volRatio.toFixed(2)}×`}
          sub={
            volRatio > 1
              ? `${a.meta.name} is ${((volRatio - 1) * 100).toFixed(0)}% more volatile`
              : `${b.meta.name} is ${((1 / volRatio - 1) * 100).toFixed(0)}% more volatile`
          }
          color="#ffffff"
        />
      </div>
      <ChartCard
        title="Rolling Volatility"
        subtitle="252-day annualised σ for both · dotted line = A−B spread on right axis"
        height={460}
      >
        <CompareVolatility a={aSeries} b={bSeries} />
      </ChartCard>
    </div>
  );
}

function VolStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-5">
      <div className="text-[10px] tracking-[0.2em] text-text-faint uppercase flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
      <div className="text-xs text-text-faint mt-1.5 tabular-nums">{sub}</div>
    </div>
  );
}
