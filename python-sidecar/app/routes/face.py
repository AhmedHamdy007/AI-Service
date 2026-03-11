from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.face_shape import analyze_face_from_bytes
import traceback
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze")
async def analyze_face(file: UploadFile = File(...)):
    """
    Upload a face image → returns detected face shape + measurements.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()

    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    try:
        result = analyze_face_from_bytes(image_bytes)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        print(error_msg)  # Also print to console
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shapes")
def get_supported_shapes():
    """Returns all supported face shapes."""
    return {
        "shapes": ["Oval", "Round", "Square", "Heart", "Diamond", "Oblong"],
        "description": {
            "Oval":    "Balanced proportions, slightly longer than wide",
            "Round":   "Similar width and height, soft angles",
            "Square":  "Strong jawline, equal width at jaw/cheek/forehead",
            "Heart":   "Wide forehead, narrow pointed chin",
            "Diamond": "Wide cheekbones, narrow forehead and jaw",
            "Oblong":  "Long narrow face, forehead/jaw similar width",
        }
    }
