import os
from threading import Lock

from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEmbeddings

DEFAULT_HF_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

_EMBEDDER: Embeddings | None = None
_EMBEDDER_LOCK = Lock()


def get_embedder() -> Embeddings:
    global _EMBEDDER

    if _EMBEDDER is not None:
        return _EMBEDDER

    model_name = os.getenv("HF_EMBEDDING_MODEL", DEFAULT_HF_EMBEDDING_MODEL)
    device = os.getenv("HF_EMBEDDING_DEVICE", "cpu")

    with _EMBEDDER_LOCK:
        if _EMBEDDER is not None:
            return _EMBEDDER

        try:
            _EMBEDDER = HuggingFaceEmbeddings(
                model_name=model_name,
                model_kwargs={"device": device},
                encode_kwargs={"normalize_embeddings": True},
            )
            return _EMBEDDER
        except Exception as exc:
            raise RuntimeError(
                "Failed to initialize local Hugging Face embeddings. "
                "Install sentence-transformers and verify model download access."
            ) from exc


def embed_query(text: str) -> list[float]:
    return get_embedder().embed_query(text)
