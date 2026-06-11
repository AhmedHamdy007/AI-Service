/**
 * Input validation utilities.
 * Validate and sanitize all inputs.
 */

const VALID_FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond", "Oblong"];
const VALID_HAIR_TYPES = ["Straight", "Wavy", "Curly", "Coily"];
const VALID_GENDERS = ["male", "female"];
const VALID_LIFESTYLES = ["Professional", "Casual", "Trendy"];
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Product-specific constants
const VALID_PRODUCT_HAIR_TYPES = ["straight", "wavy", "curly", "coily", "fine", "thick"];
const VALID_PRODUCT_CONCERNS = [
  "frizz",
  "dryness",
  "damage",
  "lack-of-volume",
  "oily-scalp",
  "dandruff",
  "lack-of-shine",
  "breakage",
  "tangled",
  "limp",
  "lack-of-definition",
];
const VALID_BUDGET_CATEGORIES = ["under-20", "20-40", "40-60", "60-plus"];

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function _unique(arr) {
  return Array.from(new Set(arr));
}

/**
 * Validate face shape string (required).
 */
function validateFaceShape(shape) {
  if (!shape || typeof shape !== "string") {
    throw new ValidationError("faceShape is required and must be a string", "faceShape");
  }

  if (!VALID_FACE_SHAPES.includes(shape)) {
    throw new ValidationError(
      `Invalid faceShape. Must be one of: ${VALID_FACE_SHAPES.join(", ")}`,
      "faceShape"
    );
  }

  return shape;
}

/**
 * Validate optional hair type.
 */
function validateHairType(type) {
  if (!type) return null;

  if (typeof type !== "string") {
    throw new ValidationError("hairType must be a string", "hairType");
  }

  if (!VALID_HAIR_TYPES.includes(type)) {
    throw new ValidationError(
      `Invalid hairType. Must be one of: ${VALID_HAIR_TYPES.join(", ")}`,
      "hairType"
    );
  }

  return type;
}

/**
 * Validate optional gender.
 */
function validateGender(gender) {
  if (!gender) return null;

  if (typeof gender !== "string") {
    throw new ValidationError("gender must be a string", "gender");
  }

  const normalized = gender.toLowerCase();
  if (!VALID_GENDERS.includes(normalized)) {
    throw new ValidationError(
      `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`,
      "gender"
    );
  }

  return normalized;
}

/**
 * Validate optional lifestyle.
 */
function validateLifestyle(lifestyle) {
  if (!lifestyle) return null;

  if (typeof lifestyle !== "string") {
    throw new ValidationError("lifestyle must be a string", "lifestyle");
  }

  if (!VALID_LIFESTYLES.includes(lifestyle)) {
    throw new ValidationError(
      `Invalid lifestyle. Must be one of: ${VALID_LIFESTYLES.join(", ")}`,
      "lifestyle"
    );
  }

  return lifestyle;
}

/**
 * Validate a (mostly optional) user profile object.
 * Returns a normalized profile containing only recognized fields.
 */
function validateUserProfile(profile) {
  if (!profile) return {};
  if (typeof profile !== "object" || Array.isArray(profile)) {
    throw new ValidationError("userProfile must be an object", "userProfile");
  }

  const validated = {};

  if (profile.faceShape) validated.faceShape = validateFaceShape(profile.faceShape);

  const hairType = validateHairType(profile.hairType);
  if (hairType) validated.hairType = hairType;

  const gender = validateGender(profile.gender);
  if (gender) validated.gender = gender;

  const lifestyle = validateLifestyle(profile.lifestyle);
  if (lifestyle) validated.lifestyle = lifestyle;

  return validated;
}

/**
 * Validate image file.
 */
function validateImageFile(file) {
  if (!file) {
    throw new ValidationError("Image file is required", "file");
  }

  if (!VALID_IMAGE_TYPES.includes(file.mimetype)) {
    throw new ValidationError(
      `Invalid image type. Must be one of: ${VALID_IMAGE_TYPES.join(", ")}`,
      "file"
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new ValidationError("File size exceeds 5MB limit", "file");
  }

  return file;
}

/**
 * Validate chat message.
 */
function validateChatMessage(message) {
  if (!message || typeof message !== "string") {
    throw new ValidationError("message is required and must be a string", "message");
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("message cannot be empty", "message");
  }

  if (trimmed.length > 5000) {
    throw new ValidationError("message cannot exceed 5000 characters", "message");
  }

  return trimmed;
}

/**
 * Validate chat history format.
 */
function validateChatHistory(history) {
  if (!history) return [];

  if (!Array.isArray(history)) {
    throw new ValidationError("history must be an array", "history");
  }

  if (history.length > 50) {
    throw new ValidationError("history cannot exceed 50 messages", "history");
  }

  history.forEach((msg, idx) => {
    if (!msg.role || !msg.content) {
      throw new ValidationError(
        `history[${idx}] must have 'role' and 'content' fields`,
        "history"
      );
    }
  });

  return history;
}

/**
 * Product Search Validators
 */

/**
 * Validate hair type(s) for product search.
 * Accepts a string or array of strings.
 */
function validateProductHairType(hairType) {
  if (!hairType) return null;

  const list = Array.isArray(hairType) ? hairType : [hairType];

  list.forEach((t) => {
    if (typeof t !== "string") {
      throw new ValidationError("hairType must be a string", "hairType");
    }
  });

  const normalized = list.map((t) => t.toLowerCase());
  const invalid = normalized.filter((t) => !VALID_PRODUCT_HAIR_TYPES.includes(t));

  if (invalid.length > 0) {
    throw new ValidationError(
      `Invalid hairType: ${invalid.join(", ")}. Must be one of: ${VALID_PRODUCT_HAIR_TYPES.join(", ")}`,
      "hairType"
    );
  }

  return _unique(normalized);
}

/**
 * Validate concern(s) for product search.
 */
function validateProductConcerns(concerns) {
  if (!concerns) return null;

  const concernArray = Array.isArray(concerns) ? concerns : [concerns];

  concernArray.forEach((c) => {
    if (typeof c !== "string") {
      throw new ValidationError("concerns must be a string or array of strings", "concerns");
    }
  });

  const normalized = concernArray.map((c) => c.toLowerCase());
  const invalid = normalized.filter((c) => !VALID_PRODUCT_CONCERNS.includes(c));

  if (invalid.length > 0) {
    throw new ValidationError(
      `Invalid concerns: ${invalid.join(", ")}. Must be one of: ${VALID_PRODUCT_CONCERNS.join(", ")}`,
      "concerns"
    );
  }

  return _unique(normalized);
}

/**
 * Validate budget category.
 */
function validateBudgetCategory(budget) {
  if (!budget) return null;

  if (typeof budget !== "string") {
    throw new ValidationError("budget must be a string", "budget");
  }

  if (!VALID_BUDGET_CATEGORIES.includes(budget)) {
    throw new ValidationError(
      `Invalid budget. Must be one of: ${VALID_BUDGET_CATEGORIES.join(", ")}`,
      "budget"
    );
  }

  return budget;
}

/**
 * Validate product limit parameter.
 */
function validateProductLimit(limit) {
  if (!limit) return 6; // default

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ValidationError("limit must be an integer between 1 and 50", "limit");
  }

  return limit;
}

module.exports = {
  ValidationError,
  validateFaceShape,
  validateHairType,
  validateGender,
  validateLifestyle,
  validateUserProfile,
  validateImageFile,
  validateChatMessage,
  validateChatHistory,
  validateProductHairType,
  validateProductConcerns,
  validateBudgetCategory,
  validateProductLimit,
  VALID_FACE_SHAPES,
  VALID_HAIR_TYPES,
  VALID_GENDERS,
  VALID_LIFESTYLES,
  VALID_PRODUCT_HAIR_TYPES,
  VALID_PRODUCT_CONCERNS,
  VALID_BUDGET_CATEGORIES,
};
