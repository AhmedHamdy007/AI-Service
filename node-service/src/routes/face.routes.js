const express  = require("express");
const multer   = require("multer");
const { analyzeFaceShape, checkSidecarHealth, getSupportedShapes } = require("../services/sidecarClient");
const { getRecommendations } = require("../data/haircutData");
const {
  validateImageFile,
  validateHairType,
  validateGender,
  validateLifestyle,
  ValidationError,
} = require("../utils/validation");

const router  = express.Router();
const upload  = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new ValidationError("Only image files are allowed", "file"), false);
    }
    cb(null, true);
  },
});

/**
 * POST /api/face/analyze
 * Upload a face photo → get face shape + optional hairstyle recommendations
 *
 * Body (multipart/form-data):
 *   file     — image file (required)
 *   hairType — Straight | Wavy | Curly | Coily (optional)
 *   gender   — male | female (optional)
 *   lifestyle — Professional | Casual | Trendy (optional)
 *
 * Microsoft best practice: validate all inputs before processing
 */
router.post("/analyze", upload.single("file"), async (req, res) => {
  try {
    // Validate file upload
    validateImageFile(req.file);

    req.logger.debug("Face analysis request received", {
      request_id: req.id,
      fileName: req.file?.originalname,
    });

    // 1. Detect face shape via the ConvNeXt classifier in the Python sidecar.
    const faceResult = await analyzeFaceShape(req.file.buffer, req.file.mimetype);

    // 2. Build structured haircut cards from the shared local knowledge base.
    const { hairType, gender, lifestyle } = req.body;
    if (hairType) validateHairType(hairType);
    if (lifestyle) validateLifestyle(lifestyle);

    const validatedGender = validateGender(gender) || "female";
    const recommendations = faceResult.face_detected
      ? getRecommendations(faceResult.shape, validatedGender, 3)
      .map((cut) => ({
        id: cut.id,
        name: cut.name,
        altName: cut.altName,
        why: cut.why,
        tags: cut.tags,
        imageUrl: cut.imageUrl,
      }))
      : [];

    req.logger.info("Face analysis completed", {
      request_id: req.id,
      faceShape: faceResult.shape,
      confidence: faceResult.confidence,
    });

    res.json({
      success: true,
      data: {
        faceDetected:    faceResult.face_detected,
        faceShape:       faceResult.shape,
        shape:           faceResult.shape,
        confidence:      faceResult.confidence,
        method:          faceResult.method,
        gender:          validatedGender,
        measurements:    faceResult.measurements || {},
        allScores:       faceResult.all_scores || {},
        geometricScores: faceResult.geometric_scores || {},
        recommendations,
        mock:            false,
      },
      request_id: req.id,
    });
  } catch (err) {
    throw err; // Let error handler catch it
  }
});

/**
 * GET /api/face/shapes
 * Returns all supported face shapes
 */
router.get("/shapes", async (req, res) => {
  try {
    const shapes = await getSupportedShapes();
    res.json({
      success: true,
      data: shapes,
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

/**
 * GET /api/face/health
 * Check if the Python sidecar is reachable
 */
router.get("/health", async (req, res) => {
  try {
    const health = await checkSidecarHealth();
    res.json({
      success: true,
      data: {
        nodeService: "ok",
        pythonSidecar: health,
      },
      request_id: req.id,
    });
  } catch (err) {
    req.logger.error("Sidecar health check failed", {
      request_id: req.id,
    }, err);

    res.status(503).json({
      success: false,
      data: {
        nodeService: "ok",
        pythonSidecar: "unreachable",
      },
      error: "Python sidecar service is unavailable",
      request_id: req.id,
    });
  }
});

module.exports = router;
