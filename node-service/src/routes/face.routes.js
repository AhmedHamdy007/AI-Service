const express  = require("express");
const multer   = require("multer");
const { analyzeFace, checkSidecarHealth, getSupportedShapes } = require("../services/sidecarClient");
const { getRecommendations } = require("../services/recommendationEngine");
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
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
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

    // 1. Detect face shape via Python sidecar
    const faceResult = await analyzeFace(req.file.buffer, req.file.mimetype);

    if (!faceResult.success) {
      return res.status(422).json({
        success: false,
        error: faceResult.detail || "Face analysis failed",
        request_id: req.id,
      });
    }

    const { face_shape, confidence, measurements, all_scores, mock } = faceResult.data;

    // 2. Optionally run recommendations if attributes provided
    const { hairType, gender, lifestyle } = req.body;
    let recommendations = null;

    if (hairType || gender || lifestyle) {
      // Validate optional attributes
      const validatedHairType = validateHairType(hairType);
      const validatedGender = validateGender(gender);
      const validatedLifestyle = validateLifestyle(lifestyle);

      recommendations = getRecommendations({
        faceShape: face_shape,
        hairType: validatedHairType,
        gender: validatedGender,
        lifestyle: validatedLifestyle,
        limit: 5,
      });
    }

    req.logger.info("Face analysis completed", {
      request_id: req.id,
      faceShape: face_shape,
      confidence,
    });

    res.json({
      success: true,
      data: {
        faceShape:       face_shape,
        confidence,
        measurements,
        allScores:       all_scores,
        recommendations,
        mock:            mock || false,
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
