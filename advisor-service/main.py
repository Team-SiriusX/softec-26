from dotenv import load_dotenv
from fastapi import FastAPI

from context.builder import build_runtime_context
from models import AdvisorQueryRequest, AdvisorQueryResponse, HealthResponse
from rag.chain import run_advisor_chain
from vector_store.store import get_vector_store_client

load_dotenv()

app = FastAPI(title="advisor-service", version="0.1.0")


@app.on_event("startup")
async def startup_event() -> None:
    _ = get_vector_store_client
    # TODO: Initialize vector store client and service-level dependencies.
    pass


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    # TODO: Expand health checks for vector store and upstream integrations.
    pass


@app.post("/advisor/query", response_model=AdvisorQueryResponse)
async def advisor_query(payload: AdvisorQueryRequest) -> AdvisorQueryResponse:
    _ = build_runtime_context
    _ = run_advisor_chain
    _ = payload
    # TODO: Implement RAG orchestration for advisor responses.
    pass
