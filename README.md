# fairytale

A research workspace for studying Indian equities through a statistical lens.
Ten years of daily OHLCV data on the Nifty 50, Sensex, and the 48 stocks that
compose them, turned into distributions, correlations, and simulated futures.

For learning and research. Not investment advice.

---

## What's inside

Five analysis views, each backed by a Postgres view or function that does the
heavy lifting:

| View                   | What it answers                                          |
|------------------------|----------------------------------------------------------|
| **Overview**           | Returns, volatility, drawdowns, monthly heatmap          |
| **Compare**            | Correlation, beta, side-by-side stats of two assets      |
| **Monte Carlo**        | Forward simulation via GBM and historical bootstrap      |
| **Sector Heatmap**     | Finviz-style treemap of returns, grouped by sector       |
| **Correlation Matrix** | Pairwise Pearson correlation across all 50 assets        |

Plus a Python SDK (`fairytale/`) for backtesting trading strategies and AI
agents against the same data. Imports anywhere in the repo as
`from fairytale import Market, Agent, Backtest, Order`. See
`fairytale/AGENTS.md` for the full reference.

## Architecture

```
 yfinance  ────►  Python pipeline  ────►  Supabase (Postgres)  ────►  Next.js app
 (source)        fetch_companies.py       assets, prices,            (web/)
                 build_manifest.py        prices_enriched view,
                 migrate_to_supabase.py   asset_returns view,
                                          asset_correlations fn
                                              │
                                              ▼
                                          Python SDK (fairytale/)
                                          point-in-time queries,
                                          portfolios, agents, backtests
```

Three storage layers, each owning one job:

- **Python pipeline** (root) — fetches raw bars from Yahoo Finance, normalizes
  them into per-asset JSON files, then bulk-uploads to Supabase via the REST API.
- **Supabase** (schema in `supabase/schema.sql`) — two base tables (`assets`,
  `prices`), several views computing derived metrics (`prices_enriched`,
  `asset_overview`, `asset_latest`, `asset_returns`), and an
  `asset_correlations(p_months)` function for the matrix view.
- **Next.js 16** (`web/`) — App Router, Tailwind, Plotly. Reads from Supabase
  with the publishable anon key.

### Why the schema is shaped this way

- **Composite PK `(asset_id, date)` on `prices`** clusters bars by asset
  chronologically. That's the natural order for every read path.
- **`numeric(16, 4)` for prices**, not `double precision`. Exact decimal, no
  floating-point drift in aggregates over 10 years of daily data.
- **Derived metrics live in views, not columns**. `prev_close`,
  `daily_return_pct`, `direction` are deterministic functions of the raw OHLCV.
  Window functions over ~2,500 rows per asset are instant, and the values can
  never drift from what's underneath.

## Setup

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+ (only if you want to refresh data from yfinance)
- A Supabase project

### 1. Environment

Create `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key>
```

And a matching `.env` at the project root for the Python migration script:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key>
```

Both files are gitignored.

### 2. Database schema

Open the Supabase dashboard → SQL Editor → paste the full contents of
`supabase/schema.sql` and Run. The schema is idempotent (`create table if not
exists`, `create or replace view`, etc.), so re-running is safe.

### 3. Data migration (optional, only if rebuilding from scratch)

```
python scripts/migrate_to_supabase.py
```

Reads the per-asset JSON files in `web/public/data/assets/` and bulk-inserts
into `public.assets` and `public.prices`. ~50 assets, ~123k price rows.

If those JSON files don't exist (they're not committed to the repo), regenerate
them first with `python fetch_companies.py` and `python build_manifest.py`.

### 4. Run the app

```
cd web
npm install
npm run dev
```

Visit http://localhost:3000.

### 5. Use the SDK

Install the Python package once:

```
poetry install
```

Then import it from anywhere in this repo:

```python
from decimal import Decimal
from fairytale import Market, Agent, Backtest, Order

class BuyAndHold(Agent):
    def on_day(self, view, portfolio):
        if "NIFTY50" in portfolio.positions:
            return []
        price = view.close("NIFTY50")
        qty = int(portfolio.cash / price) if price else 0
        return [Order("NIFTY50", "buy", qty)] if qty else []

result = Backtest(BuyAndHold(), starting_cash=Decimal("100000")).run(
    "2020-01-01", "2025-12-31"
)
print(result.summary())
# 2020-01-01 → 2025-12-31 · 1486 trading days · 1 fills · ... · total +111.58% · CAGR +13.31%
```

The full SDK reference (including the point-in-time contract that makes
backtests honest, the broker model, and common strategy patterns) lives in
[`fairytale/AGENTS.md`](fairytale/AGENTS.md).

## Project layout

```
quant/
├── README.md                  this file
├── pyproject.toml             python deps (yfinance, pandas, plotly, supabase, fairytale)
├── fetch_companies.py         yfinance → web/public/data/assets/*.json
├── build_manifest.py          rebuilds the asset manifest
├── retry_companies.py         retry failed fetches
├── visualize.py               standalone plotly visualizations (legacy)
├── monte_carlo_theory.tex     LaTeX notes on the MC math
├── supabase/
│   └── schema.sql             tables, views, functions, RLS policies
├── scripts/
│   └── migrate_to_supabase.py JSON → Supabase REST API
├── fairytale/                 Python SDK (importable as `fairytale`)
│   ├── AGENTS.md              SDK reference for AI agents and humans
│   ├── market.py              Market data access
│   ├── as_of.py               Point-in-time view (no future leakage)
│   ├── portfolio.py           Cash + positions bookkeeping
│   ├── broker.py              Simulated order execution
│   ├── agent.py               Agent base class
│   └── backtest.py            Backtest runner + result
├── examples/
│   ├── buy_and_hold.py        all-in on NIFTY50 day one, hold
│   └── momentum.py            top-N past-12M momentum, monthly rebalance
└── web/                       Next.js app
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx              landing
    │   │   └── (app)/                everything inside the sidebar shell
    │   │       ├── assets/[symbol]/  per-asset Overview
    │   │       ├── compare/          Compare view
    │   │       ├── montecarlo/       Monte Carlo
    │   │       ├── sectors/          Sector Heatmap
    │   │       └── correlations/     Correlation Matrix
    │   ├── components/        UI + chart components
    │   └── lib/               data layer, supabase client, stats, MC engine
    └── public/data/assets/    raw JSON bars (regeneratable from yfinance)
```

## A note on the Postgres function timeout

The `asset_correlations` function joins ~3M rows for the all-time view, which
exceeds Supabase's default 3-second anon-role statement timeout. The function
is declared `SECURITY DEFINER` with `SET statement_timeout = '60s'` so the
"All" period can complete (typically in 4-5 seconds). It's read-only by design,
and `search_path` is pinned to `public, pg_temp` to prevent schema tricks.

## License

Unlicensed for now. Personal / research project.
