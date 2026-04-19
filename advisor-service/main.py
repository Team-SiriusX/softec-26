import asyncio
from typing import Literal

from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from context.builder import build_worker_context
from context.fetcher import (
    fetch_shift_context,
    fetch_anomaly_context,
    fetch_analytics_context,
)
from models import QueryRequest, QueryResponse
from rag.chain import run_advisor_chain
from shared_env import load_shared_env
from vector_store.store import initialize_store
from voice.transcriber import transcribe_audio

load_shared_env()

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


@app.post("/advisor/voice/transcribe")
async def advisor_voice_transcribe(
    file: UploadFile = File(...),
) -> dict[str, str]:
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        transcript = await transcribe_audio(
            audio_bytes=audio_bytes,
            filename=file.filename or "audio.webm",
        )
        return {"transcript": transcript}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Voice transcription failed: {exc}",
        ) from exc


@app.post("/advisor/voice/query", response_model=QueryResponse)
async def advisor_voice_query(
    worker_id: str = Form(...),
    locale: Literal["en", "ur"] = Form("en"),
    file: UploadFile = File(...),
    x_request_id: str | None = Header(default=None),
) -> QueryResponse:
    _ = x_request_id

    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        transcript = await transcribe_audio(
            audio_bytes=audio_bytes,
            filename=file.filename or "audio.webm",
        )

        raw_shifts, raw_anomalies, raw_analytics = await asyncio.gather(
            fetch_shift_context(worker_id),
            fetch_anomaly_context(worker_id),
            fetch_analytics_context(worker_id),
        )

        worker_context = build_worker_context(
            worker_id=worker_id,
            raw_shifts=raw_shifts,
            raw_anomalies=raw_anomalies,
            raw_analytics=raw_analytics,
        )

        chain_output = await run_advisor_chain(
            query=transcript,
            worker_context=worker_context,
            locale=locale,
        )

        return QueryResponse(**chain_output)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Advisor voice chain failed: {exc}",
        ) from exc
