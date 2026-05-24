"use client";

import Plot from "../Plot";
import { COLORS, plotlyBase, plotlyConfig } from "@/lib/theme";
import type { MCResult } from "@/lib/montecarlo";
import { projectDates } from "@/lib/montecarlo";

// ── Fan chart ───────────────────────────────────────────────────────────────
export function FanChart({
  result,
  startDate,
  s0,
  isIndex,
}: {
  result: MCResult;
  startDate: Date;
  s0: number;
  isIndex: boolean;
}) {
  const dates = projectDates(startDate, result.inputs.daysAhead);
  const prefix = isIndex ? "" : "₹";

  const findBand = (p: number) => result.bands.find((b) => Math.abs(b.p - p) < 1e-6)!;
  const p5 = findBand(0.05).values;
  const p25 = findBand(0.25).values;
  const p50 = findBand(0.5).values;
  const p75 = findBand(0.75).values;
  const p95 = findBand(0.95).values;

  return (
    <Plot
      data={[
        // Sample paths (faint)
        ...result.samplePaths.map((path) => ({
          type: "scatter" as const,
          mode: "lines" as const,
          x: dates,
          y: path,
          line: { color: COLORS.nifty, width: 0.5 },
          opacity: 0.08,
          hoverinfo: "skip" as const,
          showlegend: false,
        })),
        // 5–95 band
        {
          type: "scatter",
          mode: "lines",
          x: dates,
          y: Array.from(p95),
          line: { width: 0 },
          name: "95th",
          hoverinfo: "skip",
          showlegend: false,
        },
        {
          type: "scatter",
          mode: "lines",
          x: dates,
          y: Array.from(p5),
          line: { width: 0 },
          fill: "tonexty",
          fillcolor: "rgba(96, 165, 250, 0.08)",
          name: "5th–95th",
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>5th: ${prefix}%{y:,.2f}<extra></extra>`,
        },
        // 25–75 band
        {
          type: "scatter",
          mode: "lines",
          x: dates,
          y: Array.from(p75),
          line: { width: 0 },
          name: "75th",
          hoverinfo: "skip",
          showlegend: false,
        },
        {
          type: "scatter",
          mode: "lines",
          x: dates,
          y: Array.from(p25),
          line: { width: 0 },
          fill: "tonexty",
          fillcolor: "rgba(96, 165, 250, 0.18)",
          name: "25th–75th",
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>25th: ${prefix}%{y:,.2f}<extra></extra>`,
        },
        // Median line
        {
          type: "scatter",
          mode: "lines",
          x: dates,
          y: Array.from(p50),
          line: { color: COLORS.niftyLight, width: 2 },
          name: "Median",
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>Median: ${prefix}%{y:,.2f}<extra></extra>`,
        },
        // Starting price reference
        {
          type: "scatter",
          mode: "lines",
          x: [dates[0], dates[dates.length - 1]],
          y: [s0, s0],
          line: { color: COLORS.warn, width: 1, dash: "dash" },
          name: `Start ${prefix}${s0.toFixed(2)}`,
          hoverinfo: "skip",
        },
      ]}
      layout={{
        ...plotlyBase,
        hovermode: "x unified",
        yaxis: { ...plotlyBase.yaxis, title: { text: isIndex ? "Index Value" : "Price (₹)" } },
        showlegend: true,
        legend: { ...plotlyBase.legend, orientation: "h", x: 0, y: 1.1 },
      }}
      config={plotlyConfig}
    />
  );
}

// ── Final-price distribution ────────────────────────────────────────────────
export function FinalDistribution({
  result,
  s0,
  isIndex,
}: {
  result: MCResult;
  s0: number;
  isIndex: boolean;
}) {
  const prefix = isIndex ? "" : "₹";
  const finals = Array.from(result.finalPrices);

  return (
    <Plot
      data={[
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {
          type: "histogram",
          x: finals,
          nbinsx: 80,
          marker: { color: COLORS.nifty, opacity: 0.65 },
          name: "Final price",
          hovertemplate: `Final: ${prefix}%{x:,.2f}<br>Paths: %{y}<extra></extra>`,
        } as any,
      ]}
      layout={{
        ...plotlyBase,
        xaxis: { ...plotlyBase.xaxis, title: { text: `Final ${isIndex ? "value" : "price"} after ${result.inputs.daysAhead} days` } },
        yaxis: { ...plotlyBase.yaxis, title: { text: "Number of paths" } },
        shapes: [
          // starting price
          { type: "line", xref: "x", yref: "paper", x0: s0, x1: s0, y0: 0, y1: 1, line: { color: COLORS.warn, width: 1.5, dash: "dash" } },
          // median
          { type: "line", xref: "x", yref: "paper", x0: result.summary.median, x1: result.summary.median, y0: 0, y1: 1, line: { color: COLORS.niftyLight, width: 1.5 } },
          // p5
          { type: "line", xref: "x", yref: "paper", x0: result.summary.p5, x1: result.summary.p5, y0: 0, y1: 1, line: { color: COLORS.down, width: 1, dash: "dot" } },
          // p95
          { type: "line", xref: "x", yref: "paper", x0: result.summary.p95, x1: result.summary.p95, y0: 0, y1: 1, line: { color: COLORS.up, width: 1, dash: "dot" } },
        ],
        annotations: [
          { x: s0, y: 1, yref: "paper", text: `Start ${prefix}${s0.toFixed(2)}`, showarrow: false, font: { color: COLORS.warn, size: 11 }, xanchor: "left", yshift: -10 },
          { x: result.summary.median, y: 1, yref: "paper", text: `Median ${prefix}${result.summary.median.toFixed(2)}`, showarrow: false, font: { color: COLORS.niftyLight, size: 11 }, xanchor: "left", yshift: -28 },
          { x: result.summary.p5, y: 0, yref: "paper", text: `5th`, showarrow: false, font: { color: COLORS.down, size: 10 }, xanchor: "right", yshift: 14 },
          { x: result.summary.p95, y: 0, yref: "paper", text: `95th`, showarrow: false, font: { color: COLORS.up, size: 10 }, xanchor: "left", yshift: 14 },
        ],
        showlegend: false,
      }}
      config={plotlyConfig}
    />
  );
}
