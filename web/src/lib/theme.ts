import type { Config, Layout } from "plotly.js";

export const COLORS = {
  bg: "#000000",
  panel: "#0a0a0a",
  panel2: "#111111",
  border: "#1f1f1f",
  borderStrong: "#2a2a2a",
  text: "#fafafa",
  textDim: "#a3a3a3",
  textFaint: "#525252",
  up: "#22c55e",
  down: "#ef4444",
  flat: "#737373",
  nifty: "#60a5fa",
  niftyLight: "#93c5fd",
  sensex: "#f87171",
  sensexLight: "#fca5a5",
  warn: "#facc15",
} as const;

export const plotlyBase: Partial<Layout> = {
  paper_bgcolor: COLORS.panel,
  plot_bgcolor: COLORS.panel,
  font: { color: COLORS.text, family: "var(--font-sans), system-ui, sans-serif", size: 12 },
  margin: { l: 60, r: 30, t: 30, b: 50 },
  xaxis: {
    gridcolor: COLORS.border,
    linecolor: COLORS.borderStrong,
    zerolinecolor: COLORS.borderStrong,
    tickfont: { size: 11, color: COLORS.textDim },
  },
  yaxis: {
    gridcolor: COLORS.border,
    linecolor: COLORS.borderStrong,
    zerolinecolor: COLORS.borderStrong,
    tickfont: { size: 11, color: COLORS.textDim },
  },
  legend: { bgcolor: "rgba(0,0,0,0)", bordercolor: COLORS.border, borderwidth: 1, font: { size: 12 } },
  hoverlabel: { bgcolor: COLORS.panel2, bordercolor: COLORS.borderStrong, font: { color: COLORS.text, size: 12 } },
};

export const plotlyConfig: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};
