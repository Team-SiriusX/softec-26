import os
from typing import Any

from langchain_core.documents import Document
from sqlalchemy import create_engine, text

from shared_env import load_shared_env

from vector_store.store import get_vector_store

load_shared_env()

POLICY_DOCUMENTS = [
    Document(
        page_content=(
            "If your platform deductions exceed 30% of gross earnings "
            "in any week, this is statistically unusual. You should screenshot "
            "your earnings summary, compare with previous weeks, and file a "
            "grievance with category DEDUCTION_ANOMALY."
        ),
        metadata={"source": "policy_deduction"},
    ),
    Document(
        page_content=(
            "If your account is deactivated without explanation, "
            "immediately generate an income certificate covering the last 90 days. "
            "This serves as evidence for disputes. Contact an advocate through "
            "the grievance escalation flow."
        ),
        metadata={"source": "policy_account_deactivation"},
    ),
    Document(
        page_content=(
            "A sudden income drop of more than 20% month-on-month may "
            "indicate algorithmic suppression or unfair commission changes. "
            "Document affected shifts, file a grievance, and request advocate "
            "review."
        ),
        metadata={"source": "policy_income_drop"},
    ),
    Document(
        page_content=(
            "Verified shifts carry more weight in grievance proceedings. "
            "Upload earnings screenshots for any disputed period. "
            "Verification typically takes 24-48 hours."
        ),
        metadata={"source": "policy_verification"},
    ),
    Document(
        page_content=(
            "Income certificates can be used with landlords, banks, "
            "and government offices. Generate one covering at least 3 months "
            "for stronger credibility. Only verified shifts appear in the "
            "certificate totals."
        ),
        metadata={"source": "policy_certificate"},
    ),
]


def ensure_pgvector_extension() -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return

    engine = create_engine(database_url)
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()


def get_retriever():
    store = get_vector_store()
    return store.as_retriever(search_kwargs={"k": 2})


def initialize_store() -> None:
    ensure_pgvector_extension()
    store = get_vector_store()

    existing = store.similarity_search("policy", k=1)
    if len(existing) > 0:
        return

    store.add_documents(POLICY_DOCUMENTS)
    print("Policy documents seeded into Neon pgvector")


def retrieve_context_documents(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    docs = get_vector_store().similarity_search(query, k=top_k)
    return [{"content": doc.page_content, "metadata": doc.metadata} for doc in docs]
