from typing import Any

from .fetcher import (
    fetch_worker_earnings,
    fetch_worker_grievances,
    fetch_worker_profile,
)


async def build_runtime_context(worker_id: str) -> dict[str, Any]:
    _ = fetch_worker_profile
    _ = fetch_worker_earnings
    _ = fetch_worker_grievances
    _ = worker_id
    # TODO: Aggregate and normalize worker context for RAG retrieval.
    pass


def summarize_context(raw_context: dict[str, Any]) -> str:
    _ = raw_context
    # TODO: Build concise context summary for prompt injection.
    pass
