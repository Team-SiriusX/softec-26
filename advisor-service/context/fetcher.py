import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

DEFAULT_FAIRGIG_API_URL = "http://localhost:3000"

DEFAULT_SHIFT_CONTEXT: dict[str, Any] = {
    "total_shifts": 0,
    "total_gross": 0.0,
    "total_net": 0.0,
    "total_deductions": 0.0,
    "avg_hourly_rate": 0.0,
    "period_days": 30,
    "platform_breakdown": [],
}

DEFAULT_ANOMALY_CONTEXT: dict[str, Any] = {
    "flags": [],
    "has_active_flags": False,
    "highest_severity": None,
}

DEFAULT_ANALYTICS_CONTEXT: dict[str, Any] = {
    "worker_median": 0.0,
    "city_median": 0.0,
    "gap_percentage": 0.0,
    "worker_category": "",
    "city": "",
}


def _base_url() -> str:
    return os.getenv("FAIRGIG_API_URL", DEFAULT_FAIRGIG_API_URL).rstrip("/")


async def _get_json(
    path: str,
    params: dict[str, str],
    fallback: dict[str, Any],
) -> dict[str, Any]:
    url = f"{_base_url()}{path}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()

        if isinstance(payload, dict):
            return payload
    except (httpx.HTTPError, ValueError, TypeError):
        return fallback.copy()

    return fallback.copy()


async def fetch_shift_context(worker_id: str) -> dict[str, Any]:
    return await _get_json(
        "/api/shifts",
        {"workerId": worker_id, "days": "30"},
        DEFAULT_SHIFT_CONTEXT,
    )


async def fetch_anomaly_context(worker_id: str) -> dict[str, Any]:
    return await _get_json(
        "/api/anomaly/flags",
        {"workerId": worker_id, "limit": "5"},
        DEFAULT_ANOMALY_CONTEXT,
    )


async def fetch_analytics_context(worker_id: str) -> dict[str, Any]:
    return await _get_json(
        "/api/analytics/summary",
        {"workerId": worker_id},
        DEFAULT_ANALYTICS_CONTEXT,
    )
