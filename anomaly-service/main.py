"""FastAPI service for robust earnings anomaly detection in FairGig.

Detection methods are based on robust statistics literature including
Iglewicz-Hoaglin modified Z-score and Theil-Sen trend estimation.
"""

from __future__ import annotations

from collections import Counter
from typing import Annotated

from dateutil.parser import isoparse
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from models import AnalyzeRequest, AnalyzeResponse, AnomalyDetail
from enrichment.ai_enricher import enrich_anomalies
from detection.rules import (
    check_below_minimum_wage,
    check_commission_creep,
    check_deduction_spike,
    check_income_cliff,
)

app = FastAPI(
    title='FairGig Anomaly Detection Service',
    description='''
    Statistically-grounded anomaly detection for gig worker earnings data.

    Detection methods:
    - Deduction Spike: Iglewicz-Hoaglin (1993) Modified Z-Score [Point Anomaly]
    - Income Cliff: Rolling Median + MAD bounds [Contextual Anomaly]
    - Below Minimum Wage: PKR 37,000/month legal threshold [Collective Anomaly]
    - Commission Creep: Theil-Sen slope estimator [Collective Anomaly]

    Reference: Gujral (2023) anomaly taxonomy. UCR MADLab.
    ''',
    version='1.0.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'fairgig-anomaly'}


@app.post('/analyze', response_model=AnalyzeResponse)
async def analyze(
    request: AnalyzeRequest,
    enrich: Annotated[
        bool,
        Query(
            description='Enable optional LLM explanation enrichment after statistical detection.',
        ),
    ] = True,
):
    """Analyze earnings history and return non-technical anomaly findings.

    Accepts shift-level earnings data and runs four robust detection rules.
    Output includes worker-friendly explanations suitable for competition demos.
    """

    shifts = sorted(request.earnings, key=lambda s: isoparse(s.date).date())

    if len(shifts) == 0:
        return AnalyzeResponse(
            worker_id=request.worker_id,
            analyzed_shifts=0,
            anomalies_found=0,
            risk_level='none',
            anomalies=[],
            summary='No shift data provided for analysis.',
        )

    anomalies: list[AnomalyDetail] = []

    for detector in (
        check_deduction_spike,
        check_income_cliff,
        check_below_minimum_wage,
        check_commission_creep,
    ):
        result = detector(shifts)
        if result is not None:
            anomalies.append(result)

    risk_level = compute_risk_level(anomalies)
    summary = build_summary(anomalies, shifts)

    if enrich and anomalies and _openrouter_api_key():
        platform = _summarize_platforms(shifts)
        date_range = _format_date_range(shifts)
        enriched_anomalies, unified_summary = await enrich_anomalies(
            anomalies=anomalies,
            worker_id=request.worker_id,
            platform=platform,
            shift_count=len(shifts),
            date_range=date_range,
        )

        anomalies = enriched_anomalies
        if unified_summary:
            summary = unified_summary

    return AnalyzeResponse(
        worker_id=request.worker_id,
        analyzed_shifts=len(shifts),
        anomalies_found=len(anomalies),
        risk_level=risk_level,
        anomalies=anomalies,
        summary=summary,
    )


def compute_risk_level(anomalies: list[AnomalyDetail]) -> str:
    """critical > high > medium > low > none"""

    severity_rank = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
    if not anomalies:
        return 'none'
    return max(anomalies, key=lambda a: severity_rank.get(a.severity, 0)).severity


def build_summary(anomalies: list[AnomalyDetail], shifts) -> str:
    """Build a concise, worker-friendly summary message."""

    if not anomalies:
        return (
            f'No statistical earnings anomalies were detected across your last '
            f'{len(shifts)} shifts. Your income pattern appears stable in this period.'
        )

    rank = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
    top = max(anomalies, key=lambda a: rank.get(a.severity, 0))

    return (
        f'We analyzed {len(shifts)} shifts and found {len(anomalies)} anomaly '
        f"signal(s). The most severe issue is '{top.type}' with '{top.severity}' "
        f'severity, so your recent payout pattern likely needs review.'
    )


def _openrouter_api_key() -> str:
    import os

    return os.environ.get('OPEN_ROUTER_API_KEY', '')


def _summarize_platforms(shifts) -> str:
    platform_names = [shift.platform.name for shift in shifts if getattr(shift, 'platform', None)]
    if not platform_names:
        return 'Unknown'

    counts = Counter(platform_names)
    if len(counts) == 1:
        return next(iter(counts))

    most_common = ', '.join(name for name, _ in counts.most_common())
    return f'Multiple platforms ({most_common})'


def _format_date_range(shifts) -> str:
    if not shifts:
        return 'No shift data available'

    start_date = isoparse(shifts[0].date).date()
    end_date = isoparse(shifts[-1].date).date()

    if start_date == end_date:
        return start_date.isoformat()

    return f'{start_date.isoformat()} to {end_date.isoformat()}'
