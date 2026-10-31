"""Shared wiring for the agent graphs: ONE place that decides which store/checkpointer/executor is used.

How Pragti plugs in each piece (nothing else needs to change):
  - Store:        implement SupabaseStore in app/db/store.py (see STORE_CONTRACT.md) and set
                  USE_SUPABASE_STORE=true. get_store() imports and returns it.
  - Checkpointer: replace the MemorySaver in get_checkpointer() with the Postgres checkpointer.
  - Executor:     return the real Notion/Slack/email executor from get_executor().
Routes must call get_ingest_graph() instead of building their own graph, so every route shares the
same checkpointer and a run started by one request can be resumed by another.
"""
import os
from functools import lru_cache

from langgraph.checkpoint.memory import InMemorySaver

from app.agents.graphs.ingest import Executor, build_ingest_graph, dry_run_executor
from app.agents.store import InMemoryStore, Store

_store: Store | None = None
_checkpointer = None
_external_checkpointer = False  # set by set_checkpointer(); reset() must not drop it


def use_supabase_store() -> bool:
    return os.getenv("USE_SUPABASE_STORE", "").strip().lower() == "true"


def get_store() -> Store:
    global _store
    if _store is None:
        if use_supabase_store():
            try:
                from app.db.store import SupabaseStore
            except ImportError as exc:
                raise RuntimeError(
                    "USE_SUPABASE_STORE=true but app.db.store.SupabaseStore could not be imported "
                    f"({exc}). Implement it (see STORE_CONTRACT.md) or unset USE_SUPABASE_STORE."
                ) from exc
            _store = SupabaseStore()
        else:
            _store = InMemoryStore()
    return _store


def get_checkpointer():
    global _checkpointer
    if _checkpointer is None:
        # TODO(Pragti): swap in the Postgres checkpointer here so paused runs survive restarts.
        _checkpointer = InMemorySaver()
    return _checkpointer


def set_checkpointer(checkpointer) -> None:
    """Plug in a checkpointer created elsewhere (the Postgres saver, built in the FastAPI lifespan)."""
    global _checkpointer, _external_checkpointer
    _checkpointer = checkpointer
    _external_checkpointer = True
    get_ingest_graph.cache_clear()


def get_executor() -> Executor:
    from app.integrations.executor import real_executor, use_real_integrations

    return real_executor if use_real_integrations() else dry_run_executor


@lru_cache(maxsize=1)
def get_ingest_graph():
    return build_ingest_graph(get_store(), get_checkpointer(), get_executor())


def reset() -> None:
    """Drop the singletons (fresh in-memory store, checkpointer and graph). Used by /dev/seed-demo."""
    global _store, _checkpointer
    _store = None
    if not _external_checkpointer:
        _checkpointer = None
    get_ingest_graph.cache_clear()
