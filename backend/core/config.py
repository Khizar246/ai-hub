# Pydantic-settings: loads .env, validates all config on startup — shared by all agents

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM
    ANTHROPIC_API_KEY: str
    CLAUDE_MODEL: str = "claude-sonnet-4-5"
    CLAUDE_VISION_MODEL: str = "claude-opus-4-5"

    # Embeddings
    VOYAGE_API_KEY: str
    EMBEDDING_MODEL: str = "voyage-3"

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 5173

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Security
    # When set, /agents/* and /stats require login (POST /auth/login → bearer
    # token). Empty = auth disabled (local dev default).
    APP_ACCESS_CODE: str = ""
    # Comma-separated list of allowed CORS origins; "*" = allow all (dev only).
    ALLOWED_ORIGINS: str = "*"
    # Encrypts DB credentials at rest in Redis. Falls back to a key derived
    # from ANTHROPIC_API_KEY when unset, so encryption is always on.
    SESSION_SECRET_KEY: str = ""
    # Max size for /parse-excel uploads (files are read into memory).
    MAX_UPLOAD_MB: int = 20

    # Storage paths
    VECTOR_STORE_PATH: str = "./storage/vector_stores"
    UPLOADS_PATH: str = "./storage/uploads"
    EXPORTS_PATH: str = "./storage/exports"

    # Audit Agent
    AUDIT_CHUNK_SIZE: int = 1000
    AUDIT_CHUNK_OVERLAP: int = 200
    AUDIT_RETRIEVAL_K: int = 12

    # News Agent
    NEWS_CHUNK_SIZE: int = 1000
    NEWS_CHUNK_OVERLAP: int = 150


settings = Settings()
