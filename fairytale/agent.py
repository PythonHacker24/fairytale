"""Agent: base class for trading strategies / AI agents.

Subclass and implement ``on_day``. The runner calls it once per trading day,
passing a point-in-time view of the market and the current portfolio. Return
an iterable of orders to submit for that day.

Override ``on_start`` and ``on_end`` if you need setup or teardown hooks.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterable

from fairytale.as_of import AsOfView
from fairytale.broker import Order
from fairytale.portfolio import Portfolio


class Agent(ABC):
    """Base class for trading agents.

    The contract:
      * ``on_day(view, portfolio)`` is called once per trading day.
      * It may read anything from ``view`` (which never leaks the future).
      * It must return an iterable of ``Order``s. Empty iterable is fine.
      * The runner executes those orders via the broker, then snapshots
        the portfolio.

    Agents may carry state across days as ordinary instance attributes.
    """

    name: str = ""

    def __init__(self, name: str | None = None) -> None:
        self.name = name or type(self).__name__

    @abstractmethod
    def on_day(self, view: AsOfView, portfolio: Portfolio) -> Iterable[Order]:
        """Decide what to trade today. Called once per trading day."""

    def on_start(self, portfolio: Portfolio) -> None:
        """Optional hook: called once before the first trading day."""
        return None

    def on_end(self, portfolio: Portfolio) -> None:
        """Optional hook: called once after the last trading day."""
        return None

    def __repr__(self) -> str:
        return f"<Agent {self.name}>"
