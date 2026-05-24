"""Domain dataclasses: Asset (one tradeable instrument) and Bar (one daily OHLCV row)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal, Optional


@dataclass(frozen=True)
class Asset:
    """A tradeable instrument: an index or a constituent stock."""

    id: int
    symbol: str
    slug: str
    name: str
    type: Literal["index", "stock"]
    category: str

    def __repr__(self) -> str:
        return f"Asset({self.symbol} · {self.name})"


@dataclass(frozen=True)
class Bar:
    """One day's OHLCV bar for one asset.

    ``prev_close`` is the close of the previous trading day (may be ``None``
    on the first bar of the asset's history). ``daily_return`` and
    ``daily_return_pct`` are computed lazily from ``close`` and ``prev_close``.
    """

    asset_id: int
    symbol: str
    date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Optional[int] = None
    prev_close: Optional[Decimal] = None

    @property
    def daily_return(self) -> Optional[float]:
        """Fraction change vs prior close. None if no prior close."""
        if self.prev_close is None or self.prev_close == 0:
            return None
        return float((self.close - self.prev_close) / self.prev_close)

    @property
    def daily_return_pct(self) -> Optional[float]:
        r = self.daily_return
        return r * 100 if r is not None else None

    @property
    def intraday_change_pct(self) -> Optional[float]:
        """Open-to-close percent change."""
        if self.open == 0:
            return None
        return float((self.close - self.open) / self.open) * 100

    def __repr__(self) -> str:
        return f"Bar({self.symbol} {self.date} close={self.close})"
