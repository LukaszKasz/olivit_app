import asyncio
import os
import sys

# Add backend to path so imports work
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from services.baselinker import baselinker_client

async def test():
    res = await baselinker_client.get_latest_orders()
    print("RES:", res)

asyncio.run(test())
