import json
import os
from typing import Any

from langchain_openai import ChatOpenAI

from models import WorkerContext

from .prompt import get_advisor_prompt_template
from .retriever import get_retriever

DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def _format_anomaly_summary(flags: list[dict[str, Any]]) -> str:
    if not flags:
        return "No anomalies detected."

    lines: list[str] = []
    for flag in flags:
        flag_type = str(flag.get("type", "unknown"))
        severity = str(flag.get("severity", "unknown"))
        explanation = str(flag.get("explanation", ""))
        week = str(flag.get("week", ""))

        if week:
            lines.append(
                f"- {flag_type} ({severity}) in {week}: {explanation}"
            )
        else:
            lines.append(f"- {flag_type} ({severity}): {explanation}")

    return "\n".join(lines)


def _fallback_response(locale: str) -> dict[str, Any]:
    if locale == "ur":
        answer = "براہ کرم اپنا سوال دوبارہ واضح انداز میں لکھیں تاکہ میں درست رہنمائی دے سکوں۔"
        caution = "جواب تیار نہیں ہو سکا؛ براہ کرم سوال دوبارہ بھیجیں یا معاون سے رابطہ کریں۔"
    else:
        answer = "Please rephrase your question so I can provide a clearer and accurate response."
        caution = "I could not generate a reliable structured response this time."

    return {
        "answer": answer,
        "evidence": [],
        "confidence": "low",
        "next_actions": [
            {
                "label": "Review your question and try again",
                "action_type": "review_shifts",
                "route": "/worker/grievances",
            }
        ],
        "caution": caution,
        "locale": locale,
    }


def _parse_json_response(content: str) -> dict[str, Any] | None:
    cleaned = content.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return None

    if not isinstance(parsed, dict):
        return None

    return parsed


async def run_advisor_chain(
    query: str,
    worker_context: WorkerContext,
    locale: str,
) -> dict[str, Any]:
    try:
        retriever = get_retriever()
        policy_docs = await retriever.ainvoke(query)
    except Exception:
        policy_docs = []

    policy_context = "\n\n".join(
        doc.page_content.strip()
        for doc in policy_docs
        if getattr(doc, "page_content", "").strip()
    )
    if not policy_context:
        policy_context = "No policy context available."

    anomaly_summary = _format_anomaly_summary(worker_context.anomalies.flags)

    prompt_template = get_advisor_prompt_template()

    prompt_inputs = {
        "locale": locale,
        "total_shifts": worker_context.shifts.total_shifts,
        "total_gross": worker_context.shifts.total_gross,
        "total_net": worker_context.shifts.total_net,
        "total_deductions": worker_context.shifts.total_deductions,
        "avg_hourly_rate": worker_context.shifts.avg_hourly_rate,
        "platform_breakdown": json.dumps(
            worker_context.shifts.platform_breakdown,
            ensure_ascii=False,
        ),
        "anomaly_summary": anomaly_summary,
        "worker_median": worker_context.analytics.worker_median,
        "city": worker_context.analytics.city,
        "worker_category": worker_context.analytics.worker_category,
        "city_median": worker_context.analytics.city_median,
        "gap_percentage": worker_context.analytics.gap_percentage,
        "policy_context": policy_context,
        "query": query,
    }

    llm = ChatOpenAI(
        base_url=os.getenv(
            "OPENROUTER_BASE_URL",
            DEFAULT_OPENROUTER_BASE_URL,
        ),
        api_key=os.getenv("OPENROUTER_API_KEY"),
        model="google/gemini-flash-1.5",
        temperature=0.2,
    )

    try:
        messages = prompt_template.format_messages(**prompt_inputs)
        llm_response = await llm.ainvoke(messages)
        parsed = _parse_json_response(str(llm_response.content))
        if parsed is None:
            return _fallback_response(locale)

        parsed.setdefault("locale", locale)
        return parsed
    except Exception:
        return _fallback_response(locale)
