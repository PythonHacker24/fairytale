"""AsOfView: query the market as it would have been known on a given date.

The contract: nothing this view returns may come from a date strictly after
``view.date``. Strategies built on top can be safely walked through historical
time without leaking the future into their decisions.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from fairytale.models import Bar

if TYPE_CHECKING:
    from fairytale.market import Market


class AsOfView:
    """A market view frozen at one anchor date."""

    def __init__(self, market: "Market", anchor: date) -> None:
        self.market = market
        self.date = anchor

    def __repr__(self) -> str:
        return f"AsOfView(as_of={self.date.isoformat()})"

    # ------------------------------------------------------------------
    # Single-asset
    # ------------------------------------------------------------------

    def close(self, symbol: str) -> Optional[Decimal]:
        """Most recent close on or before the anchor date.

        Returns ``None`` only if the asset has no history at all by the anchor.
        """
        bar = self.market.last_bar(symbol, self.date)
        return bar.close if bar is not None else None

    def bar(self, symbol: str) -> Optional[Bar]:
        """Bar exactly on the anchor date. ``None`` if the market was closed."""
        return self.market.bar(symbol, self.date)

    def last_bar(self, symbol: str) -> Optional[Bar]:
        """Most recent bar on or before the anchor date."""
        return self.market.last_bar(symbol, self.date)

    def bars(
        self,
        symbol: str,
        lookback_days: Optional[int] = None,
    ) -> list[Bar]:
        """Historical bars ending on or before the anchor.

        ``lookback_days`` is in trading days (not calendar days). ``None``
        returns the asset's full history up to the anchor.
        """
        bars = self.market.bars(symbol, end=self.date)
        if lookback_days is None:
            return bars
        return bars[-lookback_days:]

    def returns(self, symbol: str, lookback_days: int) -> list[float]:
        """List of daily-return percentages over the lookback window.

        Returns at most ``lookback_days`` values. May return fewer if the asset
        has insufficient history (e.g. just IPO'd) since the very first bar
        has no prior close.
        """
        bars = self.bars(symbol, lookback_days=lookback_days)
        return [b.daily_return_pct for b in bars if b.daily_return_pct is not None]

    def cumulative_return(self, symbol: str, lookback_days: int) -> Optional[float]:
        """Compounded return over the lookback window as a fraction.

        Returns ``0.10`` for a 10% gain. ``None`` if data is insufficient.
        """
        rets = self.returns(symbol, lookback_days)
        if not rets:
            return None
        cum = 1.0
        for r in rets:
            cum *= 1.0 + r / 100.0
        return cum - 1.0

    # ------------------------------------------------------------------
    # Cross-asset
    # ------------------------------------------------------------------

    def closes(self, symbols: list[str]) -> dict[str, Optional[Decimal]]:
        """Most-recent closes on or before the anchor for several symbols."""
        return {s: self.close(s) for s in symbols}

    def advance(self, days: int = 1) -> "AsOfView":
        """A new view shifted forward by ``days`` calendar days.

        Note: this moves the anchor by calendar time, which may land on a
        non-trading day. Use ``Market.trading_days`` to iterate trading days
        precisely.
        """
        return AsOfView(self.market, self.date + timedelta(days=days))
