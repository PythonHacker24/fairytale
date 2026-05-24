"""fairytale: research SDK for Indian-market backtesting and AI trading agents.

A thin, object-oriented abstraction over the Supabase database backing the
fairytale web app. Lets you query market data for any asset on any date, view
the world as it would have been known on a given day (no future leakage), run
strategies through historical time, and build AI agents that trade against
simulated markets.

Quick start::

    from fairytale import Market

    m = Market()                        # picks up env vars / .env
    bars = m.bars("RELIANCE", "2024-01-01", "2024-12-31")
    view = m.as_of("2024-06-15")
    last = view.close("RELIANCE")       # close on or before that date

Backtesting::

    from fairytale import Agent, Backtest, Order
    from decimal import Decimal

    class BuyAndHold(Agent):
        def on_day(self, view, portfolio):
            if not portfolio.positions and view.close("NIFTY50"):
                qty = int(portfolio.cash / view.close("NIFTY50"))
                return [Order("NIFTY50", "buy", qty)]
            return []

    result = Backtest(BuyAndHold(), starting_cash=Decimal("100000")).run(
        "2020-01-01", "2025-12-31"
    )
    print(f"Total return: {result.total_return_pct:.2f}%")
"""

from fairytale.agent import Agent
from fairytale.as_of import AsOfView
from fairytale.backtest import Backtest, BacktestResult, DailySnapshot
from fairytale.broker import Fill, Order, SimulatedBroker
from fairytale.market import Market
from fairytale.models import Asset, Bar
from fairytale.portfolio import Portfolio, Position

__version__ = "0.1.0"

__all__ = [
    "Agent",
    "Asset",
    "AsOfView",
    "Backtest",
    "BacktestResult",
    "Bar",
    "DailySnapshot",
    "Fill",
    "Market",
    "Order",
    "Portfolio",
    "Position",
    "SimulatedBroker",
]
