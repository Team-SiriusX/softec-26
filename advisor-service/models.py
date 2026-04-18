from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str


class QueryRequest(BaseModel):
    worker_id: str
    query: str
    locale: Literal["en", "ur"] = "en"


class ShiftContext(BaseModel):
    total_shifts: int
    total_gross: float
    total_net: float
    total_deductions: float
    avg_hourly_rate: float
    period_days: int
    platform_breakdown: list[dict]


class AnomalyContext(BaseModel):
    # each item has type, severity, explanation, week
    flags: list[dict]
    has_active_flags: bool
    highest_severity: str | None


class AnalyticsContext(BaseModel):
    worker_median: float
    city_median: float
    gap_percentage: float
    worker_category: str
    city: str


class WorkerContext(BaseModel):
    worker_id: str
    shifts: ShiftContext
    anomalies: AnomalyContext
    analytics: AnalyticsContext


class AdvisorSource(BaseModel):
    type: Literal["shift_data", "anomaly_flag", "city_median", "policy_doc"]
    label: str
    value: str


class AdvisorAction(BaseModel):
    label: str
    action_type: Literal[
        "review_shifts",
        "file_grievance",
        "generate_certificate",
        "contact_advocate",
    ]
    route: str


class QueryResponse(BaseModel):
    answer: str
    evidence: list[AdvisorSource] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"]
    next_actions: list[AdvisorAction] = Field(default_factory=list)
    caution: str
    locale: str


# Backward-compatible aliases for scaffolded imports.
AdvisorQueryRequest = QueryRequest
AdvisorQueryResponse = QueryResponse
