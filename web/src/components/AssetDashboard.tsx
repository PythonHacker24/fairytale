"use client";

import { useEffect, useMemo, useState } from "react";
import StatCard from "./StatCard";
import ChartCard from "./ChartCard";
import {
  PriceChart,
  CumulativeSingle,
  DistributionSingle,
  HeatmapSingle,
  VolatilitySingle,
  YearlySingle,
  ExtremesSingle,
} from "./charts/SingleCharts";
import { loadAssetDaily, loadAssetManifest } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import type { AssetMeta, DailyRecord } from "@/lib/types";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtNum(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function AssetDashboard({ slug }: { slug: string }) {
  const [data, setData] = useState<DailyRecord[] | null>(null);
  const [meta, setMeta] = useState<AssetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    Promise.all([loadAssetDaily(slug), loadAssetManifest()])
      .then(([rows, manifest]) => {
        setData(rows);
        setMeta(manifest.find((c) => c.slug === slug) ?? null);
      })
      .catch((e) => setError(String(e)));
  }, [slug]);

  const stats = useMemo(() => (data ? computeStats(data) : null), [data]);

  if (error) {
    return (
      <div className="p-10">
        <div className="bg-panel border border-border rounded-lg p-6 text-sm">
          <div className="text-down mb-1">Failed to load</div>
          <div className="text-text-dim text-xs">{error}</div>
        </div>
      </div>
    );
  }

  if (!data || !stats) {
    return (
      <div className="p-10">
        <div className="grid grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[100px] bg-panel border border-border rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-[400px] bg-panel border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  const isIndex = meta?.type === "index";
  const currencyPrefix = isIndex ? "" : "₹";
  const priceLabel = isIndex ? "Latest Value" : "Last Close";

  const totalReturn = (stats.cumulativeReturn - 1) * 100;
  const years = (new Date(data[data.length - 1].date).getTime() - new Date(data[0].date).getTime()) / (365.25 * 86400 * 1000);
  const cagr = (Math.pow(stats.cumulativeReturn, 1 / years) - 1) * 100;
  const priceChange = stats.lastClose - stats.firstClose;
  const priceChangePct = (priceChange / stats.firstClose) * 100;

  return (
    <>
      <div className="px-10 pt-10 pb-6 border-b border-border">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] tracking-[0.2em] text-text-faint uppercase">
              {meta?.category ?? ""} {isIndex && "· Index"}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">{meta?.name ?? slug}</h1>
            <div className="text-xs text-text-dim mt-1 tabular-nums">
              {meta?.symbol}
              {!isIndex && ".NS"} · {fmtDate(data[0].date)} → {fmtDate(data[data.length - 1].date)} · {stats.total.toLocaleString()} trading days
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-text-faint tracking-[0.18em] uppercase">{priceLabel}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {currencyPrefix}{fmtNum(stats.lastClose)}
            </div>
            <div className={`text-xs tabular-nums mt-0.5 ${priceChange >= 0 ? "text-up" : "text-down"}`}>
              {priceChange >= 0 ? "+" : ""}
              {currencyPrefix}{fmtNum(priceChange)} ({priceChangePct >= 0 ? "+" : ""}
              {priceChangePct.toFixed(2)}% all-time)
            </div>
          </div>
        </div>
      </div>

      <div className="p-10 space-y-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Return"
            value={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`}
            sub={`${stats.cumulativeReturn.toFixed(2)}× growth`}
            tone={totalReturn >= 0 ? "up" : "down"}
          />
          <StatCard
            label="CAGR"
            value={`${cagr >= 0 ? "+" : ""}${cagr.toFixed(2)}%`}
            sub={`Over ${years.toFixed(1)} years`}
            tone={cagr >= 0 ? "up" : "down"}
          />
          <StatCard
            label="Up Day %"
            value={`${stats.upPercent.toFixed(1)}%`}
            sub={`${stats.up} up · ${stats.down} down`}
            tone={stats.upPercent >= 50 ? "up" : "down"}
          />
          <StatCard
            label="Avg Daily Return"
            value={`${stats.meanDaily >= 0 ? "+" : ""}${stats.meanDaily.toFixed(3)}%`}
            sub={`σ = ${stats.stdDaily.toFixed(3)}% (daily)`}
            tone={stats.meanDaily >= 0 ? "up" : "down"}
          />
          <StatCard
            label="Annualised σ"
            value={`${stats.annualisedVol.toFixed(2)}%`}
            sub="Volatility (σ × √252)"
          />
          <StatCard
            label="Best Day"
            value={`+${stats.bestDay.pct.toFixed(2)}%`}
            sub={fmtDate(stats.bestDay.date)}
            tone="up"
          />
          <StatCard
            label="Worst Day"
            value={`${stats.worstDay.pct.toFixed(2)}%`}
            sub={fmtDate(stats.worstDay.date)}
            tone="down"
          />
          <StatCard
            label="Longest Streaks"
            value={`${stats.longestUpStreak} / ${stats.longestDownStreak}`}
            sub="up / down (days)"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Price History" subtitle="Daily close" height={380}>
            <PriceChart data={data} />
          </ChartCard>
          <ChartCard title="Growth of ₹1" subtitle="Cumulative compounded return" height={380}>
            <CumulativeSingle data={data} />
          </ChartCard>
        </div>

        <ChartCard
          title="Return Distribution"
          subtitle="Daily return histogram with normal-distribution fit · μ, σ, ±1σ, ±2σ marked"
          height={500}
        >
          <DistributionSingle data={data} />
        </ChartCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Rolling Volatility" subtitle="252-day annualised σ" height={400}>
            <VolatilitySingle data={data} />
          </ChartCard>
          <ChartCard title="Year Breakdown" subtitle="Up / down / flat trading days per year" height={400}>
            <YearlySingle data={data} />
          </ChartCard>
        </div>

        <ChartCard title="Monthly Heatmap" subtitle="Average daily return by month × year" height={520}>
          <HeatmapSingle data={data} />
        </ChartCard>

        <ChartCard title="Extreme Days" subtitle="Top 15 best or worst single-day moves" height={520}>
          <ExtremesSingle data={data} />
        </ChartCard>
      </div>
    </>
  );
}
