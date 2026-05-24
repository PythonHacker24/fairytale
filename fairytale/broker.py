"""SimulatedBroker: turn Orders into Fills against historical bars.

The broker walks the bridge between an agent's intentions and the
``Portfolio``'s bookkeeping. It looks up the bar for the order's date, picks
a fill price based on its execution policy, and asks the portfolio to record
the trade.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from fairytale.as_of import AsOfView
from fairytale.portfolio import Portfolio


Side = Literal["buy", "sell"]


@dataclass(frozen=True)
class Order:
    """An agent's intention to trade."""

    symbol: str
    side: Side
    quantity: int

    def __post_init__(self) -> None:
        if self.quantity <= 0:
            raise ValueError(f"Order quantity must be positive, got {self.quantity}")
        if self.side not in ("buy", "sell"):
            raise ValueError(f"Order side must be 'buy' or 'sell', got {self.side!r}")


@dataclass(frozen=True)
class Fill:
    """The realised outcome of an executed order."""

    order: Order
    price: Decimal
    notional: Decimal


class SimulatedBroker:
    """Fills orders at the same-day bar's open or close price.

    ``execution="close"`` (default) is the simplest model: agents see the
    bar's close at end of day and pay that price. ``execution="open"``
    fills at the next day's open, which is closer to live trading semantics.

    A linear ``slippage_bps`` (basis points) widens the spread against you:
    you buy ``slippage_bps / 10000`` higher and sell ``slippage_bps / 10000``
    lower. Default is zero.
    """

    def __init__(
        self,
        execution: Literal["open", "close"] = "close",
        slippage_bps: float = 0.0,
    ) -> None:
        if execution not in ("open", "close"):
            raise ValueError(
                f"execution must be 'open' or 'close', got {execution!r}"
            )
        self.execution = execution
        self.slippage_bps = float(slippage_bps)

    def execute(
        self, order: Order, view: AsOfView, portfolio: Portfolio
    ) -> Fill:
        bar = view.bar(order.symbol)
        if bar is None:
            raise ValueError(
                f"No bar for {order.symbol} on {view.date.isoformat()}; "
                "market may have been closed."
            )
        base_price = bar.open if self.execution == "open" else bar.close
        price = self._apply_slippage(base_price, order.side)

        if order.side == "buy":
            portfolio.buy(order.symbol, order.quantity, price)
        else:
            portfolio.sell(order.symbol, order.quantity, price)

        return Fill(order=order, price=price, notional=price * order.quantity)

    def _apply_slippage(self, price: Decimal, side: Side) -> Decimal:
        if self.slippage_bps == 0:
            return price
        adj = Decimal(self.slippage_bps) / Decimal(10_000)
        if side == "buy":
            return price * (Decimal(1) + adj)
        return price * (Decimal(1) - adj)
