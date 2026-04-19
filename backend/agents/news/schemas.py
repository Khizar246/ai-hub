# Pydantic models for the News Research Agent

from pydantic import BaseModel


class IngestRequest(BaseModel):
    urls: list[str]


class ArticleSummary(BaseModel):
    url: str
    title: str
    word_count: int
    status: str          # "ok" | "skipped" | "error"
    error: str | None = None


class IngestResponse(BaseModel):
    articles_processed: int
    articles: list[ArticleSummary]


class QuestionRequest(BaseModel):
    question: str


class Source(BaseModel):
    url: str
    title: str
    excerpt: str


class AnswerResponse(BaseModel):
    answer: str
    sources: list[Source]
    confidence: str      # "high" | "medium" | "low"


class ChatMessage(BaseModel):
    role: str            # "user" | "assistant"
    content: str
    sources: list[Source] = []


class HistoryResponse(BaseModel):
    messages: list[ChatMessage]
