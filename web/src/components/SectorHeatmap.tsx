"use client";

import { useMemo, useState } from "react";
import Plot from "./Plot";
import { COLORS, plotlyBase, plotlyConfig } from "@/lib/theme";
import type { PeriodKey, SectorRow } from "@/lib/types";

const PERIODS: { label: string; value: PeriodKey }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "All", value: "All" },
];

// Color-scale bounds per period. Clipped so a tile reaches max saturation at
// a level that's meaningful for the timeframe.
const BOUNDS: Record<PeriodKey, number> = {
  "1D": 5,
  "1W": 10,
  "1M": 15,
  "3M": 25,
  "YTD": 50,
  "1Y": 50,
  "5Y": 200,
  "All": 500,
};

const COLORSCALE: Array<[number, string]> = [
  [0.0, "#7f1d1d"],
  [0.4, "#ef4444"],
  [0.5, "#1a1a1a"],
  [0.6, "#22c55e"],
  [1.0, "#14532d"],
];

export default function SectorHeatmap({ rows }: { rows: SectorRow[] }) {
  const [period, setPeriod] = useState<PeriodKey>("1Y");

  const { plotData, asOf, stats } = useMemo(() => {
    // Group stocks by sector
    const bySector = new Map<string, SectorRow[]>();
    for (const r of rows) {
      const list = bySector.get(r.category) ?? [];
      list.push(r);
      bySector.set(r.category, list);
    }
    // Order: Index Funds first (if present), then alphabetical
    const sectors = [...bySector.keys()].sort((a, b) => {
      if (a === "Index Funds") return -1;
      if (b === "Index Funds") return 1;
      return a.localeCompare(b);
    });

    // Build treemap arrays. Sector nodes get their stock-count as value
    // (so branchvalues="total" lines up with the leaves). Sectors are
    // assigned 0 in the color array → maps to neutral black at cmid=0.
    const labels: string[] = [];
    const ids: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];
    const colors: number[] = [];
    const customdata: Array<[string, number | null, number]> = []; // [name, return, lastClose]

    for (const sector of sectors) {
      const stocks = bySector.get(sector)!;
      labels.push(sector);
      ids.push(sector);
      parents.push("");
      values.push(stocks.length);
      colors.push(0);
      customdata.push([sector, null, 0]);

      for (const s of stocks) {
        const ret = s.returns[period];
        labels.push(s.symbol);
        ids.push(`${sector}/${s.symbol}`);
        parents.push(sector);
        values.push(1);
        colors.push(ret ?? 0);
        customdata.push([s.name, ret, s.last_close]);
      }
    }

    // Summary stats for header strip
    const stockRows = rows.filter((r) => r.type === "stock");
    const rets = stockRows
      .map((r) => r.returns[period])
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const winners = rets.filter((v) => v > 0).length;
    const losers = rets.filter((v) => v < 0).length;
    const median = (() => {
      if (!rets.length) return 0;
      const sorted = [...rets].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    })();

    return {
      plotData: { labels, ids, parents, values, colors, customdata },
      asOf: rows[0]?.symbol ? null : null, // anchored per-asset; no global "as of"
      stats: { winners, losers, median, total: rets.length },
    };
  }, [rows, period]);

  const bound = BOUNDS[period];

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

        <div className="text-[11px] text-text-faint tabular-nums">
          <span className="text-up">{stats.winners} up</span>
          {" · "}
          <span className="text-down">{stats.losers} down</span>
          {" · "}
          median{" "}
          <span className={stats.median >= 0 ? "text-up" : "text-down"}>
            {stats.median >= 0 ? "+" : ""}
            {stats.median.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-lg overflow-hidden" style={{ height: 720 }}>
        <Plot
          data={[
            {
              type: "treemap",
              labels: plotData.labels,
              ids: plotData.ids,
              parents: plotData.parents,
              values: plotData.values,
              branchvalues: "total",
              customdata: plotData.customdata,
              text: plotData.customdata.map(([, ret]) =>
                ret === null ? "" : `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%`
              ),
              textinfo: "label+text",
              textfont: { color: "#fafafa", size: 13 },
              hovertemplate:
                "<b>%{label}</b><br>%{customdata[0]}<br>" +
                period +
                " return: %{customdata[1]:.2f}%<br>Last close: ₹%{customdata[2]:,.2f}<extra></extra>",
              marker: {
                colors: plotData.colors,
                colorscale: COLORSCALE,
                cmid: 0,
                cmin: -bound,
                cmax: bound,
                line: { color: COLORS.bg, width: 2 },
                showscale: false,
              },
              tiling: { packing: "squarify", pad: 2 },
              pathbar: { visible: false },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ]}
          layout={{
            ...plotlyBase,
            margin: { l: 0, r: 0, t: 0, b: 0 },
            paper_bgcolor: COLORS.panel,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config={plotlyConfig as any}
        />
      </div>

      <div className="mt-3 text-[10px] text-text-faint">
        Tiles are equal-sized per stock (sector tiles size by stock count). Color saturates at ±{bound}% for this period.
      </div>
    </div>
  );
}
