const express = require("express");
const multer = require("multer");

const { analyzeFaceShape } = require("../services/sidecarClient");
const { getRecommendations } = require("../data/haircutData");
const { recommendStylesForFaceShape } = require("../services/groqChat");
const {
  ValidationError,
  validateGender,
  validateHairType,
  validateImageFile,
  validateLifestyle,
} = require("../utils/validation");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new ValidationError("Only jpeg, png, or webp images are allowed", "image"), false);
    }
    cb(null, true);
  },
});

function multipartImage(req, res, next) {
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Image file too large (max 5MB)",
        request_id: req.id,
      });
    }
    if (error) return next(error);
    return next();
  });
}

function getUploadedImage(req) {
  return req.files?.image?.[0] || req.files?.file?.[0] || null;
}

function isSidecarUnavailable(error) {
  return ["ECONNREFUSED", "ENOTFOUND", "ECONNABORTED", "ETIMEDOUT"].includes(error?.code);
}

function buildHaircutCards(faceShape, gender) {
  return getRecommendations(faceShape, gender, 3).map((cut) => ({
    id: cut.id,
    name: cut.name,
    altName: cut.altName,
    why: cut.why,
    tags: cut.tags,
    imageUrl: cut.imageUrl,
  }));
}

function buildRecommendationSummaries(recommendations) {
  return recommendations.map((cut) => `${cut.name}: ${cut.why}`);
}

async function withTimeout(promise, timeoutMs, fallbackValue) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function toLegacyData(faceShape, { gender, recommendations = [], llmRecommendations = [] } = {}) {
  return {
    faceDetected: Boolean(faceShape.face_detected),
    faceShape: faceShape.shape,
    shape: faceShape.shape,
    confidence: faceShape.confidence,
    method: faceShape.method,
    gender,
    allScores: faceShape.all_scores || {},
    cnnShape: faceShape.cnn_shape || null,
    cnnConfidence: faceShape.cnn_confidence ?? null,
    geometricShape: faceShape.geometric_shape || null,
    geometricConfidence: faceShape.geometric_confidence ?? null,
    geometricScores: faceShape.geometric_scores || {},
    measurements: faceShape.measurements || {},
    fallbackReason: faceShape.fallback_reason || null,
    uncertaintyReason: faceShape.uncertainty_reason || null,
    isConfident: faceShape.is_confident ?? null,
    candidates: faceShape.candidates || [],
    viewPredictions: faceShape.view_predictions || [],
    recommendations,
    llmRecommendations,
    mock: false,
  };
}

router.post("/", multipartImage, async (req, res) => {
  const startedAt = Date.now();
  const image = getUploadedImage(req);
  validateImageFile(image);

  try {
    const { hairType, gender, lifestyle } = req.body;
    if (hairType) validateHairType(hairType);
    if (lifestyle) validateLifestyle(lifestyle);
    const validatedGender = validateGender(gender) || "female";

    const faceShape = await analyzeFaceShape(image.buffer, image.mimetype);
    const analysisMs = Date.now() - startedAt;

    if (!faceShape.face_detected) {
      req.logger?.info?.("Face shape analysis completed without detected face", {
        request_id: req.id,
        analysis_ms: analysisMs,
      });
      return res.json({
        face_shape: faceShape,
        recommendations: [],
        data: toLegacyData(faceShape, {
          gender: validatedGender,
          recommendations: [],
          llmRecommendations: [],
        }),
        message: "No face detected. Please retry with a clearer, front-facing photo.",
        request_id: req.id,
      });
    }

    const cardRecommendations = buildHaircutCards(faceShape.shape, validatedGender);
    const fallbackRecommendations = buildRecommendationSummaries(cardRecommendations);
    const llmStartedAt = Date.now();
    const llmRecommendations = await withTimeout(
      recommendStylesForFaceShape(faceShape.shape),
      1200,
      fallbackRecommendations
    );

    req.logger?.info?.("Face shape analysis completed", {
      request_id: req.id,
      face_shape: faceShape.shape,
      method: faceShape.method,
      confidence: faceShape.confidence,
      analysis_ms: analysisMs,
      recommendation_ms: Date.now() - llmStartedAt,
      total_ms: Date.now() - startedAt,
    });

    return res.json({
      face_shape: faceShape,
      recommendations: llmRecommendations,
      data: toLegacyData(faceShape, {
        gender: validatedGender,
        recommendations: cardRecommendations,
        llmRecommendations,
      }),
      request_id: req.id,
    });
  } catch (error) {
    if (isSidecarUnavailable(error)) {
      req.logger?.warn("Face shape sidecar unavailable", {
        request_id: req.id,
        code: error.code,
      });
      return res.status(503).json({
        message: "AI analysis temporarily unavailable",
        request_id: req.id,
      });
    }

    if (error.response) {
      const status = error.response.status || 502;
      const detail = error.response.data?.detail || error.response.data?.message;
      return res.status(status).json({
        message: detail || "AI analysis temporarily unavailable",
        request_id: req.id,
      });
    }

    throw error;
  }
});

module.exports = router;
