"""Cross-sectional momentum: each month, hold the top-N stocks by past-12M return.

Rebalances on the first trading day of each month. Equal-weights the picks.

    poetry run python examples/momentum.py
"""
from decimal import Decimal

from fairytale import Agent, Backtest, Order, Market


class Momentum(Agent):
    """Top-N past-12M total-return momentum, monthly rebalance, equal weight."""

    def __init__(self, universe: list[str], top_n: int = 5, lookback_days: int = 252):
        super().__init__(name=f"Momentum(top={top_n})")
        self.universe = universe
        self.top_n = top_n
        self.lookback_days = lookback_days
        self._last_month: int | None = None

    def on_day(self, view, portfolio):
        # Rebalance only on the first trading day we see in each calendar month.
        if view.date.month == self._last_month:
            return []
        self._last_month = view.date.month

        # Rank universe by trailing return; drop symbols with insufficient history.
        ranked: list[tuple[str, float]] = []
        for sym in self.universe:
            cum = view.cumulative_return(sym, self.lookback_days)
            if cum is not None:
                ranked.append((sym, cum))
        ranked.sort(key=lambda x: x[1], reverse=True)
        target = {sym for sym, _ in ranked[: self.top_n]}

        held = set(portfolio.positions.keys())
        orders: list[Order] = []

        # 1. Sell anything we hold that's no longer in the target set.
        for sym in held - target:
            qty = portfolio.positions[sym].quantity
            orders.append(Order(sym, "sell", qty))

        # 2. Buy new picks, equal-weighted across whatever cash will exist
        #    after the sales above. Approximation: use current cash as the
        #    notional budget, divided by number of new buys. Good enough for
        #    a demo; production code would compute pro-forma cash.
        new_buys = list(target - held)
        if new_buys:
            budget_per = portfolio.cash / max(len(new_buys), 1)
            for sym in new_buys:
                price = view.close(sym)
                if price is None or price <= 0:
                    continue
                qty = int(budget_per / price)
                if qty > 0:
                    orders.append(Order(sym, "buy", qty))

        return orders


if __name__ == "__main__":
    market = Market()
    # All Nifty 50 constituent stocks (exclude the indexes themselves).
    universe = [a.symbol for a in market.assets() if a.type == "stock"]
    print(f"Universe: {len(universe)} stocks")

    bt = Backtest(
        Momentum(universe=universe, top_n=5, lookback_days=252),
        starting_cash=Decimal("100000"),
        market=market,
    )
    result = bt.run("2020-01-01", "2025-12-31")
    print(result.summary())
    print("\nFinal positions:")
    for pos in result.final_portfolio.positions.values():
        print(f"  {pos.symbol:<12} qty={pos.quantity:>4}  avg_cost={pos.avg_cost:>10.2f}")
