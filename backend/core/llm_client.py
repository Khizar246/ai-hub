# Single Anthropic SDK wrapper used by all agents — never call anthropic.Anthropic() directly

import base64
from collections.abc import AsyncGenerator

from anthropic import Anthropic

from core import telemetry
from core.config import settings

# max_retries: SDK retries 429/5xx/connection errors with exponential backoff.
# timeout: per-attempt ceiling so a hung request can't stall a worker forever.
client = Anthropic(
    api_key=settings.ANTHROPIC_API_KEY,
    max_retries=3,
    timeout=120.0,
)


def _first_text(response) -> str:
    """Return the first text block from a Messages response.

    The SDK can return non-text blocks (e.g. tool_use) first; indexing
    content[0].text blindly would raise AttributeError. Fall back to the first
    block that actually carries text, else an empty string.
    """
    for block in response.content:
        text = getattr(block, "text", None)
        if text is not None:
            return text
    return ""


def call_claude(
    prompt: str,
    system: str = "",
    model: str | None = None,
    temperature: float = 0.1,
    max_tokens: int = 2000,
) -> str:
    """Send a text prompt to Claude and return the full response text."""
    resolved_model = model or settings.CLAUDE_MODEL
    try:
        response = client.messages.create(
            model=resolved_model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception:
        telemetry.record_llm_call(resolved_model, 0, 0, success=False)
        raise
    telemetry.record_llm_call(
        resolved_model, response.usage.input_tokens, response.usage.output_tokens
    )
    return _first_text(response)


def call_claude_vision(image_bytes: bytes, prompt: str) -> str:
    """Send a rendered PDF page image to Claude vision for content extraction."""
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
    try:
        response = client.messages.create(
            model=settings.CLAUDE_VISION_MODEL,
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_data,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
    except Exception:
        telemetry.record_llm_call(settings.CLAUDE_VISION_MODEL, 0, 0, success=False)
        raise
    telemetry.record_llm_call(
        settings.CLAUDE_VISION_MODEL,
        response.usage.input_tokens,
        response.usage.output_tokens,
    )
    return _first_text(response)


async def stream_claude(
    prompt: str,
    system: str = "",
    model: str | None = None,
    temperature: float = 0.1,
    max_tokens: int = 2000,
) -> AsyncGenerator[str, None]:
    """Async generator that streams Claude response tokens for SSE delivery."""
    resolved_model = model or settings.CLAUDE_MODEL
    with client.messages.stream(
        model=resolved_model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield text
