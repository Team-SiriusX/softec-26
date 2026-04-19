import os
from typing import Any

from langchain_postgres.vectorstores import PGVector

from vector_store.embedder import get_embedder

COLLECTION_NAME = "fairgig_policy_docs"


def get_vector_store() -> PGVector:
    return PGVector(
        embeddings=get_embedder(),
        collection_name=COLLECTION_NAME,
        connection=os.getenv("DATABASE_URL"),
        use_jsonb=True,
    )


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
