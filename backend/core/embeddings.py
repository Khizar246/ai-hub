# Shared VoyageAI embeddings wrapper — used by audit (ChromaDB) and importable by any agent.
# The news agent defines its own copy; future agents should import from here.

import voyageai
from langchain_core.embeddings import Embeddings

from core.config import settings


class VoyageEmbeddings(Embeddings):
    """
    LangChain Embeddings adapter around the voyageai client.
    Reads VOYAGE_API_KEY from the environment (consumed directly by the voyageai SDK).
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


def get_voyage_embeddings(model: str | None = None) -> VoyageEmbeddings:
    """Return a VoyageEmbeddings instance using the configured model."""
    return VoyageEmbeddings(model=model or settings.EMBEDDING_MODEL)
