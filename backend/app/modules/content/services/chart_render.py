"""Render a draft's `chart_data` to PNG (M4 TZ Phase 3 chart/data visualisation).

chart_data: {"type": "bar"|"line"|"pie", "labels": [str], "series": [{"name": str, "values": [number]}]}
chart_config (optional): {"title": str, "colors": ["#rrggbb", ...]}
"""

from __future__ import annotations

from io import BytesIO
from typing import Any

import matplotlib

matplotlib.use("Agg")  # headless: no display in the worker container
import matplotlib.pyplot as plt  # noqa: E402

DEFAULT_COLORS = ["#8d68ff", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#6b7280"]
CHART_TYPES = {"bar", "line", "pie"}


class InvalidChartData(ValueError):
    pass


def validate(data: Any) -> tuple[str, list[str], list[dict]]:
    if not isinstance(data, dict):
        raise InvalidChartData("chart_data must be an object")
    kind = str(data.get("type") or "bar")
    if kind not in CHART_TYPES:
        raise InvalidChartData(f"Unsupported chart type: {kind}")
    labels = [str(x) for x in (data.get("labels") or [])]
    series = data.get("series") or []
    if not labels or not isinstance(series, list) or not series:
        raise InvalidChartData("chart_data needs labels and at least one series")
    clean = []
    for s in series:
        try:
            values = [float(v) for v in (s.get("values") or [])]
        except (TypeError, ValueError, AttributeError):
            raise InvalidChartData("series values must be numbers")
        if len(values) != len(labels):
            raise InvalidChartData("each series needs one value per label")
        clean.append({"name": str(s.get("name") or ""), "values": values})
    if kind == "pie" and len(clean) != 1:
        raise InvalidChartData("pie charts take exactly one series")
    return kind, labels, clean


def render_chart_png(data: Any, config: dict | None = None) -> bytes:
    kind, labels, series = validate(data)
    config = config or {}
    colors = [c for c in (config.get("colors") or []) if isinstance(c, str)] or DEFAULT_COLORS
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    try:
        if kind == "pie":
            ax.pie(series[0]["values"], labels=labels, colors=colors[: len(labels)] if len(colors) >= len(labels) else None,
                   autopct="%1.0f%%", startangle=90)
            ax.axis("equal")
        elif kind == "line":
            for i, s in enumerate(series):
                ax.plot(labels, s["values"], marker="o", color=colors[i % len(colors)], label=s["name"] or None)
        else:
            width = 0.8 / len(series)
            for i, s in enumerate(series):
                xs = [x + i * width for x in range(len(labels))]
                ax.bar(xs, s["values"], width, color=colors[i % len(colors)], label=s["name"] or None)
            ax.set_xticks([x + width * (len(series) - 1) / 2 for x in range(len(labels))])
            ax.set_xticklabels(labels)
        if kind != "pie":
            ax.spines[["top", "right"]].set_visible(False)
            ax.grid(axis="y", alpha=0.25)
        if any(s["name"] for s in series) and kind != "pie":
            ax.legend(frameon=False)
        if config.get("title"):
            ax.set_title(str(config["title"]))
        fig.tight_layout()
        buf = BytesIO()
        fig.savefig(buf, format="png")
        return buf.getvalue()
    finally:
        plt.close(fig)
