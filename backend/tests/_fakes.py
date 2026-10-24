"""Lightweight fakes for unit-testing endpoint functions without a real DB.

These stand in for AsyncSession.execute(...) results: enough of the
SQLAlchemy Result surface (scalar_one_or_none / scalar_one / scalars().all())
for the endpoint code under test, nothing more.
"""

from __future__ import annotations

from typing import Any


class FakeScalars:
    def __init__(self, items: list[Any]) -> None:
        self._items = items

    def all(self) -> list[Any]:
        return self._items


class FakeResult:
    def __init__(self, items: list[Any] | None = None, scalar: Any = None) -> None:
        self._items = items or []
        self._scalar = scalar

    def all(self) -> list[Any]:
        return self._items

    def scalar_one_or_none(self) -> Any:
        if self._items:
            return self._items[0]
        return self._scalar

    def scalar_one(self) -> Any:
        val = self.scalar_one_or_none()
        if val is None and self._scalar is not None:
            return self._scalar
        return val

    def scalars(self) -> FakeScalars:
        return FakeScalars(self._items)


class FakeSession:
    """Replays a queue of FakeResult objects, one per execute() call, in order."""

    def __init__(self, results: list[FakeResult]) -> None:
        self._results = list(results)
        self.flushed = False
        self.committed = False
        self.added: list[Any] = []
        self.store: dict[Any, Any] = {}

    async def execute(self, *_args: Any, **_kwargs: Any) -> FakeResult:
        if not self._results:
            return FakeResult()
        return self._results.pop(0)

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def get(self, _model: Any, key: Any) -> Any:
        return self.store.get(key)

    async def flush(self) -> None:
        self.flushed = True

    async def refresh(self, _obj: Any) -> None:
        pass

    async def commit(self) -> None:
        self.committed = True
