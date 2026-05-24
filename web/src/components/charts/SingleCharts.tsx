"use client";

import { useMemo, useState } from "react";
import Plot from "../Plot";
import { COLORS, plotlyBase, plotlyConfig } from "@/lib/theme";
import type { DailyRecord } from "@/lib/types";

const ACCENT = COLORS.nifty;
const ACCENT_LIGHT = COLORS.niftyLight;

// ── 1. Price line ───────────────────────────────────────────────────────────
export function PriceChart({ data }: { data: DailyRecord[] }) {
  return (
    <Plot
      data={[
        {
          type: "scatter",
          mode: "lines",
          x: data.map((d) => d.date),
          y: data.map((d) => d.close),
          line: { color: ACCENT, width: 1.6 },
          fill: "tozeroy",
          fillcolor: "rgba(96, 165, 250, 0.06)",
          hovertemplate: "<b>%{x|%d %b %Y}</b><br>Close: %{y:,.2f}<extra></extra>",
        },
      ]}
      layout={{
        ...plotlyBase,
        hovermode: "x unified",
        yaxis: { ...plotlyBase.yaxis, title: { text: "Close" } },
        showlegend: false,
      }}
      config={plotlyConfig}
    />
  );
}

// ── 2. Cumulative return ────────────────────────────────────────────────────
export function CumulativeSingle({ data }: { data: DailyRecord[] }) {
  const valid = data.filter((d) => d.pnl_percent !== null);
  let cum = 1;
  const y = valid.map((d) => (cum *= 1 + (d.pnl_percent ?? 0) / 100));
  return (
    <Plot
      data={[
        {
          type: "scatter",
          mode: "lines",
          x: valid.map((d) => d.date),
          y,
          line: { color: ACCENT, width: 2 },
          hovertemplate: "<b>%{x|%d %b %Y}</b><br>Growth: %{y:.2f}x<extra></extra>",
        },
      ]}
      layout={{
        ...plotlyBase,
        hovermode: "x unified",
        yaxis: { ...plotlyBase.yaxis, title: { text: "Growth of ₹1" } },
        showlegend: false,
      }}
      config={plotlyConfig}
    />
  );
}

// ── 3. Distribution + bell curve ────────────────────────────────────────────
const N_BINS = 80;

function normalPdfScaled(x: number, mu: number, sigma: number, n: number, w: number) {
  const z = (x - mu) / sigma;
  return (n * w * Math.exp(-0.5 * z * z)) / (sigma * Math.sqrt(2 * Math.PI));
}

export function DistributionSingle({ data }: { data: DailyRecord[] }) {
  const returns = useMemo(
    () => data.map((d) => d.pnl_percent).filter((v): v is number => v !== null),
    [data]
  );
  const { mu, sigma, n, min, max, binWidth } = useMemo(() => {
    const n = returns.length;
    const mu = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1);
    const sigma = Math.sqrt(variance);
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    return { mu, sigma, n, min, max, binWidth: (max - min) / N_BINS };
  }, [returns]);

  const curveX: number[] = [];
  const curveY: number[] = [];
  const step = (max - min + 1) / 400;
  for (let x = min - 0.5; x <= max + 0.5; x += step) {
    curveX.push(x);
    curveY.push(normalPdfScaled(x, mu, sigma, n, binWidth));
  }

  const shapes: Array<Record<string, unknown>> = [
    { type: "rect", xref: "x", yref: "paper", x0: mu - sigma, x1: mu + sigma, y0: 0, y1: 1, fillcolor: "rgba(163,163,163,0.06)", line: { width: 0 } },
    { type: "line", xref: "x", yref: "paper", x0: mu, x1: mu, y0: 0, y1: 1, line: { color: COLORS.warn, width: 1.5, dash: "dash" } },
    { type: "line", xref: "x", yref: "paper", x0: mu - sigma, x1: mu - sigma, y0: 0, y1: 1, line: { color: COLORS.textDim, width: 1, dash: "dot" } },
    { type: "line", xref: "x", yref: "paper", x0: mu + sigma, x1: mu + sigma, y0: 0, y1: 1, line: { color: COLORS.textDim, width: 1, dash: "dot" } },
    { type: "line", xref: "x", yref: "paper", x0: mu - 2 * sigma, x1: mu - 2 * sigma, y0: 0, y1: 1, line: { color: COLORS.textFaint, width: 1, dash: "dot" } },
    { type: "line", xref: "x", yref: "paper", x0: mu + 2 * sigma, x1: mu + 2 * sigma, y0: 0, y1: 1, line: { color: COLORS.textFaint, width: 1, dash: "dot" } },
  ];

  const annotations = [
    { x: mu, y: 1.0, yref: "paper", text: `μ = ${mu.toFixed(3)}%`, showarrow: false, font: { color: COLORS.warn, size: 12 }, xanchor: "left" as const, yshift: -10 },
    { x: mu - sigma, y: 0, yref: "paper", text: `−1σ`, showarrow: false, font: { color: COLORS.textDim, size: 10 }, xanchor: "right" as const, yshift: 14 },
    { x: mu + sigma, y: 0, yref: "paper", text: `+1σ`, showarrow: false, font: { color: COLORS.textDim, size: 10 }, xanchor: "left" as const, yshift: 14 },
    { x: mu - 2 * sigma, y: 0, yref: "paper", text: `−2σ`, showarrow: false, font: { color: COLORS.textFaint, size: 10 }, xanchor: "right" as const, yshift: 14 },
    { x: mu + 2 * sigma, y: 0, yref: "paper", text: `+2σ`, showarrow: false, font: { color: COLORS.textFaint, size: 10 }, xanchor: "left" as const, yshift: 14 },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-3 flex gap-6 text-[11px] tabular-nums ml-auto">
        <span className="text-text-faint">μ <span className="text-text ml-1">{mu.toFixed(4)}%</span></span>
        <span className="text-text-faint">σ <span className="text-text ml-1">{sigma.toFixed(4)}%</span></span>
        <span className="text-text-faint">n <span className="text-text ml-1">{n}</span></span>
      </div>
      <div className="flex-1 min-h-0">
        <Plot
          data={[
            { type: "histogram", x: returns, nbinsx: N_BINS, marker: { color: ACCENT, opacity: 0.6 }, name: "Actual", hovertemplate: "Return: %{x:.2f}%<br>Days: %{y}<extra></extra>" },
            { type: "scatter", mode: "lines", x: curveX, y: curveY, name: "Normal fit", line: { color: ACCENT_LIGHT, width: 2.5 }, hovertemplate: "Return: %{x:.3f}%<br>Expected: %{y:.1f}<extra></extra>" },
          ]}
          layout={{
            ...plotlyBase,
            margin: { ...plotlyBase.margin, t: 20 },
            barmode: "overlay",
            xaxis: { ...plotlyBase.xaxis, title: { text: "Daily Return (%)" } },
            yaxis: { ...plotlyBase.yaxis, title: { text: "Number of Days" } },
            shapes,
            annotations,
            showlegend: true,
            legend: { ...plotlyBase.legend, x: 0.99, y: 0.99, xanchor: "right", yanchor: "top" },
          }}
          config={plotlyConfig}
        />
      </div>
    </div>
  );
}

// ── 4. Monthly heatmap ──────────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function HeatmapSingle({ data }: { data: DailyRecord[] }) {
  const { years, z } = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number }>();
    const yearsSet = new Set<number>();
    for (const d of data) {
      if (d.pnl_percent === null) continue;
      const dt = new Date(d.date);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      yearsSet.add(y);
      const key = `${y}-${m}`;
      const cur = buckets.get(key) ?? { sum: 0, count: 0 };
      cur.sum += d.pnl_percent;
      cur.count += 1;
      buckets.set(key, cur);
    }
    const years = [...yearsSet].sort();
    const z = years.map((y) =>
      MONTHS.map((_, m) => {
        const b = buckets.get(`${y}-${m}`);
        return b ? b.sum / b.count : null;
      })
    );
    return { years: years.map(String), z };
  }, [data]);

  return (
    <Plot
      data={[
        {
          type: "heatmap",
          z,
          x: MONTHS,
          y: years,
          colorscale: [
            [0.0, "#7f1d1d"],
            [0.35, "#ef4444"],
            [0.5, "#111111"],
            [0.65, "#22c55e"],
            [1.0, "#14532d"],
          ],
          zmid: 0,
          zmin: -3,
          zmax: 3,
          colorbar: { title: { text: "Avg %" }, ticksuffix: "%", tickfont: { size: 11, color: COLORS.textDim }, outlinewidth: 0 },
          hovertemplate: "<b>%{y} %{x}</b><br>Avg daily return: %{z:.3f}%<extra></extra>",
        },
      ]}
      layout={{
        ...plotlyBase,
        xaxis: { ...plotlyBase.xaxis, side: "top", type: "category" },
        yaxis: {
          ...plotlyBase.yaxis,
          autorange: "reversed",
          type: "category",
          tickmode: "array",
          tickvals: years,
          ticktext: years,
        },
      }}
      config={plotlyConfig}
    />
  );
}

// ── 5. Rolling volatility ───────────────────────────────────────────────────
export function VolatilitySingle({ data }: { data: DailyRecord[] }) {
  const ANN = Math.sqrt(252);
  const WINDOW = 252;
  const values = data.map((d) => d.pnl_percent);
  const x = data.map((d) => d.date);
  const y: (number | null)[] = new Array(values.length).fill(null);
  for (let i = WINDOW - 1; i < values.length; i++) {
    let sum = 0, sq = 0, c = 0;
    for (let j = i - WINDOW + 1; j <= i; j++) {
      const v = values[j];
      if (v === null) continue;
      sum += v;
      sq += v * v;
      c += 1;
    }
    if (c < WINDOW * 0.8) continue;
    const mean = sum / c;
    const variance = sq / c - mean * mean;
    y[i] = Math.sqrt(Math.max(variance, 0)) * ANN;
  }

  return (
    <Plot
      data={[
        {
          type: "scatter",
          mode: "lines",
          x,
          y,
          line: { color: ACCENT, width: 2 },
          hovertemplate: "<b>%{x|%d %b %Y}</b><br>Ann. Vol: %{y:.2f}%<extra></extra>",
        },
      ]}
      layout={{
        ...plotlyBase,
        hovermode: "x unified",
        yaxis: { ...plotlyBase.yaxis, title: { text: "Annualised Volatility (%)" } },
        showlegend: false,
      }}
      config={plotlyConfig}
    />
  );
}

// ── 6. Year-wise up/down ────────────────────────────────────────────────────
export function YearlySingle({ data }: { data: DailyRecord[] }) {
  const { years, up, down, flat } = useMemo(() => {
    const map = new Map<number, { up: number; down: number; flat: number }>();
    for (const d of data) {
      const y = new Date(d.date).getUTCFullYear();
      const cur = map.get(y) ?? { up: 0, down: 0, flat: 0 };
      if (d.direction === "Up") cur.up += 1;
      else if (d.direction === "Down") cur.down += 1;
      else cur.flat += 1;
      map.set(y, cur);
    }
    const years = [...map.keys()].sort();
    return {
      years: years.map(String),
      up: years.map((y) => map.get(y)!.up),
      down: years.map((y) => map.get(y)!.down),
      flat: years.map((y) => map.get(y)!.flat),
    };
  }, [data]);

  return (
    <Plot
      data={[
        { type: "bar", x: years, y: up, name: "Up", marker: { color: COLORS.up }, hovertemplate: "<b>%{x}</b><br>Up: %{y}<extra></extra>" },
        { type: "bar", x: years, y: down, name: "Down", marker: { color: COLORS.down }, hovertemplate: "<b>%{x}</b><br>Down: %{y}<extra></extra>" },
        { type: "bar", x: years, y: flat, name: "Flat", marker: { color: COLORS.flat }, hovertemplate: "<b>%{x}</b><br>Flat: %{y}<extra></extra>" },
      ]}
      layout={{
        ...plotlyBase,
        barmode: "stack",
        xaxis: { ...plotlyBase.xaxis, title: { text: "Year" } },
        yaxis: { ...plotlyBase.yaxis, title: { text: "Trading days" } },
        showlegend: true,
        legend: { ...plotlyBase.legend, orientation: "h", x: 0, y: -0.15 },
      }}
      config={plotlyConfig}
    />
  );
}

// ── 7. Best & worst days ────────────────────────────────────────────────────
type Mode = "best" | "worst";

export function ExtremesSingle({ data }: { data: DailyRecord[] }) {
  const [mode, setMode] = useState<Mode>("best");
  const filtered = data.filter((d) => d.pnl_percent !== null) as (DailyRecord & { pnl_percent: number })[];
  const sorted = [...filtered].sort((a, b) =>
    mode === "best" ? b.pnl_percent - a.pnl_percent : a.pnl_percent - b.pnl_percent
  );
  const rows = sorted.slice(0, 15).reverse();
  const color = mode === "best" ? COLORS.up : COLORS.down;

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-3 flex items-center gap-2 text-xs">
        <div className="text-text-faint uppercase tracking-[0.15em] text-[10px] mr-2">Show</div>
        {(["best", "worst"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 rounded border text-[11px] transition-colors capitalize ${
              mode === m
                ? "bg-panel-2 border-border-strong text-text"
                : "border-border text-text-faint hover:text-text-dim"
            }`}
          >
            {m} 15
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <Plot
          data={[
            {
              type: "bar",
              orientation: "h",
              x: rows.map((r) => r.pnl_percent),
              y: rows.map((r) => new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })),
              marker: { color },
              hovertemplate: "<b>%{y}</b><br>Return: %{x:.2f}%<extra></extra>",
            },
          ]}
          layout={{
            ...plotlyBase,
            margin: { ...plotlyBase.margin, t: 20, l: 110 },
            xaxis: { ...plotlyBase.xaxis, title: { text: "Daily Return (%)" }, ticksuffix: "%" },
            yaxis: { ...plotlyBase.yaxis, automargin: true },
            showlegend: false,
          }}
          config={plotlyConfig}
        />
      </div>
    </div>
  );
}
