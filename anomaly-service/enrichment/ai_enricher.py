from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from models import AnomalyDetail


LOGGER = logging.getLogger(__name__)

DEFAULT_OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free'

SYSTEM_PROMPT = """You are a friendly helper for gig delivery riders.
We checked their recent pay and found some issues. Explain these issues using very, very simple and easy-to-understand words.

Rules:
- Speak as if you are talking to a friend who doesn't know tech or math.
- Never use complex words. Do NOT say "algorithm", "statistical", "Z-score", "anomaly", or "variance".
- Use simple phrases like "We noticed your pay dropped" or "The app took more money than usual".
- Always include the real PKR money amounts from the data so they know exactly how much is missing.
- Tone: very friendly, kind, and supportive.
- Maximum 2 very short sentences per explanation. Be direct and clear.
- Provide both an English and a matching Urdu translation in the JSON response.
- Output ONLY valid JSON, no markdown, no other text.
"""


async def enrich_anomalies(
    anomalies: list[AnomalyDetail],
    worker_id: str,
    platform: str,
    shift_count: int,
    date_range: str,
) -> tuple[list[AnomalyDetail], str, dict[str, Any] | None]:
    api_key = _openrouter_api_key()
    if not api_key:
        return anomalies, '', None

    model = os.environ.get('OPENROUTER_MODEL') or os.environ.get(
        'OPEN_ROUTER_MODEL',
        DEFAULT_OPENROUTER_MODEL,
    )

    user_message = _build_user_message(anomalies, platform, shift_count, date_range)

    payload = {
        'model': model,
        'temperature': 0.3,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user_message},
        ],
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers=headers,
                json=payload,
            )
            response.raise_for_status()

        response_json = response.json()
        content = response_json['choices'][0]['message']['content']
        parsed = _parse_json_content(content)
        enriched_items = parsed.get('enriched_anomalies', [])
        unified_summary = parsed.get('unified_summary', '')
        unified_summary_urdu = parsed.get('unified_summary_urdu', '')

        if not isinstance(enriched_items, list):
            return anomalies, '', response_json

        enriched_by_type: dict[str, str] = {}
        for item in enriched_items:
            if not isinstance(item, dict):
                continue
            anomaly_type = item.get('type')
            plain_explanation = item.get('plain_explanation')
            urdu_explanation = item.get('urdu_explanation', '')
            
            if isinstance(anomaly_type, str) and isinstance(plain_explanation, str):
                combined = f"{plain_explanation}\n\nاردو:\n{urdu_explanation}" if urdu_explanation else plain_explanation
                enriched_by_type.setdefault(anomaly_type, combined)

        updated_anomalies: list[AnomalyDetail] = []
        for anomaly in anomalies:
            replacement = enriched_by_type.get(anomaly.type)
            if replacement:
                updated_anomalies.append(
                    anomaly.model_copy(update={'explanation': replacement})
                )
            else:
                updated_anomalies.append(anomaly)

        if not isinstance(unified_summary, str):
            unified_summary = ''
        else:
            if isinstance(unified_summary_urdu, str) and unified_summary_urdu.strip():
                unified_summary = f"{unified_summary}\n\nاردو:\n{unified_summary_urdu}"

        return updated_anomalies, unified_summary, response_json
    except httpx.HTTPStatusError as exc:
        LOGGER.exception('OpenRouter returned HTTP error for worker %s', worker_id)
        error_payload: dict[str, Any] = {
            'error': {
                'status_code': exc.response.status_code,
                'message': str(exc),
            }
        }
        try:
            provider_payload = exc.response.json()
            if isinstance(provider_payload, dict):
                error_payload['provider'] = provider_payload
            else:
                error_payload['provider'] = {'raw': provider_payload}
        except ValueError:
            error_payload['provider'] = {'raw': exc.response.text}
        return anomalies, '', error_payload
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        LOGGER.exception('Failed to enrich anomalies for worker %s', worker_id)
        return anomalies, '', None


def _build_user_message(
    anomalies: list[AnomalyDetail],
    platform: str,
    shift_count: int,
    date_range: str,
) -> str:
    anomalies_payload = [
        {
            'type': anomaly.type,
            'severity': anomaly.severity,
            'data': anomaly.data,
            'current_explanation': anomaly.explanation,
        }
        for anomaly in anomalies
    ]

    return (
        'Worker context:\n'
        f'- Platform: {platform}\n'
        f'- Shifts analyzed: {shift_count}\n'
        f'- Period: {date_range}\n\n'
        'Anomalies found:\n'
        f'{json.dumps(anomalies_payload, indent=2)}\n\n'
        'Return this exact JSON structure:\n'
        '{\n'
        '  "enriched_anomalies": [\n'
        '    {"type": "...", "plain_explanation": "...", "urdu_explanation": "..."}\n'
        '  ],\n'
        '  "unified_summary": "One paragraph explaining what happened to this worker\'s income this month in plain language.",\n'
        '  "unified_summary_urdu": "Urdu translation of the unified summary.",\n'
        '  "recommended_action": "One concrete action the worker should take."\n'
        '}'
    )


def _parse_json_content(content: Any) -> dict[str, Any]:
    if not isinstance(content, str):
        raise ValueError('LLM content must be a string')

    stripped_content = content.strip()
    if stripped_content.startswith('```'):
        stripped_content = stripped_content.strip('`')
        if stripped_content.startswith('json'):
            stripped_content = stripped_content[4:].strip()

    return json.loads(stripped_content)


def _openrouter_api_key() -> str:
    return os.environ.get('OPENROUTER_API_KEY') or os.environ.get(
        'OPEN_ROUTER_API_KEY',
        '',
    )