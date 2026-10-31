import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
DATABASE_URL = os.getenv("DATABASE_URL", "")
WISPR_MCP_URL = os.getenv("WISPR_MCP_URL", "https://api.wisprflow.ai/connect/mcp")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")