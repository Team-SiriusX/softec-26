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
