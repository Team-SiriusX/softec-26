import os

from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings

DEFAULT_HF_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"


def get_embedder() -> HuggingFaceInferenceAPIEmbeddings:
    token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
    if not token:
        raise RuntimeError("HUGGINGFACEHUB_API_TOKEN is not set")

    return HuggingFaceInferenceAPIEmbeddings(
        api_key=token,
        model_name=os.getenv("HF_EMBEDDING_MODEL", DEFAULT_HF_EMBEDDING_MODEL),
    )


def embed_query(text: str) -> list[float]:
    return get_embedder().embed_query(text)
