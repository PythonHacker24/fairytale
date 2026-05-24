"use client";

import { useMemo } from "react";
import Plot from "../Plot";
import { COLORS, plotlyBase, plotlyConfig } from "@/lib/theme";
import type { DailyRecord } from "@/lib/types";
import { pairStats, type AlignedReturns } from "@/lib/correlation";

const A_COLOR = COLORS.nifty;
const A_LIGHT = COLORS.niftyLight;
const B_COLOR = COLORS.sensex;
const B_LIGHT = COLORS.sensexLight;

type SeriesIn = { name: string; data: DailyRecord[]; color: string; light: string };

function cumulative(data: DailyRecord[]) {
  const valid = data.filter((d) => d.pnl_percent !== null);
  let c = 1;
  return {
    x: valid.map((d) => d.date),
    y: valid.map((d) => (c *= 1 + (d.pnl_percent ?? 0) / 100)),
  };
}

// ── Cumulative overlay ──────────────────────────────────────────────────────
export function CompareCumulative({ a, b }: { a: SeriesIn; b: SeriesIn }) {
  const aLine = cumulative(a.data);
  const bLine = cumulative(b.data);
  return (
    <Plot
      data={[
        {
          type: "scatter",
          mode: "lines",
          x: aLine.x,
          y: aLine.y,
          name: a.name,
          line: { color: a.color, width: 2 },
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>${a.name}: %{y:.2f}x<extra></extra>`,
        },
        {
          type: "scatter",
          mode: "lines",
          x: bLine.x,
          y: bLine.y,
          name: b.name,
          line: { color: b.color, width: 2 },
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>${b.name}: %{y:.2f}x<extra></extra>`,
        },
      ]}
      layout={{
        ...plotlyBase,
        hovermode: "x unified",
        yaxis: { ...plotlyBase.yaxis, title: { text: "Growth of ₹1" } },
        showlegend: true,
        legend: { ...plotlyBase.legend, orientation: "h", x: 0, y: 1.08 },
      }}
      config={plotlyConfig}
    />
  );
}

// ── Distribution overlay (two histograms + two normal fits) ─────────────────
const N_BINS = 80;
function normalPdfScaled(x: number, mu: number, sigma: number, n: number, w: number) {
  const z = (x - mu) / sigma;
  return (n * w * Math.exp(-0.5 * z * z)) / (sigma * Math.sqrt(2 * Math.PI));
}

function returnsStats(data: DailyRecord[]) {
  const returns = data.map((d) => d.pnl_percent).filter((v): v is number => v !== null);
  const n = returns.length;
  const mu = returns.reduce((s, x) => s + x, 0) / n;
  const variance = returns.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1);
  const sigma = Math.sqrt(variance);
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  return { returns, n, mu, sigma, min, max, binWidth: (max - min) / N_BINS };
}

export function CompareDistribution({ a, b }: { a: SeriesIn; b: SeriesIn }) {
  const aS = useMemo(() => returnsStats(a.data), [a.data]);
  const bS = useMemo(() => returnsStats(b.data), [b.data]);

  const span = {
    min: Math.min(aS.min, bS.min) - 0.5,
    max: Math.max(aS.max, bS.max) + 0.5,
  };
  const step = (span.max - span.min) / 400;
  const curve = (s: ReturnType<typeof returnsStats>) => {
    const cx: number[] = [];
    const cy: number[] = [];
    for (let x = span.min; x <= span.max; x += step) {
      cx.push(x);
      cy.push(normalPdfScaled(x, s.mu, s.sigma, s.n, s.binWidth));
    }
    return { cx, cy };
  };
  const aCurve = curve(aS);
  const bCurve = curve(bS);

  return (
    <Plot
      data={[
        { type: "histogram", x: aS.returns, nbinsx: N_BINS, marker: { color: a.color, opacity: 0.5 }, name: `${a.name}`, hovertemplate: "Return: %{x:.2f}%<br>Days: %{y}<extra></extra>" },
        { type: "histogram", x: bS.returns, nbinsx: N_BINS, marker: { color: b.color, opacity: 0.5 }, name: `${b.name}`, hovertemplate: "Return: %{x:.2f}%<br>Days: %{y}<extra></extra>" },
        { type: "scatter", mode: "lines", x: aCurve.cx, y: aCurve.cy, name: `${a.name} fit`, line: { color: a.light, width: 2 } },
        { type: "scatter", mode: "lines", x: bCurve.cx, y: bCurve.cy, name: `${b.name} fit`, line: { color: b.light, width: 2 } },
      ]}
      layout={{
        ...plotlyBase,
        barmode: "overlay",
        xaxis: { ...plotlyBase.xaxis, title: { text: "Daily Return (%)" } },
        yaxis: { ...plotlyBase.yaxis, title: { text: "Number of Days" } },
        showlegend: true,
        legend: { ...plotlyBase.legend, x: 0.99, y: 0.99, xanchor: "right", yanchor: "top" },
        annotations: [
          {
            xref: "paper", yref: "paper", x: 0.01, y: 0.99, xanchor: "left", yanchor: "top",
            showarrow: false, align: "left",
            text:
              `<span style="color:${a.color}">${a.name}</span>  μ=${aS.mu.toFixed(3)}%  σ=${aS.sigma.toFixed(3)}%<br>` +
              `<span style="color:${b.color}">${b.name}</span>  μ=${bS.mu.toFixed(3)}%  σ=${bS.sigma.toFixed(3)}%`,
            font: { size: 11, color: COLORS.textDim },
            bgcolor: COLORS.panel2, bordercolor: COLORS.border, borderwidth: 1,
          },
        ],
      }}
      config={plotlyConfig}
    />
  );
}

// ── Rolling volatility overlay ──────────────────────────────────────────────
const ANN = Math.sqrt(252);
const WINDOW = 252;
function rollingVol(data: DailyRecord[]) {
  const v = data.map((d) => d.pnl_percent);
  const y: (number | null)[] = new Array(v.length).fill(null);
  for (let i = WINDOW - 1; i < v.length; i++) {
    let s = 0, sq = 0, c = 0;
    for (let j = i - WINDOW + 1; j <= i; j++) {
      const x = v[j];
      if (x === null) continue;
      s += x;
      sq += x * x;
      c += 1;
    }
    if (c < WINDOW * 0.8) continue;
    const mean = s / c;
    const variance = sq / c - mean * mean;
    y[i] = Math.sqrt(Math.max(variance, 0)) * ANN;
  }
  return { x: data.map((d) => d.date), y };
}

export function CompareVolatility({ a, b }: { a: SeriesIn; b: SeriesIn }) {
  const aV = rollingVol(a.data);
  const bV = rollingVol(b.data);
  // Align spread on dates present in both
  const bMap = new Map(bV.x.map((d, i) => [d, bV.y[i]]));
  const spreadX: string[] = [];
  const spreadY: number[] = [];
  for (let i = 0; i < aV.x.length; i++) {
    const av = aV.y[i];
    const bvRaw = bMap.get(aV.x[i]);
    if (av === null || av === undefined || bvRaw === null || bvRaw === undefined) continue;
    spreadX.push(aV.x[i]);
    spreadY.push(av - bvRaw);
  }

  return (
    <Plot
      data={[
        {
          type: "scatter", mode: "lines", x: aV.x, y: aV.y, name: a.name,
          line: { color: a.color, width: 2 },
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>${a.name}: %{y:.2f}%<extra></extra>`,
          yaxis: "y",
        },
        {
          type: "scatter", mode: "lines", x: bV.x, y: bV.y, name: b.name,
          line: { color: b.color, width: 2 },
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>${b.name}: %{y:.2f}%<extra></extra>`,
          yaxis: "y",
        },
        {
          type: "scatter", mode: "lines", x: spreadX, y: spreadY,
          name: `Spread (${a.name} − ${b.name})`,
          line: { color: COLORS.warn, width: 1, dash: "dot" },
          hovertemplate: `<b>%{x|%d %b %Y}</b><br>Spread: %{y:+.2f}%<extra></extra>`,
          yaxis: "y2",
          opacity: 0.85,
        },
      ]}
      layout={{
        ...plotlyBase,
        hovermode: "x unified",
        yaxis: {
          ...plotlyBase.yaxis,
          title: { text: "Annualised Volatility (%)" },
          ticksuffix: "%",
        },
        yaxis2: {
          ...plotlyBase.yaxis,
          title: { text: "Spread (% pts)" },
          ticksuffix: "%",
          overlaying: "y",
          side: "right",
          showgrid: false,
          zeroline: true,
          zerolinecolor: COLORS.warn,
          zerolinewidth: 1,
        },
        showlegend: true,
        legend: { ...plotlyBase.legend, orientation: "h", x: 0, y: 1.1 },
      }}
      config={plotlyConfig}
    />
  );
}

// ── Correlation scatter (with regression line + stats annotation) ───────────
export function CompareScatter({
  aligned,
  a,
  b,
}: {
  aligned: AlignedReturns;
  a: SeriesIn;
  b: SeriesIn;
}) {
  const stats = useMemo(() => pairStats(aligned.a, aligned.b), [aligned]);
  if (aligned.a.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-text-faint text-xs">
        No overlapping dates between these two assets.
      </div>
    );
  }
  const xMin = Math.min(...aligned.b);
  const xMax = Math.max(...aligned.b);
  const lineX = [xMin, xMax];
  const lineY = lineX.map((x) => stats.regression.intercept + stats.regression.slope * x);

  return (
    <Plot
      data={[
        {
          type: "scattergl",
          mode: "markers",
          x: aligned.b,
          y: aligned.a,
          marker: { color: A_LIGHT, size: 4, opacity: 0.45 },
          name: "Daily returns",
          hovertemplate: `${b.name}: %{x:.2f}%<br>${a.name}: %{y:.2f}%<extra></extra>`,
        },
        {
          type: "scatter",
          mode: "lines",
          x: lineX,
          y: lineY,
          line: { color: COLORS.warn, width: 2, dash: "dash" },
          name: "Regression",
          hoverinfo: "skip",
          showlegend: true,
        },
      ]}
      layout={{
        ...plotlyBase,
        xaxis: { ...plotlyBase.xaxis, title: { text: `${b.name} daily return (%)` }, zeroline: true, zerolinecolor: COLORS.borderStrong },
        yaxis: { ...plotlyBase.yaxis, title: { text: `${a.name} daily return (%)` }, zeroline: true, zerolinecolor: COLORS.borderStrong },
        showlegend: true,
        legend: { ...plotlyBase.legend, x: 0.01, y: 0.99, xanchor: "left", yanchor: "top" },
        annotations: [
          {
            xref: "paper", yref: "paper", x: 0.99, y: 0.01,
            xanchor: "right", yanchor: "bottom", showarrow: false, align: "left",
            text:
              `<b>n</b> = ${stats.n.toLocaleString()} aligned days<br>` +
              `<b>r</b> = ${stats.correlation.toFixed(3)}  (correlation)<br>` +
              `<b>β</b> = ${stats.betaAonB.toFixed(3)}  (${a.name} vs ${b.name})<br>` +
              `<b>α</b> = ${stats.intercept.toFixed(4)}%`,
            font: { size: 11, color: COLORS.text },
            bgcolor: COLORS.panel2, bordercolor: COLORS.border, borderwidth: 1,
          },
        ],
      }}
      config={plotlyConfig}
    />
  );
}

// ── Yearly returns grouped bars ─────────────────────────────────────────────
function yearlyReturns(data: DailyRecord[]) {
  const buckets = new Map<number, number>();
  for (const d of data) {
    if (d.pnl_percent === null) continue;
    const y = new Date(d.date).getUTCFullYear();
    const cur = buckets.get(y) ?? 1;
    buckets.set(y, cur * (1 + d.pnl_percent / 100));
  }
  const years = [...buckets.keys()].sort();
  return {
    years: years.map(String),
    returns: years.map((y) => (buckets.get(y)! - 1) * 100),
  };
}

export function CompareYearly({ a, b }: { a: SeriesIn; b: SeriesIn }) {
  const aR = yearlyReturns(a.data);
  const bR = yearlyReturns(b.data);
  return (
    <Plot
      data={[
        {
          type: "bar",
          x: aR.years, y: aR.returns,
          name: a.name,
          marker: { color: a.color },
          hovertemplate: `<b>%{x}</b><br>${a.name}: %{y:+.2f}%<extra></extra>`,
        },
        {
          type: "bar",
          x: bR.years, y: bR.returns,
          name: b.name,
          marker: { color: b.color },
          hovertemplate: `<b>%{x}</b><br>${b.name}: %{y:+.2f}%<extra></extra>`,
        },
      ]}
      layout={{
        ...plotlyBase,
        barmode: "group",
        xaxis: { ...plotlyBase.xaxis, title: { text: "Year" } },
        yaxis: { ...plotlyBase.yaxis, title: { text: "Yearly Return (%)" }, ticksuffix: "%", zeroline: true, zerolinecolor: COLORS.borderStrong },
        showlegend: true,
        legend: { ...plotlyBase.legend, orientation: "h", x: 0, y: 1.08 },
      }}
      config={plotlyConfig}
    />
  );
}

export const COMPARE_COLORS = { A_COLOR, A_LIGHT, B_COLOR, B_LIGHT };
