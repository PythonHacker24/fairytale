"""Backtest: walk an Agent through historical time and report what happened."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Optional

from fairytale.agent import Agent
from fairytale.broker import Fill, SimulatedBroker
from fairytale.market import DateLike, Market, _to_date
from fairytale.portfolio import Portfolio


@dataclass(frozen=True)
class DailySnapshot:
    """End-of-day record of the portfolio's state and what the agent did."""

    date: date
    cash: Decimal
    equity_value: Decimal
    total_value: Decimal
    fills: tuple[Fill, ...]


@dataclass
class BacktestResult:
    """Aggregate output of a backtest run."""

    snapshots: list[DailySnapshot]
    final_portfolio: Portfolio
    starting_cash: Decimal

    # ------------------------------------------------------------------
    # Summary statistics
    # ------------------------------------------------------------------

    @property
    def start_date(self) -> Optional[date]:
        return self.snapshots[0].date if self.snapshots else None

    @property
    def end_date(self) -> Optional[date]:
        return self.snapshots[-1].date if self.snapshots else None

    @property
    def final_value(self) -> Decimal:
        return (
            self.snapshots[-1].total_value if self.snapshots else self.starting_cash
        )

    @property
    def total_return(self) -> float:
        if self.starting_cash == 0:
            return 0.0
        return float((self.final_value - self.starting_cash) / self.starting_cash)

    @property
    def total_return_pct(self) -> float:
        return self.total_return * 100.0

    @property
    def n_days(self) -> int:
        return len(self.snapshots)

    @property
    def n_trades(self) -> int:
        return sum(len(s.fills) for s in self.snapshots)

    @property
    def cagr(self) -> float:
        """Compound annual growth rate."""
        if not self.snapshots or self.starting_cash == 0:
            return 0.0
        first, last = self.snapshots[0].date, self.snapshots[-1].date
        years = (last - first).days / 365.25
        if years <= 0:
            return 0.0
        return float((self.final_value / self.starting_cash) ** Decimal(1 / years) - 1)

    def to_records(self) -> list[dict]:
        """Snapshots as plain dicts; handy for pandas / JSON dumps."""
        return [
            {
                "date": s.date.isoformat(),
                "cash": float(s.cash),
                "equity_value": float(s.equity_value),
                "total_value": float(s.total_value),
                "n_fills": len(s.fills),
            }
            for s in self.snapshots
        ]

    def summary(self) -> str:
        """Human-readable one-paragraph summary."""
        if not self.snapshots:
            return "Backtest produced no snapshots."
        return (
            f"{self.start_date.isoformat()} → {self.end_date.isoformat()} · "
            f"{self.n_days} trading days · {self.n_trades} fills · "
            f"start {self.starting_cash} → end {self.final_value:.2f} · "
            f"total {self.total_return_pct:+.2f}% · CAGR {self.cagr * 100:+.2f}%"
        )


@dataclass
class Backtest:
    """Run an Agent against historical market data.

    Usage::

        bt = Backtest(MyAgent(), starting_cash=Decimal("100000"))
        result = bt.run("2020-01-01", "2025-12-31")
        print(result.summary())
    """

    agent: Agent
    starting_cash: Decimal = Decimal("100000")
    broker: SimulatedBroker = field(default_factory=SimulatedBroker)
    market: Market = field(default_factory=Market)
    calendar_symbol: str = "NIFTY50"

    def run(self, start: DateLike, end: DateLike) -> BacktestResult:
        portfolio = Portfolio(starting_cash=self.starting_cash)
        days = self.market.trading_days(
            start=_to_date(start),
            end=_to_date(end),
            calendar_symbol=self.calendar_symbol,
        )

        self.agent.on_start(portfolio)

        snapshots: list[DailySnapshot] = []
        for d in days:
            view = self.market.as_of(d)
            orders = list(self.agent.on_day(view, portfolio) or [])
            fills: list[Fill] = []
            for order in orders:
                try:
                    fill = self.broker.execute(order, view, portfolio)
                except ValueError:
                    # Skip impossible fills (closed market, insufficient cash,
                    # over-sell). Strategies are responsible for sanity; we
                    # don't crash the whole backtest over one bad day.
                    continue
                fills.append(fill)

            snapshots.append(
                DailySnapshot(
                    date=d,
                    cash=portfolio.cash,
                    equity_value=portfolio.equity_value(view),
                    total_value=portfolio.total_value(view),
                    fills=tuple(fills),
                )
            )

        self.agent.on_end(portfolio)

        return BacktestResult(
            snapshots=snapshots,
            final_portfolio=portfolio,
            starting_cash=self.starting_cash,
        )
