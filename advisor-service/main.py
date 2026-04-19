import asyncio

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from context.builder import build_worker_context
from context.fetcher import (
    fetch_shift_context,
    fetch_anomaly_context,
    fetch_analytics_context,
)
from models import QueryRequest, QueryResponse
from rag.chain import run_advisor_chain
from vector_store.store import initialize_store

load_dotenv()

app = FastAPI(title="advisor-service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event() -> None:
    initialize_store()


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "advisor"}


@app.post("/advisor/query", response_model=QueryResponse)
async def advisor_query(
    payload: QueryRequest,
    x_request_id: str | None = Header(default=None),
) -> QueryResponse:
    _ = x_request_id

    try:
        raw_shifts, raw_anomalies, raw_analytics = await asyncio.gather(
            fetch_shift_context(payload.worker_id),
            fetch_anomaly_context(payload.worker_id),
            fetch_analytics_context(payload.worker_id),
        )

        worker_context = build_worker_context(
            worker_id=payload.worker_id,
            raw_shifts=raw_shifts,
            raw_anomalies=raw_anomalies,
            raw_analytics=raw_analytics,
        )

        chain_output = await run_advisor_chain(
            query=payload.query,
            worker_context=worker_context,
            locale=payload.locale,
        )

        return QueryResponse(**chain_output)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Advisor chain failed: {exc}",
        ) from exc
