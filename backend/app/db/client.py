from functools import lru_cache
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SECRET_KEY


@lru_cache
def get_db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)