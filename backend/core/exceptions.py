# Custom exceptions and FastAPI error handlers for all agents

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from core.logger import get_logger

logger = get_logger("exceptions")


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
    """Raised when the news scraper fails to fetch or render a URL."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers on the FastAPI app instance."""

    @app.exception_handler(AIHubException)
    async def _aihub_handler(request: Request, exc: AIHubException) -> JSONResponse:
        # `detail` is the key the frontend reads (FastAPI HTTPException convention);
        # `error` is kept for any older consumers.
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "error": exc.message, "type": type(exc).__name__},
        )

    @app.exception_handler(Exception)
    async def _generic_handler(request: Request, exc: Exception) -> JSONResponse:
        # Log the full traceback so 500s are diagnosable from server logs, even
        # though the client only sees a generic message.
        logger.exception(f"unhandled_exception path={request.url.path} error={exc}")
        message = "An unexpected error occurred."
        return JSONResponse(
            status_code=500,
            content={"detail": message, "error": message, "type": "InternalServerError"},
        )
