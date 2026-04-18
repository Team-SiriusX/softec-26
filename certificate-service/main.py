import os
import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from models import (
    CertificateRequest, 
    CertificateResponse,
    CertificateData,
    ShiftSummary
)
from database import get_connection, fetch_worker, fetch_shifts_for_certificate
from calculator import compute_certificate_data
from renderer import render_certificate_html

app = FastAPI(
    title="FairGig Certificate Service",
    version="1.0.0",
    description=(
        "Dedicated service for generating printable "
        "HTML income certificates from verified "
        "gig worker earnings. Designed for use with "
        "landlords, banks, and official institutions."
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8003"
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fairgig-certificate",
        "version": "1.0.0"
    }

@app.post("/certificate", response_model=CertificateResponse)
async def generate_certificate(request: CertificateRequest):
    """Generate an income certificate for a worker."""
    conn = await get_connection()
    try:
        worker = await fetch_worker(conn, request.worker_id)
        if not worker:
            raise HTTPException(404, "Worker not found")
            
        shifts = await fetch_shifts_for_certificate(
            conn,
            request.worker_id,
            request.from_date,
            request.to_date,
            request.include_unverified
        )
        
        data = compute_certificate_data(
            request.worker_id,
            dict(worker),
            [dict(s) for s in shifts],
            request.from_date,
            request.to_date,
            request.include_unverified
        )
        
        html = render_certificate_html(data)
        
        return CertificateResponse(
            certificate_id=data.certificate_id,
            worker_id=request.worker_id,
            html=html,
            data=data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Certificate generation failed: {str(e)}")
    finally:
        await conn.close()

@app.get("/certificate/preview", response_class=HTMLResponse)
async def preview_certificate(
    worker_id: str = Query(...),
    from_date: str = Query(...),
    to_date: str = Query(...),
    include_unverified: bool = Query(False)
):
    """Returns raw HTML directly — opens in browser."""
    conn = await get_connection()
    try:
        worker = await fetch_worker(conn, worker_id)
        if not worker:
            raise HTTPException(status_code=404, detail="Worker not found")
            
        shifts = await fetch_shifts_for_certificate(
            conn,
            worker_id,
            from_date,
            to_date,
            include_unverified
        )
        
        data = compute_certificate_data(
            worker_id,
            dict(worker),
            [dict(s) for s in shifts],
            from_date,
            to_date,
            include_unverified
        )
        
        html = render_certificate_html(data)
        return HTMLResponse(content=html)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Certificate generation failed: {str(e)}")
    finally:
        await conn.close()

@app.get("/certificate/sample", response_class=HTMLResponse)
async def sample_certificate():
    """Returns a sample certificate with fake data."""
    platforms = [
        ShiftSummary(
            platform_name="Careem",
            shift_count=18,
            total_hours=144.0,
            gross_earned=72000.0,
            total_deductions=16560.0,
            net_received=55440.0,
            avg_commission_rate=23.0,
            verified_count=18,
            pending_count=0
        ),
        ShiftSummary(
            platform_name="Foodpanda",
            shift_count=6,
            total_hours=36.0,
            gross_earned=18000.0,
            total_deductions=3600.0,
            net_received=14400.0,
            avg_commission_rate=20.0,
            verified_count=5,
            pending_count=1
        )
    ]
    
    total_shifts = sum(p.shift_count for p in platforms)
    total_hours = sum(p.total_hours for p in platforms)
    total_gross = sum(p.gross_earned for p in platforms)
    total_deductions = sum(p.total_deductions for p in platforms)
    total_net = sum(p.net_received for p in platforms)
    avg_hourly_rate = total_net / total_hours if total_hours > 0 else 0.0
    avg_commission_rate = (total_deductions / total_gross * 100) if total_gross > 0 else 0.0
    verified_shift_count = sum(p.verified_count for p in platforms)
    pending_shift_count = sum(p.pending_count for p in platforms)
    has_unverified = pending_shift_count > 0
    
    verified_net = 55440.0 + (14400.0 * (5/6))  # Rough approximation for sample
    
    fake_data = CertificateData(
        worker_id="demo-worker",
        worker_name="Ali Raza",
        city_zone="Gulberg, Lahore",
        category="ride_hailing",
        from_date="2025-10-01",
        to_date="2026-03-31",
        generated_at=datetime.utcnow().isoformat(),
        total_shifts=total_shifts,
        total_hours=total_hours,
        total_gross=total_gross,
        total_deductions=total_deductions,
        total_net=total_net,
        avg_hourly_rate=avg_hourly_rate,
        avg_commission_rate=avg_commission_rate,
        verified_shift_count=verified_shift_count,
        pending_shift_count=pending_shift_count,
        platforms=platforms,
        has_unverified=has_unverified,
        verification_note=f"1 shifts are pending verification and are marked accordingly. Verified total: PKR {verified_net:,.0f}",
        certificate_id=str(uuid.uuid4()),
        is_print_ready=True
    )
    
    html = render_certificate_html(fake_data)
    return HTMLResponse(content=html)
