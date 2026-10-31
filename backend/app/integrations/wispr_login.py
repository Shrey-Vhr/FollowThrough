import asyncio
from app.integrations.wispr_mcp import list_meetings


async def main():
    meetings = await list_meetings(5)
    print(f"Connected! Found {len(meetings)} meetings:")
    for m in meetings:
        print("-", m["id"], "|", m.get("title") or "(untitled)", "|", m.get("start"))


asyncio.run(main())