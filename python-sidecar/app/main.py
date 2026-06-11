from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import face
from app.routes import face_shape
from app.routes import products
from app.services.face_shape_classifier import close_face_shape_resources, load_face_shape_model

try:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    from app.routes import chat
    from app.routes.chat import limiter as chat_limiter

    CHAT_ROUTE_AVAILABLE = True
except ImportError as error:
    chat = None
    chat_limiter = None
    RateLimitExceeded = None
    SlowAPIMiddleware = None
    _rate_limit_exceeded_handler = None
    CHAT_ROUTE_AVAILABLE = False
    CHAT_ROUTE_IMPORT_ERROR = error


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_face_shape_model()
    yield
    close_face_shape_resources()


app = FastAPI(
    title="UniFace Sidecar",
    description="Face detection & shape classification sidecar service",
    version="1.0.0",
    lifespan=lifespan,
)

if CHAT_ROUTE_AVAILABLE:
    app.state.limiter = chat_limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face.router, prefix="/face", tags=["Face Analysis"])
app.include_router(face_shape.router, prefix="/face-shape", tags=["Xception Face Shape"])
app.include_router(products.router, prefix="/products", tags=["Products"])
if CHAT_ROUTE_AVAILABLE:
    app.include_router(chat.router, prefix="/chat", tags=["Groq Chat"])


@app.get("/health")
def health():
    response = {"status": "ok", "service": "python-sidecar"}
    if not CHAT_ROUTE_AVAILABLE:
        response["chat"] = "unavailable"
        response["chat_reason"] = "chat dependencies are not installed"
    return response
