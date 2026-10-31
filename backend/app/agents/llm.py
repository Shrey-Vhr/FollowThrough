"""LLM + embedding foundation for the agents (OpenAI via LangChain)."""
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel

# backend/app/agents/llm.py -> backend/.env
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

if not os.getenv("OPENAI_API_KEY") and os.getenv("LLM_API_KEY"):
    os.environ["OPENAI_API_KEY"] = os.environ["LLM_API_KEY"]

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL") or "text-embedding-3-small"
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM") or 1536)


def _llm_model() -> str:
    model = os.getenv("LLM_MODEL")
    if not model:
        raise RuntimeError(
            "LLM_MODEL is not set. Set it in backend/.env (see backend/.env.example)."
        )
    return model


@lru_cache(maxsize=None)
def get_chat_model(temperature: float | None = None) -> ChatOpenAI:
    # Some models (e.g. reasoning models) reject any temperature but the default,
    # so it is only sent when explicitly requested.
    kwargs = {} if temperature is None else {"temperature": temperature}
    return ChatOpenAI(model=_llm_model(), **kwargs)


def get_structured_model(schema: type[BaseModel]):
    return get_chat_model().with_structured_output(
        schema, method="json_schema", strict=True
    )


@lru_cache(maxsize=None)
def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(model=EMBEDDING_MODEL)


def _check_dim(vectors: list[list[float]]) -> None:
    for i, v in enumerate(vectors):
        if len(v) != EMBEDDING_DIM:
            raise ValueError(
                f"Embedding {i} has length {len(v)}, expected EMBEDDING_DIM={EMBEDDING_DIM} "
                f"(model={EMBEDDING_MODEL}). Check EMBEDDING_MODEL / EMBEDDING_DIM."
            )


def embed_texts(texts: list[str]) -> list[list[float]]:
    vectors = get_embeddings().embed_documents(texts)
    _check_dim(vectors)
    return vectors


def embed_text(text: str) -> list[float]:
    vector = get_embeddings().embed_query(text)
    _check_dim([vector])
    return vector
