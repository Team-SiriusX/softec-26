import os
from typing import Any
from threading import Lock

from langchain_postgres.vectorstores import PGVector

from shared_env import load_shared_env

from vector_store.embedder import get_embedder

load_shared_env()

COLLECTION_NAME = "fairgig_policy_docs"

_VECTOR_STORE: PGVector | None = None
_VECTOR_STORE_LOCK = Lock()


def get_vector_store() -> PGVector:
    global _VECTOR_STORE

    if _VECTOR_STORE is not None:
        return _VECTOR_STORE

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured for advisor-service")

    with _VECTOR_STORE_LOCK:
        if _VECTOR_STORE is not None:
            return _VECTOR_STORE

        _VECTOR_STORE = PGVector(
            embeddings=get_embedder(),
            collection_name=COLLECTION_NAME,
            connection=database_url,
            use_jsonb=True,
        )

        return _VECTOR_STORE


def get_vector_store_client() -> PGVector:
    return get_vector_store()


def upsert_documents(documents: list[dict[str, Any]]) -> None:
    if not documents:
        return

    texts: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for doc in documents:
        content = str(doc.get("content", "")).strip()
        if not content:
            continue
        texts.append(content)
        metadata = doc.get("metadata")
        metadatas.append(metadata if isinstance(metadata, dict) else {})

    if not texts:
        return

    store = get_vector_store()
    store.add_texts(texts=texts, metadatas=metadatas)


def similarity_search(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    results = get_vector_store().similarity_search(query, k=top_k)
    return [
        {"content": doc.page_content, "metadata": doc.metadata}
        for doc in results
    ]


def initialize_store() -> None:
    """Initialize and seed pgvector-backed policy docs."""
    from rag.retriever import initialize_store as _initialize_retriever_store

    _initialize_retriever_store()
