import asyncio
import asyncpg
import os
from dotenv import load_dotenv

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(root, ".env"))
load_dotenv(os.path.join(root, ".env.local"), override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip('"').strip("'")
print("URL:", DATABASE_URL[:40], "...")

async def test():
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        row = await conn.fetchrow("SELECT 1 as n")
        print("DB OK:", dict(row))

        # Test User table structure
        cols = await conn.fetch("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'User' ORDER BY ordinal_position
        """)
        print("User columns:", [r["column_name"] for r in cols])

        # Test shift_logs table
        sl_cols = await conn.fetch("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'shift_logs' ORDER BY ordinal_position
        """)
        print("shift_logs columns:", [r["column_name"] for r in sl_cols])

        await conn.close()
    except Exception as e:
        print("ERROR:", type(e).__name__, e)

asyncio.run(test())
