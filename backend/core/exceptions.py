# Custom exceptions and FastAPI error handlers for all agents

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AIHubException(Exception):
    """Base exception for all AI Hub errors."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class AgentError(AIHubException):
    """Raised when an agent fails to process a request."""


class PDFExtractionError(AIHubException):
    """Raised when PDF text or image extraction fails."""


class VectorStoreError(AIHubException):
    """Raised when ChromaDB or FAISS operations fail."""


class SessionError(AIHubException):
    """Raised when Redis session operations fail."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class DatabaseConnectionError(AIHubException):
    """Raised when the user-supplied database cannot be reached."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class ScrapingError(AIHubException):
    """Raised when Crawl4AI fails to scrape a URL."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers on the FastAPI app instance."""

    @app.exception_handler(AIHubException)
    async def _aihub_handler(request: Request, exc: AIHubException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message, "type": type(exc).__name__},
        )

    @app.exception_handler(Exception)
    async def _generic_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error": "An unexpected error occurred.", "type": "InternalServerError"},
        )
