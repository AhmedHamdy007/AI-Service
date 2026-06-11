import logging
import time

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.services.face_shape_classifier import FaceShapeModelError, predict

logger = logging.getLogger(__name__)
router = APIRouter()

SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


@router.post("/analyze")
async def analyze_face_shape(image: UploadFile = File(...)):
    started_at = time.perf_counter()
    if image.content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="File must be a jpeg, png, or webp image")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    try:
        result = await run_in_threadpool(predict, image_bytes)
        logger.info(
            "Face shape analysis completed",
            extra={
                "elapsed_ms": round((time.perf_counter() - started_at) * 1000),
                "image_bytes": len(image_bytes),
                "face_detected": result.get("face_detected"),
                "method": result.get("method"),
            },
        )
        return result
    except FaceShapeModelError as error:
        logger.exception("Face shape model error")
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:
        logger.exception("Face shape analysis failed")
        raise HTTPException(status_code=500, detail="Face shape analysis failed") from error
