from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import face
from app.routes import products

app = FastAPI(
    title="UniFace Sidecar",
    description="Face detection & shape classification sidecar service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face.router, prefix="/face", tags=["Face Analysis"])
app.include_router(products.router, prefix="/products", tags=["Products"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "python-sidecar"}
