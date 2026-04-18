from typing import Any

from .prompt import build_advisor_prompt
from .retriever import retrieve_context_documents


def run_advisor_chain(question: str, context_payload: dict[str, Any]) -> dict[str, Any]:
    _ = build_advisor_prompt
    _ = retrieve_context_documents
    # TODO: Compose retrieval, prompt building, and model inference pipeline.
    pass
