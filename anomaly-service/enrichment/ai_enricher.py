from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from models import AnomalyDetail


LOGGER = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are FairGig's income analyst. Gig worker earnings have been 
statistically analyzed and anomalies were found. Explain findings 
in plain, empathetic English a non-technical delivery rider understands.

Rules:
- Never say "algorithm", "statistical", "Z-score", "MAD", or "Theil-Sen"
- Say "we noticed" or "the data shows" instead
- Always reference real numbers from the findings (PKR amounts, percentages)
- Tone: honest, supportive, not alarmist  
- If severity is critical, be direct but not scary
- Maximum 2 sentences per anomaly explanation
- Output ONLY valid JSON, no markdown, no preamble
"""


async def enrich_anomalies(
    anomalies: list[AnomalyDetail],
    worker_id: str,
    platform: str,
    shift_count: int,
    date_range: str,
) -> tuple[list[AnomalyDetail], str]:
    api_key = os.environ.get('OPEN_ROUTER_API_KEY', '')
    if not api_key:
        return anomalies, ''

    user_message = _build_user_message(anomalies, platform, shift_count, date_range)

    payload = {
        'model': 'anthropic/claude-3-haiku',
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

        if not isinstance(enriched_items, list):
            return anomalies, ''

        enriched_by_type: dict[str, str] = {}
        for item in enriched_items:
            if not isinstance(item, dict):
                continue
            anomaly_type = item.get('type')
            plain_explanation = item.get('plain_explanation')
            if isinstance(anomaly_type, str) and isinstance(plain_explanation, str):
                enriched_by_type.setdefault(anomaly_type, plain_explanation)

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

        return updated_anomalies, unified_summary
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        LOGGER.exception('Failed to enrich anomalies for worker %s', worker_id)
        return anomalies, ''


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
        '    {"type": "...", "plain_explanation": "..."}\n'
        '  ],\n'
        '  "unified_summary": "One paragraph explaining what happened to this worker\'s income this month in plain language.",\n'
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