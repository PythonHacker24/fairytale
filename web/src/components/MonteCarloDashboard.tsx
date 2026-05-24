"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AssetPicker from "./AssetPicker";
import StatCard from "./StatCard";
import ChartCard from "./ChartCard";
import { FanChart, FinalDistribution } from "./charts/MonteCarloCharts";
import MonteCarloTheory from "./MonteCarloTheory";
import { loadAssetDaily, loadAssetManifest } from "@/lib/data";
import { simulate, type MCInputs, type Method, type MCResult } from "@/lib/montecarlo";
import { COLORS } from "@/lib/theme";
import type { AssetMeta, DailyRecord } from "@/lib/types";

const HORIZONS: { label: string; days: number }[] = [
  { label: "1M", days: 21 },
  { label: "3M", days: 63 },
  { label: "6M", days: 126 },
  { label: "1Y", days: 252 },
  { label: "2Y", days: 504 },
  { label: "5Y", days: 1260 },
];

const PATH_COUNTS = [500, 1000, 2500, 5000, 10000];

const LOOKBACKS: { label: string; value: number | "all" }[] = [
  { label: "Last 1Y", value: 252 },
  { label: "Last 3Y", value: 756 },
  { label: "All", value: "all" },
];

const DEFAULT_ASSET = "NIFTY50";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
}
function fmtPct(n: number, d = 1) {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(d)}%`;
}

export default function MonteCarloDashboard() {
  const router = useRouter();
  const search = useSearchParams();
  const [manifest, setManifest] = useState<AssetMeta[] | null>(null);
  const [slug, setSlug] = useState(search.get("asset") ?? DEFAULT_ASSET);
  const [data, setData] = useState<DailyRecord[] | null>(null);
  const [meta, setMeta] = useState<AssetMeta | null>(null);

  // Controls
  const [horizonDays, setHorizonDays] = useState(252);
  const [paths, setPaths] = useState(2500);
  const [method, setMethod] = useState<Method>("gbm");
  const [lookback, setLookback] = useState<number | "all">("all");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  // Load manifest
  useEffect(() => {
    loadAssetManifest().then(setManifest).catch(() => setManifest([]));
  }, []);

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("asset", slug);
    router.replace(`/montecarlo?${params.toString()}`, { scroll: false });
  }, [slug, router]);

  // Load data when asset changes
  useEffect(() => {
    if (!manifest) return;
    setData(null);
    setMeta(manifest.find((m) => m.slug === slug) ?? null);
    loadAssetDaily(slug).then(setData);
  }, [slug, manifest]);

  // Run simulation (memoized on all relevant deps + seed)
  const result: MCResult | null = useMemo(() => {
    if (!data || data.length < 30) return null;
    const inputs: MCInputs = {
      s0: data[data.length - 1].close,
      daily: data,
      lookbackDays: lookback,
      daysAhead: horizonDays,
      paths,
      method,
      seed,
    };
    return simulate(inputs);
  }, [data, lookback, horizonDays, paths, method, seed]);

  if (!manifest) {
    return <div className="p-10 text-text-faint text-xs">Loading…</div>;
  }

  const isIndex = meta?.type === "index";
  const currency = isIndex ? "" : "₹";
  const lastDate = data && data.length > 0 ? new Date(data[data.length - 1].date) : new Date();

  return (
    <>
      <div className="px-10 pt-10 pb-6 border-b border-border">
        <div className="text-[11px] tracking-[0.2em] text-text-faint uppercase">Monte Carlo</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Forward simulation</h1>
        <p className="text-sm text-text-dim mt-1">
          Simulate thousands of plausible future paths from historical statistics.
        </p>

        {/* Controls */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-end">
          <AssetPicker
            assets={manifest}
            value={slug}
            onChange={setSlug}
            label="Asset"
            color={COLORS.nifty}
          />

          <ControlGroup label="Horizon">
            <SegmentedSmall<number>
              options={HORIZONS.map((h) => ({ label: h.label, value: h.days }))}
              value={horizonDays}
              onChange={setHorizonDays}
            />
          </ControlGroup>

          <ControlGroup label="Paths">
            <SegmentedSmall<number>
              options={PATH_COUNTS.map((p) => ({ label: p >= 1000 ? `${p / 1000}k` : `${p}`, value: p }))}
              value={paths}
              onChange={setPaths}
            />
          </ControlGroup>

          <ControlGroup label="Method">
            <SegmentedSmall<Method>
              options={[
                { label: "GBM", value: "gbm" },
                { label: "Bootstrap", value: "bootstrap" },
              ]}
              value={method}
              onChange={setMethod}
            />
          </ControlGroup>

          <button
            onClick={() => setSeed(Math.floor(Math.random() * 1e9))}
            className="bg-panel border border-border-strong hover:border-text rounded px-4 py-2 text-[12px] text-text transition-colors h-fit"
            title="Re-run with a new random seed"
          >
            ↻ Re-roll
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 text-[11px] text-text-faint tabular-nums">
          <span>Lookback for estimating μ, σ:</span>
          <SegmentedSmall<number | "all">
            options={LOOKBACKS.map((l) => ({ label: l.label, value: l.value }))}
            value={lookback}
            onChange={setLookback}
          />
          {result && (
            <span className="ml-auto">
              μ <span className="text-text">{result.summary.fittedMu.toFixed(4)}%/day</span>
              {" · "}σ <span className="text-text">{result.summary.fittedSigma.toFixed(3)}%/day</span>
              {" · "}seed <span className="text-text">{seed}</span>
            </span>
          )}
        </div>
      </div>

      {!data || !result ? (
        <div className="p-10 text-text-faint text-xs">Loading data…</div>
      ) : (
        <div className="p-10 space-y-10">
          {/* Header info */}
          <div className="text-[12px] text-text-dim">
            Simulating <span className="text-text">{meta?.name}</span> from {lastDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            {" "}forward {result.inputs.daysAhead} trading days
            {" "}({(result.inputs.daysAhead / 252).toFixed(2)} years) · {result.inputs.paths.toLocaleString()} paths.
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Starting Price"
              value={`${currency}${fmt(result.inputs.s0)}`}
              sub={`As of ${lastDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
            />
            <StatCard
              label="Median Outcome"
              value={`${currency}${fmt(result.summary.median)}`}
              sub={`${fmtPct((result.summary.median - result.inputs.s0) / result.inputs.s0)} total · CAGR ${fmtPct(result.summary.cagrMedian)}`}
              tone={result.summary.median >= result.inputs.s0 ? "up" : "down"}
            />
            <StatCard
              label="5th–95th Range"
              value={`${currency}${fmt(result.summary.p5)} – ${currency}${fmt(result.summary.p95)}`}
              sub={`CAGR ${fmtPct(result.summary.cagrP5)} to ${fmtPct(result.summary.cagrP95)}`}
            />
            <StatCard
              label="Expected (mean)"
              value={`${currency}${fmt(result.summary.mean)}`}
              sub={`σ = ${currency}${fmt(result.summary.std)}`}
            />
            <StatCard
              label="P(Loss)"
              value={`${(result.summary.probLoss * 100).toFixed(1)}%`}
              sub={`Probability final < start`}
              tone={result.summary.probLoss > 0.5 ? "down" : "neutral"}
            />
            <StatCard
              label="P(≥ +10%)"
              value={`${(result.summary.probGain10 * 100).toFixed(1)}%`}
              sub={`Probability of ≥10% gain`}
              tone={result.summary.probGain10 > 0.5 ? "up" : "neutral"}
            />
            <StatCard
              label="P(≥ 2×)"
              value={`${(result.summary.probDouble * 100).toFixed(2)}%`}
              sub={`Probability of doubling`}
              tone={result.summary.probDouble > 0.05 ? "up" : "neutral"}
            />
            <StatCard
              label="25th–75th Range"
              value={`${currency}${fmt(result.summary.p25)} – ${currency}${fmt(result.summary.p75)}`}
              sub="Interquartile range (middle 50%)"
            />
          </div>

          <ChartCard
            title="Forecast Fan"
            subtitle={`${result.samplePaths.length} sample paths + 5/25/50/75/95 percentile bands`}
            height={520}
          >
            <FanChart result={result} startDate={lastDate} s0={result.inputs.s0} isIndex={!!isIndex} />
          </ChartCard>

          <ChartCard
            title="Final Price Distribution"
            subtitle="Distribution of ending prices across all simulated paths"
            height={460}
          >
            <FinalDistribution result={result} s0={result.inputs.s0} isIndex={!!isIndex} />
          </ChartCard>

          <MonteCarloTheory />
        </div>
      )}
    </>
  );
}

// ── tiny segmented control ────────────────────────────────────────────────
function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] text-text-faint uppercase mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function SegmentedSmall<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex bg-panel border border-border rounded overflow-hidden">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-[11px] tabular-nums transition-colors border-r last:border-r-0 border-border ${
              active
                ? "bg-panel-2 text-text"
                : "text-text-faint hover:text-text-dim"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
