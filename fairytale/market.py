"""Market: top-level entry point for reading market data."""
from __future__ import annotations

from bisect import bisect_right
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Union

from fairytale._client import SupabaseClient
from fairytale.models import Asset, Bar

DateLike = Union[str, date, datetime]

# Supabase / PostgREST defaults cap responses at 1000 rows. 10y of daily
# bars per asset is ~2500, so we paginate.
_PAGE_SIZE = 1000


def _to_date(d: DateLike) -> date:
    """Coerce strings / datetimes to date."""
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    return datetime.fromisoformat(str(d)).date()


class Market:
    """Read market data from Supabase.

    Methods:
      * ``assets()`` / ``asset(symbol)`` — universe metadata
      * ``bars(symbol, start, end)`` — OHLCV time series
      * ``bar(symbol, on)`` — one day's bar
      * ``closes(symbols, on)`` — closing prices across assets on one date
      * ``trading_days(start, end)`` — distinct trading dates
      * ``as_of(when)`` — a point-in-time view; see ``AsOfView``

    Once an asset's full history is loaded (via any bars/bar call), it is
    cached in memory for the lifetime of this Market instance. Subsequent
    lookups for that symbol are local. This makes backtests fast: a 1,500-day
    walk over one symbol becomes a handful of DB calls plus 1,500 local
    binary searches.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
    ) -> None:
        self._db = SupabaseClient.get(supabase_url, supabase_key)
        self._asset_cache: Optional[list[Asset]] = None
        self._by_symbol: Optional[dict[str, Asset]] = None
        # Symbol -> full chronological history of Bar, ascending by date.
        self._history: dict[str, list[Bar]] = {}
        # Parallel list of dates for binary search.
        self._history_dates: dict[str, list[date]] = {}

    # ------------------------------------------------------------------
    # Universe
    # ------------------------------------------------------------------

    def assets(self, refresh: bool = False) -> list[Asset]:
        """All tradeable instruments in the database, sorted by symbol.

        Cached after the first call. Pass ``refresh=True`` to re-fetch.
        """
        if self._asset_cache is None or refresh:
            res = (
                self._db.table("assets")
                .select("id, symbol, slug, name, type, category")
                .order("symbol")
                .execute()
            )
            self._asset_cache = [self._row_to_asset(r) for r in (res.data or [])]
            self._by_symbol = {a.symbol: a for a in self._asset_cache}
        return self._asset_cache

    def asset(self, symbol: str) -> Asset:
        """Look up one asset by symbol. Raises if not found."""
        self.assets()  # ensure cache populated
        if symbol not in (self._by_symbol or {}):
            raise ValueError(f"Unknown asset symbol: {symbol!r}")
        return self._by_symbol[symbol]

    def symbols(self, category: Optional[str] = None) -> list[str]:
        """List all symbols, optionally filtered by sector category."""
        ax = self.assets()
        if category is not None:
            ax = [a for a in ax if a.category == category]
        return [a.symbol for a in ax]

    # ------------------------------------------------------------------
    # Bars
    # ------------------------------------------------------------------

    def history(self, symbol: str) -> list[Bar]:
        """Full chronological history for one symbol. Cached after first call.

        This is the primitive every other bar method delegates to. Call it
        explicitly to warm the cache before a backtest, or just let lazy
        loading do its thing.
        """
        if symbol not in self._history:
            asset = self.asset(symbol)
            rows = self._paginate(
                lambda: (
                    self._db.table("prices_enriched")
                    .select(
                        "asset_id, date, open, high, low, close, volume, prev_close"
                    )
                    .eq("asset_id", asset.id)
                    .order("date")
                )
            )
            bars = [self._row_to_bar(r, asset.symbol) for r in rows]
            self._history[symbol] = bars
            self._history_dates[symbol] = [b.date for b in bars]
        return self._history[symbol]

    def warm(self, symbols: list[str]) -> None:
        """Pre-fetch full histories for a list of symbols. Optional, idempotent."""
        for s in symbols:
            self.history(s)

    def bars(
        self,
        symbol: str,
        start: Optional[DateLike] = None,
        end: Optional[DateLike] = None,
    ) -> list[Bar]:
        """Time series of OHLCV bars for one asset.

        ``start`` and ``end`` are inclusive. Either or both may be omitted.
        Returns bars in ascending date order.
        """
        history = self.history(symbol)
        if start is None and end is None:
            return list(history)

        dates = self._history_dates[symbol]
        lo = 0 if start is None else self._left_index(dates, _to_date(start))
        hi = len(history) if end is None else self._right_index(dates, _to_date(end))
        return history[lo:hi]

    def bar(self, symbol: str, on: DateLike) -> Optional[Bar]:
        """One bar for an exact trading date. ``None`` if the market was closed."""
        on_date = _to_date(on)
        dates = self._history_dates.get(symbol) or [
            b.date for b in self.history(symbol)
        ]
        i = bisect_right(dates, on_date) - 1
        if i < 0:
            return None
        bar = self._history[symbol][i]
        return bar if bar.date == on_date else None

    def last_bar(self, symbol: str, on_or_before: DateLike) -> Optional[Bar]:
        """The most recent bar on or before a given date.

        Useful when ``on_or_before`` may fall on a weekend or holiday.
        """
        cutoff = _to_date(on_or_before)
        self.history(symbol)  # ensure loaded
        dates = self._history_dates[symbol]
        i = bisect_right(dates, cutoff) - 1
        if i < 0:
            return None
        return self._history[symbol][i]

    # ------------------------------------------------------------------
    # Cross-asset slices
    # ------------------------------------------------------------------

    def closes(
        self, symbols: list[str], on: DateLike
    ) -> dict[str, Optional[Decimal]]:
        """Closing prices for several symbols on one date.

        Symbols with no bar on that date map to ``None``. (e.g. weekends.)
        """
        on_date = _to_date(on)
        out: dict[str, Optional[Decimal]] = {}
        for s in symbols:
            b = self.bar(s, on_date)
            out[s] = b.close if b is not None else None
        return out

    def trading_days(
        self,
        start: Optional[DateLike] = None,
        end: Optional[DateLike] = None,
        calendar_symbol: str = "NIFTY50",
    ) -> list[date]:
        """Distinct trading dates, using ``calendar_symbol`` as the reference calendar.

        Defaults to NIFTY50, which has the most consistent coverage. Pass a
        different symbol if you need that asset's specific trading days.
        """
        bars = self.bars(calendar_symbol, start=start, end=end)
        return [b.date for b in bars]

    # ------------------------------------------------------------------
    # Point-in-time view
    # ------------------------------------------------------------------

    def as_of(self, when: DateLike) -> "AsOfView":
        """Return a view of the market frozen at ``when``.

        Methods on the view never return data from after ``when``, so
        backtests can't accidentally peek into the future.
        """
        from fairytale.as_of import AsOfView

        return AsOfView(self, _to_date(when))

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _left_index(dates: list[date], target: date) -> int:
        """Leftmost index i such that dates[i] >= target."""
        from bisect import bisect_left

        return bisect_left(dates, target)

    @staticmethod
    def _right_index(dates: list[date], target: date) -> int:
        """Index strictly past the last element where dates[i] <= target."""
        return bisect_right(dates, target)

    def _paginate(self, query_factory) -> list[dict]:
        """Run a query in 1000-row pages and concatenate."""
        all_rows: list[dict] = []
        offset = 0
        while True:
            res = (
                query_factory()
                .range(offset, offset + _PAGE_SIZE - 1)
                .execute()
            )
            rows = res.data or []
            all_rows.extend(rows)
            if len(rows) < _PAGE_SIZE:
                break
            offset += _PAGE_SIZE
        return all_rows

    @staticmethod
    def _row_to_asset(row: dict) -> Asset:
        return Asset(
            id=int(row["id"]),
            symbol=row["symbol"],
            slug=row["slug"],
            name=row["name"],
            type=row["type"],
            category=row["category"],
        )

    @staticmethod
    def _row_to_bar(row: dict, symbol: str) -> Bar:
        pc = row.get("prev_close")
        return Bar(
            asset_id=int(row["asset_id"]),
            symbol=symbol,
            date=date.fromisoformat(row["date"]),
            open=Decimal(str(row["open"])),
            high=Decimal(str(row["high"])),
            low=Decimal(str(row["low"])),
            close=Decimal(str(row["close"])),
            volume=int(row["volume"]) if row.get("volume") is not None else None,
            prev_close=Decimal(str(pc)) if pc is not None else None,
        )
