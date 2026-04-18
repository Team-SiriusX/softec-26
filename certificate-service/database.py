import os
import asyncpg
from datetime import date, datetime
from typing import Optional
from dotenv import load_dotenv

from models import CertificateData

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_local_path = os.path.join(root_dir, ".env.local")
env_path = os.path.join(root_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
if os.path.exists(env_local_path):
    load_dotenv(env_local_path, override=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://user:password@localhost:5432/fairgig"
).strip('"').strip("'")

async def get_connection():
    """Get asyncpg connection."""
    return await asyncpg.connect(DATABASE_URL)

async def fetch_worker(
    conn, worker_id: str
) -> Optional[dict]:
    """
    Fetch worker by id.
    """
    query = """
        SELECT id, full_name AS "fullName", email, city_zone AS "cityZone", 
               category AS "workerCategory", role
        FROM "User"
        WHERE id = $1
    """
    row = await conn.fetchrow(query, worker_id)
    return dict(row) if row else None

async def fetch_shifts_for_certificate(
    conn,
    worker_id: str,
    from_date: str,
    to_date: str,
    include_unverified: bool
) -> list[dict]:
    """
    Fetch shift logs for worker in date range.
    """
    # asyncpg requires datetime.date objects, not raw ISO strings
    from_dt = date.fromisoformat(from_date)
    to_dt = date.fromisoformat(to_date)

    query = """
        SELECT 
            sl.id,
            sl.shift_date AS "shiftDate",
            sl.hours_worked AS "hoursWorked",
            sl.gross_earned AS "grossEarned",
            sl.platform_deductions AS "platformDeduction",
            sl.net_received AS "netReceived",
            sl.verification_status AS "verificationStatus",
            p.name as "platformName",
            p.slug as "platformSlug"
        FROM shift_logs sl
        JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.worker_id = $1
          AND sl.shift_date >= $2
          AND sl.shift_date <= $3
    """
    
    if not include_unverified:
        query += " AND sl.verification_status = 'CONFIRMED'"
    else:
        query += " AND sl.verification_status IN ('CONFIRMED', 'PENDING')"
        
    query += " ORDER BY sl.shift_date ASC"
    
    rows = await conn.fetch(query, worker_id, from_dt, to_dt)
    return [dict(row) for row in rows]


async def save_certificate(
    conn,
    worker_id: str,
    data: CertificateData,
    html_snapshot: str,
) -> None:
    """Persist a generated certificate for later verification."""
    from_dt = date.fromisoformat(data.from_date)
    to_dt = date.fromisoformat(data.to_date)
    generated_at = datetime.fromisoformat(data.generated_at)
    platforms_list = [platform.platform_name for platform in data.platforms]

    query = """
        INSERT INTO income_certificates (
            id,
            worker_id,
            from_date,
            to_date,
            total_verified,
            shift_count,
            platforms_list,
            html_snapshot,
            status,
            generated_at,
            expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, 'GENERATED', $9, NULL)
    """

    await conn.execute(
        query,
        data.certificate_id,
        worker_id,
        from_dt,
        to_dt,
        data.total_net,
        data.total_shifts,
        platforms_list,
        html_snapshot,
        generated_at,
    )


async def fetch_certificate_by_id(conn, certificate_id: str) -> Optional[dict]:
    """Fetch a persisted certificate by id for verification checks."""
    query = """
        SELECT
            ic.id AS certificate_id,
            ic.worker_id,
            u.full_name AS worker_name,
            ic.from_date,
            ic.to_date,
            ic.total_verified,
            ic.shift_count,
            ic.platforms_list,
            ic.status,
            ic.generated_at,
            ic.expires_at
        FROM income_certificates ic
        LEFT JOIN "User" u ON u.id = ic.worker_id
        WHERE ic.id = $1
        LIMIT 1
    """

    row = await conn.fetchrow(query, certificate_id)
    return dict(row) if row else None
