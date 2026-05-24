"use client";

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plotly = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] text-text-faint text-xs">
      Loading chart…
    </div>
  ),
});

export default function Plot(props: PlotParams) {
  return (
    <Plotly
      {...props}
      useResizeHandler
      style={{ width: "100%", height: "100%", ...props.style }}
    />
  );
}
