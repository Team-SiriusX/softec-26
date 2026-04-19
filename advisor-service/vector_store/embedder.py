import os

from langchain_openai import OpenAIEmbeddings


def get_embedder() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        openai_api_base=os.getenv("OPENROUTER_BASE_URL"),
    )


def embed_query(text: str) -> list[float]:
    return get_embedder().embed_query(text)
