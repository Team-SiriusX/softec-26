from typing import Any

from models import AnalyticsContext, AnomalyContext, ShiftContext, WorkerContext

from .fetcher import (
    fetch_analytics_context,
    fetch_anomaly_context,
    fetch_shift_context,
)


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        normalized = value.strip().replace(",", "")
        if not normalized:
            return default
        try:
            return float(normalized)
        except ValueError:
            return default

    return default


def _extract_list(payload: Any, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if not isinstance(payload, dict):
        return []

    for key in keys:
        candidate = payload.get(key)
        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)]

        if isinstance(candidate, dict):
            for nested_key in ("data", "items", "results", "flags", "anomalies"):
                nested_candidate = candidate.get(nested_key)
                if isinstance(nested_candidate, list):
                    return [
                        item for item in nested_candidate if isinstance(item, dict)
                    ]

    return []


def _read_first(payload: dict[str, Any], keys: tuple[str, ...], default: Any) -> Any:
    for key in keys:
        value = payload.get(key)
        if value is not None:
            return value
    return default


def build_worker_context(
    worker_id: str,
    raw_shifts: dict,
    raw_anomalies: dict,
    raw_analytics: dict,
) -> WorkerContext:
    shifts_payload = raw_shifts if isinstance(raw_shifts, dict) else {}
    anomalies_payload = raw_anomalies if isinstance(raw_anomalies, dict) else {}
    analytics_payload = raw_analytics if isinstance(raw_analytics, dict) else {}

    shifts = _extract_list(shifts_payload, ("data", "shifts", "items", "results"))

    total_shifts = len(shifts)
    total_gross = 0.0
    total_net = 0.0
    total_deductions = 0.0
    total_hours = 0.0
    platform_rollup: dict[str, dict[str, Any]] = {}

    for shift in shifts:
        gross = _to_float(
            _read_first(shift, ("grossEarned", "gross_earned", "gross"), 0.0)
        )
        net = _to_float(
            _read_first(shift, ("netReceived", "net_received", "net"), 0.0)
        )
        deductions = _to_float(
            _read_first(
                shift,
                ("platformDeductions", "platform_deductions", "deductions"),
                0.0,
            )
        )
        hours = _to_float(
            _read_first(shift, ("hoursWorked", "hours_worked", "hours"), 0.0)
        )

        platform_value = _read_first(
            shift,
            ("platformName", "platform_name", "platform"),
            "Unknown",
        )
        if isinstance(platform_value, dict):
            platform_name = str(platform_value.get("name") or "Unknown")
        else:
            platform_name = str(platform_value or "Unknown")

        total_gross += gross
        total_net += net
        total_deductions += deductions
        total_hours += hours

        current = platform_rollup.setdefault(
            platform_name,
            {"platform": platform_name, "count": 0, "net": 0.0},
        )
        current["count"] += 1
        current["net"] += net

    avg_hourly_rate = total_net / total_hours if total_hours > 0 else 0.0

    platform_breakdown = [
        {
            "platform": str(item["platform"]),
            "count": int(item["count"]),
            "net": float(item["net"]),
        }
        for item in platform_rollup.values()
    ]

    shift_context = ShiftContext(
        total_shifts=total_shifts,
        total_gross=total_gross,
        total_net=total_net,
        total_deductions=total_deductions,
        avg_hourly_rate=avg_hourly_rate,
        period_days=30,
        platform_breakdown=platform_breakdown,
    )

    raw_flags = _extract_list(
        anomalies_payload,
        ("flags", "anomalies", "data", "items", "results"),
    )

    normalized_flags: list[dict[str, Any]] = []
    severity_rank = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    highest_severity: str | None = None
    highest_score = 0

    for flag in raw_flags:
        severity_value = str(
            _read_first(flag, ("severity",), "low")
        ).strip().lower()
        if severity_value not in severity_rank:
            severity_value = "low"

        normalized_flag = {
            "type": str(_read_first(flag, ("type",), "unknown")),
            "severity": severity_value,
            "explanation": str(
                _read_first(flag, ("explanation", "message", "reason"), "")
            ),
            "week": str(
                _read_first(flag, ("week", "weekStart", "week_start", "date"), "")
            ),
        }
        normalized_flags.append(normalized_flag)

        score = severity_rank[severity_value]
        if score > highest_score:
            highest_score = score
            highest_severity = severity_value

    anomaly_context = AnomalyContext(
        flags=normalized_flags,
        has_active_flags=len(normalized_flags) > 0,
        highest_severity=highest_severity,
    )

    summary_payload = analytics_payload.get("summary")
    summary = summary_payload if isinstance(summary_payload, dict) else {}

    worker_median = _to_float(
        _read_first(
            analytics_payload,
            ("worker_median", "workerMedian"),
            _read_first(summary, ("worker_median", "workerMedian"), 0.0),
        )
    )
    city_median = _to_float(
        _read_first(
            analytics_payload,
            ("city_median", "cityMedian"),
            _read_first(summary, ("city_median", "cityMedian"), 0.0),
        )
    )

    gap_percentage = (
        ((city_median - worker_median) / city_median) * 100.0 if city_median else 0.0
    )

    analytics_context = AnalyticsContext(
        worker_median=worker_median,
        city_median=city_median,
        gap_percentage=gap_percentage,
        worker_category=str(
            _read_first(
                analytics_payload,
                ("worker_category", "workerCategory", "category"),
                _read_first(
                    summary,
                    ("worker_category", "workerCategory", "category"),
                    "",
                ),
            )
            or ""
        ),
        city=str(
            _read_first(
                analytics_payload,
                ("city",),
                _read_first(summary, ("city",), ""),
            )
            or ""
        ),
    )

    return WorkerContext(
        worker_id=worker_id,
        shifts=shift_context,
        anomalies=anomaly_context,
        analytics=analytics_context,
    )


async def build_runtime_context(worker_id: str) -> dict[str, Any]:
    _ = fetch_shift_context
    _ = fetch_anomaly_context
    _ = fetch_analytics_context
    _ = worker_id
    # TODO: Aggregate and normalize worker context for RAG retrieval.
    pass


def summarize_context(raw_context: dict[str, Any]) -> str:
    _ = raw_context
    # TODO: Build concise context summary for prompt injection.
    pass
