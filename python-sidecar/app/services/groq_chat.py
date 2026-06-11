import os
import time
from pathlib import Path
from typing import Callable, Iterable, List

from groq import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    Groq,
    RateLimitError,
)


def _load_local_env_file() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and not os.environ.get(key):
            os.environ[key] = value


_load_local_env_file()

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "350"))
GROQ_TIMEOUT_SECONDS = float(os.getenv("GROQ_TIMEOUT_SECONDS", "20"))
MAX_MESSAGES = 24
MAX_MESSAGE_CHARS = 4000
TRANSIENT_STATUS_CODES = {408, 409, 429, 500, 502, 503, 504}

_groq_client = Groq(
    api_key=os.getenv("GROQ_API_KEY") or "missing-groq-api-key",
    timeout=GROQ_TIMEOUT_SECONDS,
    max_retries=0,
)


class ChatConfigError(Exception):
    pass


class ChatRateLimitError(Exception):
    pass


class ChatProviderUnavailableError(Exception):
    pass


class ChatAuthenticationError(Exception):
    pass


def _require_api_key() -> None:
    if not os.getenv("GROQ_API_KEY"):
        raise ChatConfigError("Groq chat is not configured")


def _sanitize_content(value: str) -> str:
    cleaned = str(value or "").replace("\x00", "").strip()
    return cleaned[:MAX_MESSAGE_CHARS]


def sanitize_messages(messages: List[dict]) -> List[dict]:
    safe_messages = []

    for message in messages[-MAX_MESSAGES:]:
        role = str(message.get("role", "")).strip().lower()
        if role not in {"system", "user", "assistant"}:
            continue

        content = _sanitize_content(message.get("content", ""))
        if not content:
            continue

        safe_messages.append({"role": role, "content": content})

    if not any(message["role"] == "user" for message in safe_messages):
        raise ValueError("At least one user message is required")

    return safe_messages


def _is_transient_error(error: Exception) -> bool:
    if isinstance(error, (APIConnectionError, APITimeoutError, RateLimitError)):
        return True

    if isinstance(error, APIStatusError):
        return error.status_code in TRANSIENT_STATUS_CODES

    return False


def _map_provider_error(error: Exception) -> Exception:
    if isinstance(error, AuthenticationError):
        return ChatAuthenticationError("Groq chat authentication failed")

    if isinstance(error, RateLimitError):
        return ChatRateLimitError("Groq chat is temporarily rate limited")

    return ChatProviderUnavailableError("Groq chat is temporarily unavailable")


def _with_retry(operation: Callable[[], object], attempts: int = 3):
    last_error = None

    for attempt in range(attempts):
        try:
            return operation()
        except Exception as error:
            last_error = error
            if not _is_transient_error(error) or attempt == attempts - 1:
                raise _map_provider_error(error) from error

            time.sleep(0.35 * (2**attempt))

    raise ChatProviderUnavailableError("Groq chat is temporarily unavailable") from last_error


def complete_chat(messages: List[dict]) -> str:
    _require_api_key()
    safe_messages = sanitize_messages(messages)

    def operation():
        return _groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=safe_messages,
            temperature=0.6,
            max_tokens=GROQ_MAX_TOKENS,
            stream=False,
        )

    completion = _with_retry(operation)
    return (completion.choices[0].message.content or "").strip()


def stream_chat(messages: List[dict]) -> Iterable[str]:
    _require_api_key()
    safe_messages = sanitize_messages(messages)

    def operation():
        return _groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=safe_messages,
            temperature=0.6,
            max_tokens=GROQ_MAX_TOKENS,
            stream=True,
        )

    stream = _with_retry(operation)

    try:
        for event in stream:
            chunk = event.choices[0].delta.content or ""
            if chunk:
                yield chunk
    except Exception as error:
        raise _map_provider_error(error) from error
