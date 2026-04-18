from pydantic import BaseModel
from typing import Optional
from datetime import date

class CertificateRequest(BaseModel):
    worker_id: str
    from_date: str      # ISO date string "2025-10-01"
    to_date: str        # ISO date string "2026-04-18"
    include_unverified: bool = False
    # if False: only VERIFIED shifts included
    # if True: include PENDING with disclaimer

class ShiftSummary(BaseModel):
    platform_name: str
    shift_count: int
    total_hours: float
    gross_earned: float         # PKR
    total_deductions: float     # PKR
    net_received: float         # PKR
    avg_commission_rate: float  # percentage
    verified_count: int
    pending_count: int

class CertificateData(BaseModel):
    # Worker info
    worker_id: str
    worker_name: str
    city_zone: Optional[str]
    category: Optional[str]
    
    # Date range
    from_date: str
    to_date: str
    generated_at: str           # ISO datetime
    
    # Aggregate totals
    total_shifts: int
    total_hours: float
    total_gross: float          # PKR
    total_deductions: float     # PKR
    total_net: float            # PKR
    avg_hourly_rate: float      # PKR per hour
    avg_commission_rate: float  # percentage
    verified_shift_count: int
    pending_shift_count: int
    
    # Per platform breakdown
    platforms: list[ShiftSummary]
    
    # Honesty flags
    has_unverified: bool
    verification_note: str
    
    # Certificate metadata
    certificate_id: str
    is_print_ready: bool = True

class CertificateResponse(BaseModel):
    certificate_id: str
    worker_id: str
    html: str               # complete HTML document
    data: CertificateData   # structured data for frontend


class VerifiedCertificate(BaseModel):
    certificate_id: str
    worker_id: str
    worker_name: Optional[str]
    from_date: str
    to_date: str
    total_verified: float
    shift_count: int
    platforms: list[str]
    status: str
    generated_at: str
    expires_at: Optional[str] = None
    is_expired: bool


class CertificateVerificationResponse(BaseModel):
    is_valid: bool
    message: str
    certificate: Optional[VerifiedCertificate] = None
