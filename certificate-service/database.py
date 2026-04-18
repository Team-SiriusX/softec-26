import os
import asyncpg
from typing import Optional
from dotenv import load_dotenv

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_local_path = os.path.join(root_dir, ".env.local")
env_path = os.path.join(root_dir, ".env")
if os.path.exists(env_local_path):
    load_dotenv(env_local_path)
elif os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://user:password@localhost:5432/fairgig"
)

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
          AND sl.shift_date >= $2::date
          AND sl.shift_date <= $3::date
    """
    
    if not include_unverified:
        query += " AND sl.verification_status = 'CONFIRMED'"
    else:
        query += " AND sl.verification_status IN ('CONFIRMED', 'PENDING')"
        
    query += " ORDER BY sl.shift_date ASC"
    
    rows = await conn.fetch(query, worker_id, from_date, to_date)
    return [dict(row) for row in rows]
