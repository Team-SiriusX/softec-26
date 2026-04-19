import os

from langchain_huggingface import HuggingFaceEndpointEmbeddings

DEFAULT_HF_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"


def get_embedder() -> HuggingFaceEndpointEmbeddings:
    token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
    if not token:
        raise RuntimeError("HUGGINGFACEHUB_API_TOKEN is not set")

    return HuggingFaceEndpointEmbeddings(
        huggingfacehub_api_token=token,
        model=os.getenv("HF_EMBEDDING_MODEL", DEFAULT_HF_EMBEDDING_MODEL),
    )


def embed_query(text: str) -> list[float]:
    return get_embedder().embed_query(text)
