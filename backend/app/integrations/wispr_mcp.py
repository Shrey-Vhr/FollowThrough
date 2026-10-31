import asyncio
import json
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from pydantic import AnyUrl
from mcp import ClientSession
from mcp.client.auth import OAuthClientProvider, TokenStorage
from mcp.client.streamable_http import streamablehttp_client
from mcp.shared.auth import OAuthClientInformationFull, OAuthClientMetadata, OAuthToken

from app.config import WISPR_MCP_URL

TOKEN_FILE = Path(__file__).resolve().parents[2] / "wispr_tokens.json"
CALLBACK_PORT = 8765
REDIRECT_URI = f"http://localhost:{CALLBACK_PORT}/callback"


class FileTokenStorage(TokenStorage):
    def _load(self) -> dict:
        return json.loads(TOKEN_FILE.read_text()) if TOKEN_FILE.exists() else {}

    def _save(self, data: dict):
        TOKEN_FILE.write_text(json.dumps(data, indent=2))

    async def get_tokens(self):
        d = self._load().get("tokens")
        return OAuthToken(**d) if d else None

    async def set_tokens(self, tokens: OAuthToken):
        d = self._load()
        d["tokens"] = tokens.model_dump(mode="json")
        self._save(d)

    async def get_client_info(self):
        d = self._load().get("client_info")
        return OAuthClientInformationFull(**d) if d else None

    async def set_client_info(self, info: OAuthClientInformationFull):
        d = self._load()
        d["client_info"] = info.model_dump(mode="json")
        self._save(d)


async def _redirect_handler(url: str):
    print("Opening browser for Wispr sign-in:", url)
    webbrowser.open(url)


async def _callback_handler():
    result = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            q = parse_qs(urlparse(self.path).query)
            result["code"] = q.get("code", [None])[0]
            result["state"] = q.get("state", [None])[0]
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Wispr connected. You can close this tab.")

        def log_message(self, *args):
            pass

    server = HTTPServer(("localhost", CALLBACK_PORT), Handler)
    await asyncio.to_thread(server.handle_request)
    server.server_close()
    return result["code"], result["state"]


def _auth():
    return OAuthClientProvider(
        server_url=WISPR_MCP_URL,
        client_metadata=OAuthClientMetadata(
            client_name="FollowThrough",
            redirect_uris=[AnyUrl(REDIRECT_URI)],
            grant_types=["authorization_code", "refresh_token"],
            response_types=["code"],
            token_endpoint_auth_method="none",
        ),
        storage=FileTokenStorage(),
        redirect_handler=_redirect_handler,
        callback_handler=_callback_handler,
    )


async def call_tool(name: str, args: dict) -> dict:
    async with streamablehttp_client(WISPR_MCP_URL, auth=_auth()) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            res = await session.call_tool(name, args)
            if res.isError:
                msg = res.content[0].text if res.content else "Wispr tool error"
                raise RuntimeError(msg)
            if getattr(res, "structuredContent", None):
                return res.structuredContent
            return json.loads(res.content[0].text)


async def list_meetings(limit: int = 25) -> list[dict]:
    data = await call_tool("search_meetings", {"limit": limit})
    return data.get("meetings", [])


async def get_meeting(meeting_id: str) -> dict:
    return await call_tool(
        "get_meeting",
        {"meeting_id": meeting_id, "view_transcript": {"char_limit": 40000}},
    )