from functools import lru_cache
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SECRET_KEY


@lru_cache
def get_db() -> Client:
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SECRET_KEY are not set in backend/.env")
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
