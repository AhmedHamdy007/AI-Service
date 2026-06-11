import json

import anyio
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.groq_chat import (
    ChatAuthenticationError,
    ChatConfigError,
    ChatProviderUnavailableError,
    ChatRateLimitError,
    complete_chat,
    sanitize_messages,
    stream_chat,
)


router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class ChatMessage(BaseModel):
    role: str = Field(..., min_length=1, max_length=16)
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=24)


def _to_safe_messages(payload: ChatRequest) -> list[dict]:
    return sanitize_messages([message.dict() for message in payload.messages])


def _raise_clean_error(error: Exception) -> None:
    if isinstance(error, ChatConfigError):
        raise HTTPException(status_code=503, detail="Chat is not configured")
    if isinstance(error, ChatAuthenticationError):
        raise HTTPException(status_code=503, detail="Chat provider authentication failed")
    if isinstance(error, ChatRateLimitError):
        raise HTTPException(status_code=429, detail="Chat is temporarily busy")
    if isinstance(error, ChatProviderUnavailableError):
        raise HTTPException(status_code=503, detail="Chat is temporarily unavailable")
    if isinstance(error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid chat request")

    raise HTTPException(status_code=500, detail="Chat failed")


@router.post("")
@limiter.limit("20/minute")
async def chat(request: Request, payload: ChatRequest):
    del request
    try:
        messages = _to_safe_messages(payload)
        reply = await anyio.to_thread.run_sync(complete_chat, messages)
        return {"message": reply}
    except Exception as error:
        _raise_clean_error(error)


@router.post("/stream")
@limiter.limit("20/minute")
async def chat_stream(request: Request, payload: ChatRequest):
    del request

    try:
        messages = _to_safe_messages(payload)
    except Exception as error:
        _raise_clean_error(error)

    def generate():
        try:
            for chunk in stream_chat(messages):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error': 'Chat is temporarily unavailable', 'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
