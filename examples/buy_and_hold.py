"""Buy-and-hold the Nifty 50 from 2020 to today, all-in on day one.

    poetry run python examples/buy_and_hold.py
"""
from decimal import Decimal

from fairytale import Agent, Backtest, Order


class BuyAndHold(Agent):
    """Spend all cash on one symbol on day one, then sit."""

    def __init__(self, symbol: str = "NIFTY50") -> None:
        super().__init__(name=f"BuyAndHold({symbol})")
        self.symbol = symbol

    def on_day(self, view, portfolio):
        if self.symbol in portfolio.positions:
            return []
        price = view.close(self.symbol)
        if price is None or price <= 0:
            return []
        qty = int(portfolio.cash / price)
        if qty <= 0:
            return []
        return [Order(symbol=self.symbol, side="buy", quantity=qty)]


if __name__ == "__main__":
    bt = Backtest(BuyAndHold("NIFTY50"), starting_cash=Decimal("100000"))
    result = bt.run("2020-01-01", "2025-12-31")
    print(result.summary())
    print("Final positions:")
    for pos in result.final_portfolio.positions.values():
        print(f"  {pos.symbol}  qty={pos.quantity}  avg_cost={pos.avg_cost:.2f}")
