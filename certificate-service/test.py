import asyncio
import os
from database import fetch_worker

async def test():
    try:
        worker = await fetch_worker("test")
        print("Success:", worker)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
