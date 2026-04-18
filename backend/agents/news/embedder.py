# FAISS vector store with URL-based caching — replaces the HuggingFace + FAISS pattern from the original.
# Uses voyage-3 embeddings via the voyageai SDK wrapped in a LangChain Embeddings interface.

import shutil
from pathlib import Path
from typing import Optional

import voyageai
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)


# ── VoyageAI embeddings wrapper ───────────────────────────────────────────────

class VoyageEmbeddings(Embeddings):
    """
    Thin LangChain Embeddings adapter around the voyageai client.
    Uses VOYAGE_API_KEY from the environment (read by the voyageai SDK directly).
    """

    def __init__(self, model: str = "voyage-3") -> None:
        self.model = model
        self._client = voyageai.Client(api_key=settings.VOYAGE_API_KEY)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        result = self._client.embed(texts, model=self.model, input_type="document")
        return result.embeddings

    def embed_query(self, text: str) -> list[float]:
        result = self._client.embed([text], model=self.model, input_type="query")
        return result.embeddings[0]


def _make_embeddings() -> VoyageEmbeddings:
    return VoyageEmbeddings(model=settings.EMBEDDING_MODEL)


# ── Disk persistence helpers ──────────────────────────────────────────────────

def _store_dir(session_id: str) -> Path:
    """Return (and create) the per-session FAISS directory."""
    path = Path(settings.VECTOR_STORE_PATH) / session_id / "news"
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_vectorstore(session_id: str) -> Optional[FAISS]:
    """Load the FAISS index from disk; returns None if not yet created."""
    store_dir = _store_dir(session_id)
    if not (store_dir / "index.faiss").exists():
        return None
    try:
        return FAISS.load_local(
            str(store_dir),
            _make_embeddings(),
            allow_dangerous_deserialization=True,
        )
    except Exception as exc:
        logger.error(f"FAISS load failed for session {session_id}: {exc}")
        return None


def save_vectorstore(session_id: str, store: FAISS) -> None:
    """Persist the FAISS index to disk."""
    store.save_local(str(_store_dir(session_id)))


def clear_vectorstore(session_id: str) -> None:
    """Delete the session's FAISS store directory from disk."""
    store_dir = _store_dir(session_id)
    if store_dir.exists():
        shutil.rmtree(store_dir)
        logger.info(f"Cleared FAISS store for session {session_id}")


# ── Embedding pipeline ────────────────────────────────────────────────────────

def embed_articles(
    session_id: str,
    articles: list[dict],
    already_processed_urls: set[str],
) -> tuple[Optional[FAISS], list[str]]:
    """
    Embed new articles into the session FAISS store.

    - Skips any URL already present in `already_processed_urls` (URL-based caching).
    - Merges new vectors into the existing index if one already exists for the session.

    Returns (updated_store, list_of_newly_embedded_urls).
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.NEWS_CHUNK_SIZE,
        chunk_overlap=settings.NEWS_CHUNK_OVERLAP,
        separators=["\n\n", "\n", ".", "!", "?", ";", ",", " "],
    )

    new_docs: list[Document] = []
    newly_embedded: list[str] = []

    for article in articles:
        url = article["url"]
        content = article.get("content", "")
        if not content or url in already_processed_urls:
            continue

        title = article.get("title", url)
        chunks = splitter.split_text(content)
        for i, chunk in enumerate(chunks):
            new_docs.append(
                Document(
                    page_content=chunk,
                    metadata={"url": url, "title": title, "chunk_index": i},
                )
            )
        newly_embedded.append(url)

    if not new_docs:
        logger.info(f"No new articles to embed for session {session_id}")
        return load_vectorstore(session_id), []

    embedder = _make_embeddings()
    existing_store = load_vectorstore(session_id)

    if existing_store is None:
        store = FAISS.from_documents(new_docs, embedder)
    else:
        new_store = FAISS.from_documents(new_docs, embedder)
        existing_store.merge_from(new_store)
        store = existing_store

    save_vectorstore(session_id, store)
    logger.info(
        f"Embedded {len(new_docs)} chunks from {len(newly_embedded)} new articles "
        f"for session {session_id}"
    )
    return store, newly_embedded


# ── Retrieval ─────────────────────────────────────────────────────────────────

def retrieve_chunks(session_id: str, question: str, k: int = 8) -> list[dict]:
    """
    Semantic search over the session FAISS store.

    Returns a list of dicts with keys: content, url, title, chunk_index, score.
    Returns an empty list if no store exists yet.
    """
    store = load_vectorstore(session_id)
    if store is None:
        return []

    try:
        results = store.similarity_search_with_score(question, k=k)
    except Exception as exc:
        logger.error(f"FAISS search failed for session {session_id}: {exc}")
        return []

    return [
        {
            "content": doc.page_content,
            "url": doc.metadata.get("url", ""),
            "title": doc.metadata.get("title", ""),
            "chunk_index": doc.metadata.get("chunk_index", 0),
            "score": float(score),
        }
        for doc, score in results
    ]
