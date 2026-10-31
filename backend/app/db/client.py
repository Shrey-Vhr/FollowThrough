import threading

import httpx
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from app.config import SUPABASE_URL, SUPABASE_SECRET_KEY

_local = threading.local()


def get_db() -> Client:
    """One client per thread (httpx clients are not safe to share between the event loop and
    worker threads), with short keep-alive so stale pooled sockets are not reused (Windows
    otherwise raises WinError 10035 intermittently)."""
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SECRET_KEY are not set in backend/.env")
    client = getattr(_local, "client", None)
    if client is None:
        http = httpx.Client(
            transport=httpx.HTTPTransport(retries=3),
            limits=httpx.Limits(keepalive_expiry=2),
            timeout=60,
        )
        client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY, options=SyncClientOptions(httpx_client=http))
        _local.client = client
    return client
