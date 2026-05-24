"""Portfolio: cash plus open positions.

Used by the simulated broker and the backtest runner. Pure bookkeeping; no
market access of its own.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fairytale.as_of import AsOfView


@dataclass
class Position:
    """One open position. ``avg_cost`` is the weighted average entry price."""

    symbol: str
    quantity: int
    avg_cost: Decimal

    def market_value(self, price: Decimal) -> Decimal:
        return price * self.quantity

    def unrealized_pnl(self, price: Decimal) -> Decimal:
        return (price - self.avg_cost) * self.quantity


@dataclass
class Portfolio:
    """Cash + positions. Tracks starting cash for total-return calculations.

    All trades mutate this object in place. The broker is responsible for
    determining the fill price; the portfolio just records it.
    """

    starting_cash: Decimal
    cash: Decimal = field(init=False)
    positions: dict[str, Position] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.cash = Decimal(self.starting_cash)

    # ------------------------------------------------------------------

    def buy(self, symbol: str, quantity: int, price: Decimal) -> None:
        if quantity <= 0:
            raise ValueError(f"Buy quantity must be positive, got {quantity}")
        cost = price * quantity
        if cost > self.cash:
            raise ValueError(
                f"Insufficient cash for {symbol} x{quantity} @ {price}: "
                f"need {cost}, have {self.cash}"
            )
        self.cash -= cost
        existing = self.positions.get(symbol)
        if existing is None:
            self.positions[symbol] = Position(symbol, quantity, price)
        else:
            new_qty = existing.quantity + quantity
            new_avg = (
                existing.avg_cost * existing.quantity + price * quantity
            ) / new_qty
            self.positions[symbol] = Position(symbol, new_qty, new_avg)

    def sell(self, symbol: str, quantity: int, price: Decimal) -> None:
        if quantity <= 0:
            raise ValueError(f"Sell quantity must be positive, got {quantity}")
        existing = self.positions.get(symbol)
        if existing is None:
            raise ValueError(f"No open position in {symbol}")
        if quantity > existing.quantity:
            raise ValueError(
                f"Cannot sell {quantity} of {symbol}; only own {existing.quantity}"
            )
        self.cash += price * quantity
        remaining = existing.quantity - quantity
        if remaining == 0:
            del self.positions[symbol]
        else:
            self.positions[symbol] = Position(symbol, remaining, existing.avg_cost)

    # ------------------------------------------------------------------

    def total_value(self, view: "AsOfView") -> Decimal:
        """Cash + sum of position values priced at the view's last close."""
        total = self.cash
        for pos in self.positions.values():
            price = view.close(pos.symbol)
            if price is not None:
                total += pos.market_value(price)
        return total

    def equity_value(self, view: "AsOfView") -> Decimal:
        """Just the positions side. Excludes cash."""
        total = Decimal(0)
        for pos in self.positions.values():
            price = view.close(pos.symbol)
            if price is not None:
                total += pos.market_value(price)
        return total

    def total_return(self, view: "AsOfView") -> float:
        """Total return vs starting cash, as a fraction."""
        if self.starting_cash == 0:
            return 0.0
        return float((self.total_value(view) - self.starting_cash) / self.starting_cash)
