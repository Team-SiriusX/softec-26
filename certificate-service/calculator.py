"""
Certificate calculation module.
Computes all aggregate stats from raw shift data.
"""

from models import CertificateData, ShiftSummary
from datetime import datetime
from collections import defaultdict
import uuid

def compute_certificate_data(
    worker_id: str,
    worker: dict,
    shifts: list[dict],
    from_date: str,
    to_date: str,
    include_unverified: bool
) -> CertificateData:
    """
    Compute all certificate aggregates from shifts.
    """
    
    if not shifts:
        return CertificateData(
            worker_id=worker_id,
            worker_name=worker.get('fullName', 'Gig Worker'),
            city_zone=worker.get('cityZone'),
            category=worker.get('workerCategory'),
            from_date=from_date,
            to_date=to_date,
            generated_at=datetime.utcnow().isoformat(),
            total_shifts=0,
            total_hours=0.0,
            total_gross=0.0,
            total_deductions=0.0,
            total_net=0.0,
            avg_hourly_rate=0.0,
            avg_commission_rate=0.0,
            verified_shift_count=0,
            pending_shift_count=0,
            platforms=[],
            has_unverified=False,
            verification_note="No verified shifts found in this date range.",
            certificate_id=str(uuid.uuid4()),
            is_print_ready=True
        )
        
    platform_groups = defaultdict(list)
    for shift in shifts:
        platform_groups[shift['platformName']].append(shift)
        
    platforms_summary = []
    total_hours = 0.0
    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0
    verified_shift_count = 0
    pending_shift_count = 0
    verified_net = 0.0
    
    for platform_name, platform_shifts in platform_groups.items():
        shift_count = len(platform_shifts)
        p_total_hours = sum(float(s['hoursWorked']) for s in platform_shifts)
        p_gross_earned = sum(float(s['grossEarned']) for s in platform_shifts)
        p_total_deductions = sum(float(s['platformDeduction']) for s in platform_shifts)
        p_net_received = sum(float(s['netReceived']) for s in platform_shifts)
        
        p_avg_commission_rate = (p_total_deductions / p_gross_earned * 100) if p_gross_earned > 0 else 0.0
        p_avg_commission_rate = round(p_avg_commission_rate, 2)
        
        p_verified_count = sum(1 for s in platform_shifts if s['verificationStatus'] == 'CONFIRMED')
        p_pending_count = sum(1 for s in platform_shifts if s['verificationStatus'] == 'PENDING')
        
        platforms_summary.append(ShiftSummary(
            platform_name=platform_name,
            shift_count=shift_count,
            total_hours=p_total_hours,
            gross_earned=p_gross_earned,
            total_deductions=p_total_deductions,
            net_received=p_net_received,
            avg_commission_rate=p_avg_commission_rate,
            verified_count=p_verified_count,
            pending_count=p_pending_count
        ))
        
        total_hours += p_total_hours
        total_gross += p_gross_earned
        total_deductions += p_total_deductions
        total_net += p_net_received
        verified_shift_count += p_verified_count
        pending_shift_count += p_pending_count
        verified_net += sum(float(s['netReceived']) for s in platform_shifts if s['verificationStatus'] == 'CONFIRMED')
        
    total_shifts = len(shifts)
    avg_hourly_rate = (total_net / total_hours) if total_hours > 0 else 0.0
    avg_hourly_rate = round(avg_hourly_rate, 2)
    
    avg_commission_rate = (total_deductions / total_gross * 100) if total_gross > 0 else 0.0
    avg_commission_rate = round(avg_commission_rate, 2)
    
    if not include_unverified or pending_shift_count == 0:
        note = "All earnings shown have been verified by a FairGig verifier."
    else:
        note = f"{pending_shift_count} shifts are pending verification and are marked accordingly. Verified total: PKR {verified_net:,.0f}"
        
    return CertificateData(
        worker_id=worker_id,
        worker_name=worker.get('fullName', 'Gig Worker'),
        city_zone=worker.get('cityZone'),
        category=worker.get('workerCategory'),
        from_date=from_date,
        to_date=to_date,
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
        platforms=platforms_summary,
        has_unverified=pending_shift_count > 0,
        verification_note=note,
        certificate_id=str(uuid.uuid4()),
        is_print_ready=True
    )
