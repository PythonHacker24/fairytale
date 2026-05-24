"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Plot from "./Plot";
import { COLORS, plotlyBase, plotlyConfig } from "@/lib/theme";
import { loadAssetManifest, loadCorrelations } from "@/lib/data";
import type { AssetMeta, CorrPair, CorrPeriod } from "@/lib/types";

const PERIODS: { label: string; value: CorrPeriod }[] = [
  { label: "1Y", value: "1Y" },
  { label: "3Y", value: "3Y" },
  { label: "5Y", value: "5Y" },
  { label: "All", value: "All" },
];

// Diverging: red for negative correlation, panel-dark at zero, blue for positive.
const COLORSCALE: Array<[number, string]> = [
  [0.0, "#7f1d1d"],
  [0.35, "#ef4444"],
  [0.5, "#0a0a0a"],
  [0.65, "#60a5fa"],
  [1.0, "#1e3a8a"],
];

export default function CorrelationMatrix() {
  const [period, setPeriod] = useState<CorrPeriod>("1Y");
  const [manifest, setManifest] = useState<AssetMeta[] | null>(null);
  const [pairs, setPairs] = useState<CorrPair[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssetManifest().then(setManifest).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    setPairs(null);
    loadCorrelations(period)
      .then(setPairs)
      .catch((e) => setError(String(e)));
  }, [period]);

  const view = useMemo(() => {
    if (!manifest || !pairs) return null;

    // Order assets: Index Funds first, then sectors alphabetically, symbol alphabetical within.
    const ordered = [...manifest].sort((a, b) => {
      if (a.category === "Index Funds" && b.category !== "Index Funds") return -1;
      if (b.category === "Index Funds" && a.category !== "Index Funds") return 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.symbol.localeCompare(b.symbol);
    });

    const idToIdx = new Map(ordered.map((a, i) => [a.id, i]));
    const n = ordered.length;
    const labels = ordered.map((a) => a.symbol);

    // Initialize matrix with NaN (Plotly renders these as gaps)
    const z: (number | null)[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => null)
    );
    // Diagonal = 1
    for (let i = 0; i < n; i++) z[i][i] = 1;

    for (const p of pairs) {
      const i = idToIdx.get(p.a_id);
      const j = idToIdx.get(p.b_id);
      if (i === undefined || j === undefined) continue;
      z[i][j] = p.corr;
      z[j][i] = p.corr;
    }

    // Sector boundaries for visual dividers (lines between sectors)
    const dividers: number[] = [];
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].category !== ordered[i - 1].category) dividers.push(i - 0.5);
    }

    // Top positive / negative pairs (excluding self)
    const ranked = [...pairs].sort((a, b) => b.corr - a.corr);
    const topPositive = ranked.slice(0, 5);
    const topNegative = ranked.slice(-5).reverse();

    const meanCorr =
      pairs.length === 0
        ? 0
        : pairs.reduce((s, p) => s + p.corr, 0) / pairs.length;

    return { ordered, idToIdx, labels, z, dividers, topPositive, topNegative, meanCorr };
  }, [manifest, pairs]);

  if (error) {
    return (
      <div className="bg-panel border border-border rounded-lg p-6 text-sm">
        <div className="text-down mb-1">Failed to load</div>
        <div className="text-text-dim text-xs">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="inline-flex bg-panel border border-border rounded overflow-hidden">
          {PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-[11px] tabular-nums transition-colors border-r last:border-r-0 border-border ${
                  active ? "bg-panel-2 text-text" : "text-text-faint hover:text-text-dim"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {view && (
          <div className="text-[11px] text-text-faint tabular-nums">
            {view.ordered.length} assets · {pairs?.length.toLocaleString()} pairs · mean ρ{" "}
            <span className="text-text">{view.meanCorr.toFixed(3)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
        <div
          className="bg-panel border border-border rounded-lg overflow-hidden"
          style={{ height: 760 }}
        >
          {!view ? (
            <div className="h-full grid place-items-center text-text-faint text-xs">
              Computing correlations…
            </div>
          ) : (
            <Plot
              data={[
                {
                  type: "heatmap",
                  z: view.z,
                  x: view.labels,
                  y: view.labels,
                  colorscale: COLORSCALE,
                  zmid: 0,
                  zmin: -1,
                  zmax: 1,
                  hovertemplate:
                    "<b>%{y} vs %{x}</b><br>ρ = %{z:.3f}<extra></extra>",
                  colorbar: {
                    title: { text: "ρ" },
                    tickfont: { size: 10, color: COLORS.textDim },
                    outlinewidth: 0,
                    thickness: 12,
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
              ]}
              layout={{
                ...plotlyBase,
                margin: { l: 80, r: 30, t: 30, b: 80 },
                xaxis: {
                  ...plotlyBase.xaxis,
                  type: "category",
                  tickfont: { size: 9, color: COLORS.textDim },
                  tickangle: -60,
                  showgrid: false,
                },
                yaxis: {
                  ...plotlyBase.yaxis,
                  type: "category",
                  autorange: "reversed",
                  tickfont: { size: 9, color: COLORS.textDim },
                  showgrid: false,
                },
                shapes: view.dividers.flatMap((d) => [
                  {
                    type: "line",
                    x0: d,
                    x1: d,
                    y0: -0.5,
                    y1: view.ordered.length - 0.5,
                    line: { color: COLORS.bg, width: 1 },
                  },
                  {
                    type: "line",
                    x0: -0.5,
                    x1: view.ordered.length - 0.5,
                    y0: d,
                    y1: d,
                    line: { color: COLORS.bg, width: 1 },
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ]) as any,
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              config={plotlyConfig as any}
            />
          )}
        </div>

        <div className="space-y-5">
          {view && (
            <>
              <PairList
                title="Most correlated"
                pairs={view.topPositive}
                manifest={manifest!}
              />
              <PairList
                title="Least correlated"
                pairs={view.topNegative}
                manifest={manifest!}
              />
            </>
          )}
        </div>
      </div>

      <div className="mt-3 text-[10px] text-text-faint">
        Pearson correlation of daily returns. Sectors separated by faint lines. Click a pair on the right to open it in Compare.
      </div>
    </div>
  );
}

function PairList({
  title,
  pairs,
  manifest,
}: {
  title: string;
  pairs: CorrPair[];
  manifest: AssetMeta[];
}) {
  const byId = new Map(manifest.map((m) => [m.id, m]));
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="text-[10px] tracking-[0.2em] text-text-faint uppercase mb-2">
        {title}
      </div>
      <ul className="space-y-1">
        {pairs.map((p) => {
          const a = byId.get(p.a_id);
          const b = byId.get(p.b_id);
          if (!a || !b) return null;
          const valueColor = p.corr < 0 ? "text-down" : "text-nifty";
          return (
            <li key={`${p.a_id}-${p.b_id}`}>
              <Link
                href={`/compare?a=${a.slug}&b=${b.slug}`}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-panel-2 transition-colors"
              >
                <span className="text-[11px] text-text-dim truncate">
                  {a.symbol} <span className="text-text-faint">vs</span> {b.symbol}
                </span>
                <span className={`text-[11px] tabular-nums shrink-0 ${valueColor}`}>
                  {p.corr >= 0 ? "+" : ""}
                  {p.corr.toFixed(3)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
