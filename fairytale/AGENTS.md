# fairytale SDK — agent reference

A Python SDK for accessing Indian equity market data from Supabase, running
trading strategies through historical time, and building AI agents that
behave as if they are sitting at a real market terminal on a real trading
day. This document is the canonical reference for any agent (LLM or human)
that needs to read or trade against this data.

## What this is

`fairytale` wraps the Supabase database backing the fairytale web app. It
gives you:

- **Market data** for 50 Indian instruments (Nifty 50, Sensex, and the 48
  constituent stocks of the Nifty 50). 10 years of daily OHLCV bars.
- **A point-in-time view of the world.** When you ask `view.close("RELIANCE")`
  at `as_of("2022-03-15")`, you get the price as it would have been known on
  that date. You cannot see the future. This is the foundation of honest
  backtesting.
- **A portfolio and broker.** Trades resolve against the actual bar prices
  of the day. Cash and positions are bookkept in `Decimal`, not floats.
- **An agent loop.** Subclass `Agent`, implement `on_day`, return orders,
  and a `Backtest` walks you through historical time one trading day at a
  time.

What it is **not**:

- Real-time data. Bars are end-of-day historical.
- A live trading system. The broker is simulated; orders never leave your
  process.
- A guaranteed-accurate dataset. See the disclaimer in the web app.

## Mental model: the real market

Picture yourself as a trader on a single trading day:

- You can see all closes from prior days. You can see the open of today.
  You cannot see tomorrow's open.
- You can submit buy and sell orders. The broker fills them at the day's
  price.
- At end of day, you know your cash and positions. Tomorrow you do it again.

This is the contract the SDK enforces. An `AsOfView` is your terminal on
one specific day. A `Backtest` is the wall clock advancing one day at a
time. An `Agent` is you.

The single rule: every method on `AsOfView` is monotonic in time. It only
ever returns data dated at or before `view.date`. If you find a way to peek
into the future through the SDK, that's a bug; file it.

## Install and import

The SDK lives in this repo as a Poetry package. Once `poetry install` has
been run at the project root, import it from anywhere:

```python
from fairytale import Market, AsOfView, Agent, Backtest, Order, Portfolio
```

Credentials are loaded from environment variables (or `.env` at the project
root):

- `SUPABASE_URL` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (preferred for scripts; bypasses RLS)
- `SUPABASE_ANON_KEY` (fallback; works for reads since the database has a
  public-read policy)

You can also pass them explicitly: `Market(supabase_url=..., supabase_key=...)`.

## Reading market data

### The universe

```python
m = Market()

m.assets()                       # list[Asset]; cached after first call
m.asset("RELIANCE")              # Asset(symbol='RELIANCE', name='Reliance Industries', ...)
m.symbols()                      # ['ADANIENT', 'ADANIPORTS', ..., 'WIPRO']
m.symbols(category="Banks")      # ['AXISBANK', 'HDFCBANK', 'ICICIBANK', ...]
```

`Asset` has `.id`, `.symbol`, `.slug`, `.name`, `.type` (`"index"` or
`"stock"`), `.category` (sector).

### Bars (OHLCV time series)

```python
# Full history
bars = m.bars("RELIANCE")
# Date-bounded (both inclusive, both optional)
bars = m.bars("RELIANCE", start="2024-01-01", end="2024-12-31")
# A single trading day; None if the market was closed
b = m.bar("RELIANCE", "2024-06-14")
# The most recent bar on or before a date (handles weekends/holidays for you)
b = m.last_bar("RELIANCE", "2024-06-15")  # 2024-06-15 is a Saturday
```

A `Bar` exposes `.date`, `.open`, `.high`, `.low`, `.close`, `.volume`,
`.prev_close`, plus convenience properties `.daily_return`,
`.daily_return_pct`, and `.intraday_change_pct`. All prices are `Decimal`.

### Cross-asset slices

```python
m.closes(["RELIANCE", "TCS", "INFY"], on="2024-06-14")
# {'RELIANCE': Decimal('2900.50'), 'TCS': Decimal('3850.00'), 'INFY': Decimal('1500.00')}

m.trading_days(start="2024-01-01", end="2024-03-31")
# [date(2024, 1, 1), date(2024, 1, 2), ..., date(2024, 3, 28)]
```

`trading_days` uses NIFTY50 as the reference calendar by default. Pass
`calendar_symbol=` to use a different one.

### Performance and caching

The first call to `bars(symbol)` (or anything that needs that symbol's
history) fetches the asset's full history from Supabase in 1000-row pages.
That history is then cached for the lifetime of the `Market` instance.
Subsequent calls for that symbol are local lookups (binary search over an
in-memory list). This is what makes long backtests fast: load each symbol
once, walk through dates as many times as you need.

If you know up front which symbols you'll use, you can prefetch:

```python
m.warm(["NIFTY50", "RELIANCE", "TCS", "INFY"])
```

## Point-in-time queries: AsOfView

`market.as_of(date)` returns an `AsOfView`. Everything you can ask it
honors the "no future data" contract.

```python
view = m.as_of("2022-03-15")

# Most recent close on or before 2022-03-15 (the date itself if open,
# otherwise the previous trading day):
view.close("RELIANCE")            # Decimal

# Bar exactly on that date, or None if the market was closed:
view.bar("RELIANCE")
# Bar on or before that date (never None unless the symbol has no history):
view.last_bar("RELIANCE")

# Historical bars ending at view.date
view.bars("RELIANCE")                       # full history up to anchor
view.bars("RELIANCE", lookback_days=252)    # last 252 trading days

# Daily-return percentages over the lookback window
view.returns("RELIANCE", lookback_days=21)  # list[float], len <= 21

# Compounded return over the window, as a fraction:
view.cumulative_return("NIFTY50", lookback_days=252)
# 0.18  → 18% over the trailing year
```

`view.closes(symbols)` is the cross-asset version of `view.close`.

`view.advance(days=1)` returns a new view with the anchor shifted by N
calendar days. For walking trading days specifically, prefer
`m.trading_days(...)`.

## Writing an agent

Subclass `Agent` and implement `on_day`. Optional hooks: `on_start`,
`on_end`.

```python
from fairytale import Agent, Order

class Threshold(Agent):
    """Buy when the 1-month return is below -5%; sell when above +5%."""

    def __init__(self, symbol: str):
        super().__init__(name=f"Threshold({symbol})")
        self.symbol = symbol

    def on_day(self, view, portfolio):
        ret = view.cumulative_return(self.symbol, lookback_days=21)
        if ret is None:
            return []

        # Out: buy a chunk
        if ret < -0.05 and portfolio.cash > 0:
            price = view.close(self.symbol)
            if price is None:
                return []
            qty = int(portfolio.cash * 0.5 / price)
            if qty > 0:
                return [Order(self.symbol, "buy", qty)]

        # Out: trim half on big up moves
        if ret > 0.05 and self.symbol in portfolio.positions:
            qty = portfolio.positions[self.symbol].quantity // 2
            if qty > 0:
                return [Order(self.symbol, "sell", qty)]

        return []
```

### The on_day contract

- Called once per trading day in chronological order.
- `view` is bound to that day. Use it to read history.
- `portfolio` is the current state. Read it; do not mutate it directly.
  Submit `Order`s instead and let the broker mutate.
- Return an iterable of `Order`s (a list is fine). Return `[]` to do
  nothing.
- The runner executes your orders, then snapshots end-of-day state.
- Agents may carry state across days as ordinary instance attributes.

### Orders

```python
Order(symbol="RELIANCE", side="buy",  quantity=10)
Order(symbol="RELIANCE", side="sell", quantity=10)
```

Quantity is an integer count of shares. Slippage and execution timing are
broker concerns, not order concerns. Orders that would fail (insufficient
cash, oversell, market closed that day) are silently skipped by the runner.

## Running a backtest

```python
from decimal import Decimal
from fairytale import Backtest

bt = Backtest(
    agent=Threshold("RELIANCE"),
    starting_cash=Decimal("100000"),
)
result = bt.run("2020-01-01", "2025-12-31")
print(result.summary())
```

### Backtest options

- `agent`: required.
- `starting_cash`: defaults to `Decimal("100000")`.
- `broker`: defaults to `SimulatedBroker(execution="close", slippage_bps=0)`.
  Pass `SimulatedBroker(execution="open")` if you want fills at the next
  day's open, or `slippage_bps=5` for 5 bps adverse slippage.
- `market`: defaults to a fresh `Market()`. Pass your own to share its
  warm cache across multiple backtests.
- `calendar_symbol`: defaults to `"NIFTY50"`.

### BacktestResult

```python
result.summary()                # human-readable one-liner
result.total_return_pct         # 111.58
result.cagr                     # 0.1331
result.n_days                   # 1486
result.n_trades                 # number of fills across all days
result.start_date, result.end_date
result.final_value              # Decimal
result.final_portfolio          # Portfolio
result.snapshots                # list[DailySnapshot] for plotting / analysis
result.to_records()             # snapshots as plain dicts (pandas-friendly)
```

A `DailySnapshot` has `.date`, `.cash`, `.equity_value`, `.total_value`,
and `.fills` (tuple of `Fill`s that landed that day).

## Common strategy patterns

### Buy-and-hold a benchmark

```python
class BuyAndHold(Agent):
    def __init__(self, symbol="NIFTY50"):
        super().__init__()
        self.symbol = symbol

    def on_day(self, view, portfolio):
        if self.symbol in portfolio.positions:
            return []
        price = view.close(self.symbol)
        if price is None or price <= 0:
            return []
        qty = int(portfolio.cash / price)
        return [Order(self.symbol, "buy", qty)] if qty > 0 else []
```

### Monthly rebalance to a target basket

The `_last_month` trick fires on the first trading day of each calendar
month:

```python
class MonthlyRebalance(Agent):
    def __init__(self):
        super().__init__()
        self._last_month = None

    def on_day(self, view, portfolio):
        if view.date.month == self._last_month:
            return []
        self._last_month = view.date.month
        # ... compute new target basket and emit buy/sell orders ...
```

See `examples/momentum.py` for a complete top-N momentum implementation.

### Reading signals from the cross-section

```python
def on_day(self, view, portfolio):
    rets = {
        s: view.cumulative_return(s, lookback_days=63)
        for s in self.universe
    }
    # Drop None (insufficient history)
    rets = {s: r for s, r in rets.items() if r is not None}
    winners = sorted(rets, key=rets.get, reverse=True)[:5]
    losers  = sorted(rets, key=rets.get)[:5]
    # ... emit orders ...
```

## Things to watch out for

- **Saturday/Sunday/holiday `as_of`**: `view.bar(symbol)` returns `None`
  on non-trading days. Use `view.last_bar(symbol)` or `view.close(symbol)`
  when you just need "the latest price as of now."
- **Fractional shares**: not supported. `Portfolio.buy` requires an integer
  quantity. Cast with `int()` after dividing cash by price.
- **Float drift**: prices and cash are `Decimal`. Avoid mixing in floats
  for anything that affects the portfolio. Use `Decimal(str(value))` to
  convert when needed.
- **The first bar has no `prev_close`**: bars at the very beginning of an
  asset's history have `daily_return_pct == None`. The `Agent.on_day`
  loop and `view.returns(...)` already filter these out, but be careful
  if you read bars directly.
- **Order quantity must be positive**: `Order(symbol, "sell", 0)` raises.
  Guard with `if qty > 0` before constructing.
- **Sharing state across backtests**: if you reuse an `Agent` instance,
  reset any internal state in `on_start`. The runner calls `on_start`
  once before the first day.
- **No future leakage from `Market`**: `Market.bar(symbol, on)` returns
  the bar for that exact date even if it's after your "as of" point. If
  you're inside an agent, you should be reading from `view`, not from the
  market directly. The market object exists for setup and post-hoc
  analysis.

## File map

```
fairytale/
├── __init__.py        public API surface
├── _client.py         Supabase client (singleton)
├── models.py          Asset, Bar dataclasses
├── market.py          Market class (history cache, bar / close lookups)
├── as_of.py           AsOfView (point-in-time queries)
├── portfolio.py       Position, Portfolio (cash + holdings bookkeeping)
├── broker.py          Order, Fill, SimulatedBroker
├── agent.py           Agent base class
├── backtest.py        Backtest runner, BacktestResult, DailySnapshot
└── AGENTS.md          this file
```

If you are an AI agent reading this to figure out how to use the SDK: the
fastest path to a working strategy is to copy the structure of
`examples/momentum.py` and replace the ranking function with whatever
signal you want to trade on. The plumbing (orders, fills, portfolio
accounting, leak guards) is already taken care of.
