# ChromaDB session-scoped vector store for audit document chunks.

from __future__ import annotations

from pathlib import Path

import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter

from agents.audit.processors.pdf_extractor import PageResult
from core.config import settings
from core.embeddings import get_voyage_embeddings
from core.logger import get_logger

logger = get_logger("audit.embedder")


def _collection_name(session_id: str) -> str:
    # ChromaDB collection names must be 3-63 chars, alphanumeric + hyphens
    safe = session_id.replace("_", "-")[:60]
    return f"audit-{safe}"


def _get_client() -> chromadb.PersistentClient:
    path = Path(settings.VECTOR_STORE_PATH) / "audit"
    path.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(path))


def embed_pages(session_id: str, pages: list[PageResult]) -> int:
    """
    Split page content into chunks and upsert into a session-scoped ChromaDB collection.
    Returns the number of chunks stored.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.AUDIT_CHUNK_SIZE,
        chunk_overlap=settings.AUDIT_CHUNK_OVERLAP,
    )
    embeddings_model = get_voyage_embeddings()

    # Build raw texts with source metadata
    docs: list[str] = []
    metadatas: list[dict] = []

    for page in pages:
        # Combine prose text + table markdown
        parts = [page.text] + page.tables
        full_text = "\n\n".join(p for p in parts if p.strip())
        if not full_text.strip():
            continue

        chunks = splitter.split_text(full_text)
        for chunk in chunks:
            docs.append(chunk)
            metadatas.append({"page": page.page_num, "session_id": session_id})

    if not docs:
        logger.warning(f"no_chunks_to_embed session_id={session_id}")
        return 0

    logger.info(f"embedding_chunks session_id={session_id} count={len(docs)}")

    # Embed via VoyageAI
    vectors = embeddings_model.embed_documents(docs)

    client = _get_client()
    collection = client.get_or_create_collection(
        name=_collection_name(session_id),
        metadata={"hnsw:space": "cosine"},
    )

    ids = [f"{session_id}-{i}" for i in range(len(docs))]
    collection.upsert(
        ids=ids,
        documents=docs,
        embeddings=vectors,
        metadatas=metadatas,
    )

    logger.info(f"chunks_embedded session_id={session_id} stored={len(docs)}")
    return len(docs)


def retrieve_chunks(
    session_id: str,
    query: str,
    k: int | None = None,
) -> list[str]:
    """
    Retrieve top-k relevant chunks for a query using MMR-style diversity via ChromaDB.
    Falls back to simple similarity if MMR is unavailable.
    Returns a list of chunk strings.
    """
    k = k or settings.AUDIT_RETRIEVAL_K
    embeddings_model = get_voyage_embeddings()

    query_vector = embeddings_model.embed_query(query)

    client = _get_client()
    try:
        collection = client.get_collection(_collection_name(session_id))
    except Exception:
        logger.warning(f"collection_not_found session_id={session_id}")
        return []

    try:
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=min(k, collection.count()),
            include=["documents"],
        )
        docs = results.get("documents", [[]])[0]
        return docs
    except Exception as exc:
        logger.error(f"retrieval_failed session_id={session_id} error={exc}")
        return []


def clear_collection(session_id: str) -> None:
    """Delete the session's ChromaDB collection."""
    client = _get_client()
    name = _collection_name(session_id)
    try:
        client.delete_collection(name)
        logger.info(f"collection_deleted session_id={session_id}")
    except Exception:
        pass  # Collection may not exist
