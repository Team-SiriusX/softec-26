import os

from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEmbeddings

DEFAULT_HF_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"


def get_embedder() -> Embeddings:
    model_name = os.getenv("HF_EMBEDDING_MODEL", DEFAULT_HF_EMBEDDING_MODEL)
    device = os.getenv("HF_EMBEDDING_DEVICE", "cpu")

    try:
        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": device},
            encode_kwargs={"normalize_embeddings": True},
        )
    except Exception as exc:
        raise RuntimeError(
            "Failed to initialize local Hugging Face embeddings. "
            "Install sentence-transformers and verify model download access."
        ) from exc


def embed_query(text: str) -> list[float]:
    return get_embedder().embed_query(text)
