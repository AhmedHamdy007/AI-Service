const express = require("express");
const {
  getRecommendations,
  getHairstyleById,
  getAllHairstyles,
} = require("../services/recommendationEngine");
const {
  validateFaceShape,
  validateHairType,
  validateGender,
  validateLifestyle,
  ValidationError,
} = require("../utils/validation");

const router = express.Router();

/**
 * POST /api/recommendations
 * Get hairstyle recommendations based on user attributes.
 *
 * Body (JSON):
 *   faceShape  — required: Oval | Round | Square | Heart | Diamond | Oblong
 *   hairType   — optional: Straight | Wavy | Curly | Coily
 *   gender     — optional: male | female
 *   lifestyle  — optional: Professional | Casual | Trendy
 *   limit      — optional: number (default 5, max 50)
 *
 * Microsoft best practice: validate and sanitize all inputs
 */
router.post("/", (req, res) => {
  try {
    const { faceShape, hairType, gender, lifestyle, limit } = req.body;

    // Validate required field
    const validatedFaceShape = validateFaceShape(faceShape);

    // Validate optional fields
    const validatedHairType = validateHairType(hairType);
    const validatedGender = validateGender(gender);
    const validatedLifestyle = validateLifestyle(lifestyle);

    // Validate limit
    let limitVal = 5;
    if (limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new ValidationError(
          "limit must be an integer between 1 and 50",
          "limit"
        );
      }
      limitVal = limit;
    }

    const recommendations = getRecommendations({
      faceShape: validatedFaceShape,
      hairType: validatedHairType,
      gender: validatedGender,
      lifestyle: validatedLifestyle,
      limit: limitVal,
    });

    req.logger.info("Recommendations generated", {
      request_id: req.id,
      faceShape: validatedFaceShape,
      count: recommendations.length,
    });

    res.json({
      success: true,
      input: {
        faceShape: validatedFaceShape,
        hairType: validatedHairType,
        gender: validatedGender,
        lifestyle: validatedLifestyle,
      },
      count: recommendations.length,
      data: recommendations,
      request_id: req.id,
    });
  } catch (err) {
    throw err; // Let error handler catch it
  }
});

/**
 * GET /api/recommendations/hairstyles
 * List all hairstyles with optional filters.
 *
 * Query params: gender, faceShape, hairType
 */
router.get("/hairstyles", (req, res) => {
  try {
    const { gender, faceShape, hairType } = req.query;

    // Validate optional filters
    const validatedGender = validateGender(gender);
    const validatedFaceShape = faceShape ? validateFaceShape(faceShape) : null;
    const validatedHairType = validateHairType(hairType);

    const hairstyles = getAllHairstyles({
      gender: validatedGender,
      faceShape: validatedFaceShape,
      hairType: validatedHairType,
    });

    req.logger.debug("Hairstyles retrieved", {
      request_id: req.id,
      count: hairstyles.length,
    });

    res.json({
      success: true,
      count: hairstyles.length,
      data: hairstyles,
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

/**
 * GET /api/recommendations/hairstyles/:id
 * Get a single hairstyle by ID.
 */
router.get("/hairstyles/:id", (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new ValidationError("Invalid hairstyle ID", "id");
    }

    const hairstyle = getHairstyleById(id.trim());

    if (!hairstyle) {
      return res.status(404).json({
        success: false,
        error: "Hairstyle not found",
        request_id: req.id,
      });
    }

    res.json({
      success: true,
      data: hairstyle,
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

module.exports = router;
