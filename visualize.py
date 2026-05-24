"""
Generate interactive HTML charts for Indian Market 10-Year analysis.
Output: output/charts.html  (single self-contained file)
"""

import json
import math
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

OUT_DIR = Path("output")

# ── load data ──────────────────────────────────────────────────────────────────

def load(name: str) -> pd.DataFrame:
    data = json.loads((OUT_DIR / f"{name}_daily_pnl.json").read_text())
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df["cumulative_return"] = (1 + df["pnl_percent"].fillna(0) / 100).cumprod()
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["month_name"] = df["date"].dt.strftime("%b")
    return df


nifty = load("Nifty50")
sensex = load("Sensex")

COLORS = {
    "nifty":   "#2563eb",
    "sensex":  "#dc2626",
    "up":      "#16a34a",
    "down":    "#dc2626",
    "flat":    "#94a3b8",
    "bg":      "#0f172a",
    "grid":    "#1e293b",
    "text":    "#e2e8f0",
    "subtext": "#94a3b8",
}

LAYOUT_BASE = dict(
    paper_bgcolor=COLORS["bg"],
    plot_bgcolor=COLORS["grid"],
    font=dict(color=COLORS["text"], family="Inter, system-ui, sans-serif", size=12),
    margin=dict(l=60, r=30, t=60, b=50),
    xaxis=dict(gridcolor="#334155", linecolor="#334155", tickfont=dict(size=11)),
    yaxis=dict(gridcolor="#334155", linecolor="#334155", tickfont=dict(size=11)),
)


# ── chart helpers ──────────────────────────────────────────────────────────────

def axis_style(**kw) -> dict:
    return dict(gridcolor="#334155", linecolor="#334155", tickfont=dict(size=11), **kw)


def update_axes(fig, rows=1, cols=1):
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            try:
                fig.update_xaxes(row=r, col=c, **axis_style())
                fig.update_yaxes(row=r, col=c, **axis_style())
            except Exception:
                pass


# ── 1. Cumulative Returns ──────────────────────────────────────────────────────

def chart_cumulative() -> go.Figure:
    fig = go.Figure()
    for df, name, color in [(nifty, "Nifty 50", COLORS["nifty"]), (sensex, "Sensex", COLORS["sensex"])]:
        valid = df.dropna(subset=["pnl_percent"])
        fig.add_trace(go.Scatter(
            x=valid["date"], y=valid["cumulative_return"],
            name=name, line=dict(color=color, width=2),
            hovertemplate="<b>%{x|%d %b %Y}</b><br>Return: %{y:.2f}x<extra></extra>",
        ))
    fig.update_layout(**LAYOUT_BASE,
        title=dict(text="Cumulative Returns (10 Years)", font=dict(size=18)),
        yaxis_title="Growth of ₹1",
        hovermode="x unified",
        legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="#334155"),
    )
    update_axes(fig)
    return fig


# ── 2. Candlestick (last 6 months, Nifty) ─────────────────────────────────────

def chart_candlestick() -> go.Figure:
    cutoff = nifty["date"].max() - pd.DateOffset(months=6)
    df = nifty[nifty["date"] >= cutoff]
    fig = go.Figure(go.Candlestick(
        x=df["date"], open=df["open"], high=df["high"], low=df["low"], close=df["close"],
        increasing=dict(line=dict(color=COLORS["up"]), fillcolor=COLORS["up"]),
        decreasing=dict(line=dict(color=COLORS["down"]), fillcolor=COLORS["down"]),
        name="Nifty 50",
        hovertext=df.apply(
            lambda r: f"{r['date'].strftime('%d %b %Y')}<br>"
                      f"O: {r['open']:.0f}  H: {r['high']:.0f}  L: {r['low']:.0f}  C: {r['close']:.0f}<br>"
                      f"P&L: {r['pnl_points']:+.0f} pts ({r['pnl_percent']:+.2f}%)",
            axis=1,
        ),
        hoverinfo="text",
    ))
    fig.update_layout(**LAYOUT_BASE,
        title=dict(text="Nifty 50 — Last 6 Months (Candlestick)", font=dict(size=18)),
        xaxis_rangeslider_visible=False,
        yaxis_title="Price (INR)",
    )
    update_axes(fig)
    return fig


# ── 3. Daily Return Distribution (histogram + bell curve) ────────────────────

def normal_pdf_scaled(x: np.ndarray, mu: float, sigma: float, n: int, bin_width: float) -> np.ndarray:
    """Normal PDF scaled to match a count histogram."""
    return n * bin_width * (1 / (sigma * math.sqrt(2 * math.pi))) * np.exp(-0.5 * ((x - mu) / sigma) ** 2)


def chart_distribution() -> go.Figure:
    N_BINS = 120
    fig = go.Figure()

    stats_rows = []
    for df, name, color, bell_color in [
        (nifty,  "Nifty 50", COLORS["nifty"],  "#93c5fd"),
        (sensex, "Sensex",   COLORS["sensex"], "#fca5a5"),
    ]:
        returns = df["pnl_percent"].dropna()
        mu     = float(returns.mean())
        sigma  = float(returns.std())
        n      = len(returns)
        r_min, r_max = float(returns.min()), float(returns.max())
        bin_width = (r_max - r_min) / N_BINS

        # histogram
        fig.add_trace(go.Histogram(
            x=returns, name=name, nbinsx=N_BINS,
            marker_color=color, opacity=0.55,
            hovertemplate="Return: %{x:.2f}%<br>Days: %{y}<extra></extra>",
        ))

        # bell curve
        x_curve = np.linspace(r_min - 0.5, r_max + 0.5, 600)
        y_curve = normal_pdf_scaled(x_curve, mu, sigma, n, bin_width)
        fig.add_trace(go.Scatter(
            x=x_curve, y=y_curve,
            name=f"{name} — Normal fit",
            line=dict(color=bell_color, width=2.5, dash="solid"),
            hovertemplate="Return: %{x:.3f}%<br>Expected: %{y:.1f} days<extra></extra>",
        ))

        stats_rows.append((name, mu, sigma, color))

    # ── mean & σ reference lines ──────────────────────────────────────────────
    # Use Nifty for the reference lines (first dataset)
    returns_n = nifty["pnl_percent"].dropna()
    mu_n  = float(returns_n.mean())
    sig_n = float(returns_n.std())

    # mean line
    fig.add_vline(x=mu_n, line=dict(color="#facc15", width=1.5, dash="dash"),
                  annotation_text=f"μ = {mu_n:.3f}%",
                  annotation_position="top right",
                  annotation_font=dict(color="#facc15", size=12))

    # ±1σ band
    fig.add_vrect(x0=mu_n - sig_n, x1=mu_n + sig_n,
                  fillcolor="#94a3b8", opacity=0.07, line_width=0)
    fig.add_vline(x=mu_n - sig_n, line=dict(color="#94a3b8", width=1, dash="dot"),
                  annotation_text=f"−1σ ({mu_n - sig_n:.2f}%)",
                  annotation_position="bottom left",
                  annotation_font=dict(color="#94a3b8", size=11))
    fig.add_vline(x=mu_n + sig_n, line=dict(color="#94a3b8", width=1, dash="dot"),
                  annotation_text=f"+1σ ({mu_n + sig_n:.2f}%)",
                  annotation_position="bottom right",
                  annotation_font=dict(color="#94a3b8", size=11))

    # ±2σ lines
    fig.add_vline(x=mu_n - 2 * sig_n, line=dict(color="#475569", width=1, dash="dot"),
                  annotation_text=f"−2σ ({mu_n - 2*sig_n:.2f}%)",
                  annotation_position="bottom left",
                  annotation_font=dict(color="#475569", size=10))
    fig.add_vline(x=mu_n + 2 * sig_n, line=dict(color="#475569", width=1, dash="dot"),
                  annotation_text=f"+2σ ({mu_n + 2*sig_n:.2f}%)",
                  annotation_position="bottom right",
                  annotation_font=dict(color="#475569", size=10))

    # ── stats annotation box ──────────────────────────────────────────────────
    stats_text = "<br>".join(
        f"<b style='color:{c}'>{nm}</b>  μ={mu:+.4f}%  σ={sd:.4f}%"
        for nm, mu, sd, c in stats_rows
    )
    fig.add_annotation(
        xref="paper", yref="paper", x=0.99, y=0.97,
        xanchor="right", yanchor="top",
        text=stats_text,
        showarrow=False,
        bgcolor="#1e293b", bordercolor="#334155", borderwidth=1,
        font=dict(size=12, color=COLORS["text"]),
        align="left",
    )

    # tail shading
    fig.add_vrect(x0=float(returns_n.min()) - 1, x1=-2,
                  fillcolor="#dc2626", opacity=0.05, line_width=0,
                  annotation_text="Crash zone", annotation_position="top left",
                  annotation_font_color=COLORS["down"])
    fig.add_vrect(x0=2, x1=float(returns_n.max()) + 1,
                  fillcolor="#16a34a", opacity=0.05, line_width=0,
                  annotation_text="Rally zone", annotation_position="top right",
                  annotation_font_color=COLORS["up"])

    fig.update_layout(**LAYOUT_BASE,
        title=dict(text="Daily Return Distribution — Normal Fit", font=dict(size=18)),
        xaxis_title="Daily Return (%)",
        yaxis_title="Number of Days",
        barmode="overlay",
        legend=dict(bgcolor="rgba(0,0,0,0)", bordercolor="#334155", borderwidth=1),
    )
    update_axes(fig)
    return fig


# ── 4. Monthly Heatmap of avg returns ─────────────────────────────────────────

def chart_heatmap(df: pd.DataFrame, title: str) -> go.Figure:
    pivot = df.groupby(["year", "month"])["pnl_percent"].mean().unstack()
    pivot.columns = [datetime(2000, m, 1).strftime("%b") for m in pivot.columns]
    z = pivot.values.tolist()
    years = [str(y) for y in pivot.index.tolist()]
    months = list(pivot.columns)
    # clamp colorscale at ±3%
    zmax = 3.0
    fig = go.Figure(go.Heatmap(
        z=z, x=months, y=years,
        colorscale=[
            [0.0,  "#7f1d1d"], [0.33, "#dc2626"], [0.5,  "#1e293b"],
            [0.67, "#16a34a"], [1.0,  "#14532d"],
        ],
        zmid=0, zmin=-zmax, zmax=zmax,
        colorbar=dict(title="Avg %", ticksuffix="%", tickfont=dict(size=11)),
        hovertemplate="<b>%{y} %{x}</b><br>Avg daily return: %{z:.3f}%<extra></extra>",
    ))
    base = {k: v for k, v in LAYOUT_BASE.items() if k not in ("xaxis", "yaxis")}
    fig.update_layout(**base,
        title=dict(text=title, font=dict(size=18)),
        xaxis=dict(side="top", **axis_style()),
        yaxis=dict(autorange="reversed", **axis_style()),
    )
    return fig


# ── 5. Up/Down Streak Bar Chart ────────────────────────────────────────────────

def chart_streaks() -> go.Figure:
    def streak_counts(df: pd.DataFrame, direction: str) -> pd.DataFrame:
        sub = df[df["direction"] == direction]
        # max streak per run
        runs = sub.groupby((sub["direction"] != sub["direction"].shift()).cumsum())["streak"].max()
        return runs.value_counts().sort_index()

    fig = make_subplots(rows=1, cols=2, subplot_titles=["Up Streaks", "Down Streaks"])
    for col_i, direction, color in [(1, "Up", COLORS["up"]), (2, "Down", COLORS["down"])]:
        for df, name, opacity in [(nifty, "Nifty 50", 1.0), (sensex, "Sensex", 0.6)]:
            vc = streak_counts(df, direction)
            fig.add_trace(go.Bar(
                x=vc.index.tolist(), y=vc.values.tolist(),
                name=f"{name} ({direction})", marker_color=color, opacity=opacity,
                hovertemplate="Streak: %{x} days<br>Occurrences: %{y}<extra></extra>",
                legendgroup=name, showlegend=(col_i == 1),
            ), row=1, col=col_i)

    fig.update_layout(
        **{k: v for k, v in LAYOUT_BASE.items() if k not in ("xaxis", "yaxis")},
        title=dict(text="Consecutive Up / Down Day Streaks", font=dict(size=18)),
        barmode="group",
        legend=dict(bgcolor="rgba(0,0,0,0)"),
    )
    update_axes(fig, rows=1, cols=2)
    for col_i in (1, 2):
        fig.update_xaxes(title_text="Streak length (days)", row=1, col=col_i)
        fig.update_yaxes(title_text="Times occurred", row=1, col=col_i)
    return fig


# ── 6. Rolling 252-day Volatility ─────────────────────────────────────────────

def chart_volatility() -> go.Figure:
    fig = go.Figure()
    for df, name, color in [(nifty, "Nifty 50", COLORS["nifty"]), (sensex, "Sensex", COLORS["sensex"])]:
        vol = df["pnl_percent"].rolling(252).std() * math.sqrt(252)
        fig.add_trace(go.Scatter(
            x=df["date"], y=vol,
            name=name, line=dict(color=color, width=2),
            hovertemplate="<b>%{x|%d %b %Y}</b><br>Ann. Vol: %{y:.2f}%<extra></extra>",
        ))
    # shade COVID crash
    fig.add_vrect(x0="2020-01-01", x1="2020-07-01",
                  fillcolor="#f59e0b", opacity=0.08, line_width=0,
                  annotation_text="COVID crash", annotation_position="top left",
                  annotation_font_color="#f59e0b")
    fig.update_layout(**LAYOUT_BASE,
        title=dict(text="Rolling 1-Year Annualised Volatility", font=dict(size=18)),
        yaxis_title="Annualised Volatility (%)",
        hovermode="x unified",
        legend=dict(bgcolor="rgba(0,0,0,0)"),
    )
    update_axes(fig)
    return fig


# ── 7. Year-wise Up/Down Day Count ────────────────────────────────────────────

def chart_yearly_updown() -> go.Figure:
    fig = make_subplots(rows=1, cols=2, subplot_titles=["Nifty 50", "Sensex"])
    for col_i, df, name in [(1, nifty, "Nifty 50"), (2, sensex, "Sensex")]:
        yd = df.groupby("year")["direction"].value_counts().unstack(fill_value=0)
        years = [str(y) for y in yd.index]
        for direction, color in [("Up", COLORS["up"]), ("Down", COLORS["down"]), ("Flat", COLORS["flat"])]:
            if direction in yd.columns:
                fig.add_trace(go.Bar(
                    x=years, y=yd[direction].tolist(),
                    name=direction, marker_color=color,
                    legendgroup=direction, showlegend=(col_i == 1),
                    hovertemplate=f"<b>%{{x}}</b><br>{direction}: %{{y}} days<extra></extra>",
                ), row=1, col=col_i)

    fig.update_layout(
        **{k: v for k, v in LAYOUT_BASE.items() if k not in ("xaxis", "yaxis")},
        title=dict(text="Year-wise Up / Down / Flat Days", font=dict(size=18)),
        barmode="stack",
        legend=dict(bgcolor="rgba(0,0,0,0)"),
    )
    update_axes(fig, rows=1, cols=2)
    return fig


# ── 8. Best & Worst 20 Days ────────────────────────────────────────────────────

def chart_extremes() -> go.Figure:
    fig = make_subplots(rows=2, cols=1, subplot_titles=["Top 20 Best Days", "Top 20 Worst Days"], vertical_spacing=0.14)
    for row_i, ascending, color in [(1, False, COLORS["up"]), (2, True, COLORS["down"])]:
        top = nifty.dropna(subset=["pnl_percent"]).nsmallest(20, "pnl_percent") if ascending \
              else nifty.dropna(subset=["pnl_percent"]).nlargest(20, "pnl_percent")
        top = top.sort_values("pnl_percent", ascending=ascending)
        fig.add_trace(go.Bar(
            x=top["pnl_percent"],
            y=top["date"].dt.strftime("%d %b %Y"),
            orientation="h",
            marker_color=color,
            name="Best days" if not ascending else "Worst days",
            hovertemplate="<b>%{y}</b><br>Return: %{x:.2f}%<extra></extra>",
            showlegend=False,
        ), row=row_i, col=1)

    fig.update_layout(
        **{k: v for k, v in LAYOUT_BASE.items() if k not in ("xaxis", "yaxis")},
        title=dict(text="Nifty 50 — Extreme Days (Top 20 Best & Worst)", font=dict(size=18)),
        height=700,
    )
    update_axes(fig, rows=2, cols=1)
    for r in (1, 2):
        fig.update_xaxes(title_text="Daily Return (%)", row=r, col=1)
    return fig


# ── assemble HTML ──────────────────────────────────────────────────────────────

charts = [
    ("📈 Cumulative Returns",             chart_cumulative()),
    ("🕯 Candlestick — Last 6 Months",    chart_candlestick()),
    ("📊 Daily Return Distribution",      chart_distribution()),
    ("🌡 Monthly Return Heatmap — Nifty", chart_heatmap(nifty,  "Nifty 50 — Monthly Avg Daily Return Heatmap")),
    ("🌡 Monthly Return Heatmap — Sensex",chart_heatmap(sensex, "Sensex — Monthly Avg Daily Return Heatmap")),
    ("🔥 Streak Analysis",                chart_streaks()),
    ("📉 Rolling Volatility",             chart_volatility()),
    ("📅 Year-wise Up/Down Days",          chart_yearly_updown()),
    ("⚡ Best & Worst 20 Days",            chart_extremes()),
]

HEADER = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Indian Market — 10-Year Analysis</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f172a; color: #e2e8f0; font-family: Inter, system-ui, sans-serif; }
  header { padding: 36px 48px 20px; border-bottom: 1px solid #1e293b; }
  header h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
  header p  { margin-top: 6px; color: #94a3b8; font-size: 14px; }
  nav { display: flex; flex-wrap: wrap; gap: 8px; padding: 18px 48px; border-bottom: 1px solid #1e293b; }
  nav a { background: #1e293b; color: #94a3b8; text-decoration: none; padding: 5px 12px;
          border-radius: 6px; font-size: 13px; border: 1px solid #334155; transition: all .15s; }
  nav a:hover { background: #334155; color: #e2e8f0; }
  section { padding: 32px 48px; border-bottom: 1px solid #1e293b; scroll-margin-top: 20px; }
  section h2 { font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 16px;
               text-transform: uppercase; letter-spacing: 0.8px; }
  .chart-wrap { border-radius: 10px; overflow: hidden; border: 1px solid #1e293b; }
  footer { padding: 24px 48px; color: #475569; font-size: 12px; }
  @media(max-width: 768px) { header, nav, section, footer { padding-left: 20px; padding-right: 20px; } }
</style>
</head>
<body>
<header>
  <h1>Indian Market — 10-Year Analysis</h1>
  <p>Nifty 50 &amp; Sensex &nbsp;·&nbsp; Daily P&amp;L &nbsp;·&nbsp; May 2016 – May 2026</p>
</header>
<nav>
"""

FOOTER = """
<footer>Data source: Yahoo Finance via yfinance &nbsp;·&nbsp; Generated {date}</footer>
</body></html>
""".format(date=datetime.today().strftime("%d %b %Y"))

parts = [HEADER]
for title, _ in charts:
    slug = title.split()[-1].lower().replace("—", "").replace("&", "").strip()
    parts.append(f'  <a href="#{slug}">{title}</a>\n')
parts.append("</nav>\n")

for title, fig in charts:
    slug = title.split()[-1].lower().replace("—", "").replace("&", "").strip()
    fig.update_layout(height=520)
    html_div = fig.to_html(full_html=False, include_plotlyjs="cdn" if title == charts[0][0] else False, div_id=slug)
    parts.append(f'<section id="{slug}"><h2>{title}</h2><div class="chart-wrap">{html_div}</div></section>\n')

parts.append(FOOTER)

out_path = OUT_DIR / "charts.html"
out_path.write_text("".join(parts))
print(f"Saved -> {out_path}")
