# FairGig scaffold — implement logic here
"""Pydantic models for FairGig anomaly analysis payloads and outputs.

Model schema is used by FastAPI OpenAPI generation to provide judge-facing,
testable contracts via Swagger at /docs.
"""

from pydantic import BaseModel


class ShiftRecord(BaseModel):
    shift_id: str
    date: str
    platform: str
    hours_worked: float
    gross_earned: float
    platform_deduction: float
    net_received: float


class AnalyzeRequest(BaseModel):
    worker_id: str
    earnings: list[ShiftRecord]


class AnomalyDetail(BaseModel):
    type: str
    severity: str
    affected_shifts: list[str]
    data: dict
    explanation: str


class AnalyzeResponse(BaseModel):
    worker_id: str
    analyzed_shifts: int
    anomalies_found: int
    risk_level: str
    anomalies: list[AnomalyDetail]
    summary: str


class DetectFlag(BaseModel):
    type: str
    severity: str
    explanation: str
    affected_shifts: list[str]
    data: dict


class DetectResponse(BaseModel):
    worker_id: str
    analyzed_shifts: int
    flags: list[DetectFlag]


class BatchWorkerInput(BaseModel):
    worker_id: str
    earnings: list[ShiftRecord]


class BatchWorkerResult(BaseModel):
    worker_id: str
    anomalies_found: int
    risk_level: str
    anomalies: list[AnomalyDetail]
    summary: str
    error: str | None = None


class BatchAnalyzeRequest(BaseModel):
    workers: list[BatchWorkerInput]


class PlatformSummary(BaseModel):
    worker_count: int
    avg_risk_score: float
    most_common_anomaly: str | None


class BatchAnalyzeResponse(BaseModel):
    total_workers: int
    workers_with_anomalies: int
    high_risk_workers: int
    results: list[BatchWorkerResult]
    platform_summary: dict[str, PlatformSummary]
