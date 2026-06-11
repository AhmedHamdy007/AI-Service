const {
  MALE_HAIRCUTS,
  FEMALE_HAIRCUTS,
  getRecommendations: getHaircutRecommendations,
} = require("../data/haircutData");

const ALL_HAIRCUTS = [...MALE_HAIRCUTS, ...FEMALE_HAIRCUTS];

function toTitleCase(value) {
  const text = String(value || "");
  return text.slice(0, 1).toUpperCase() + text.slice(1).toLowerCase();
}

function toLegacyRecommendation(cut, matchScore = 100) {
  return {
    ...cut,
    gender: [cut.gender],
    suitableFaceShapes: cut.faceShapes.map(toTitleCase),
    hairTypes: [],
    lifestyles: [],
    description: cut.why,
    matchScore,
    matchPercent: Math.min(100, matchScore),
  };
}

/**
 * Main recommendation function.
 * Returns top N hairstyles from the shared haircut knowledge base.
 */
function getRecommendations({ faceShape, gender, limit = 5 }) {
  if (!faceShape) {
    throw new Error("faceShape is required");
  }

  const normalizedGender = gender === "male" ? "male" : "female";
  return getHaircutRecommendations(faceShape, normalizedGender, limit)
    .map((cut, index) => toLegacyRecommendation(cut, 100 - index * 6));
}

/**
 * Get a single hairstyle by ID.
 */
function getHairstyleById(id) {
  const cut = ALL_HAIRCUTS.find((s) => s.id === id);
  return cut ? toLegacyRecommendation(cut) : null;
}

/**
 * Get all hairstyles with optional filters.
 */
function getAllHairstyles({ gender, faceShape } = {}) {
  return ALL_HAIRCUTS.filter((cut) => {
    if (gender && cut.gender !== gender.toLowerCase()) return false;
    if (faceShape && !cut.faceShapes.includes(faceShape.toLowerCase())) return false;
    return true;
  }).map((cut) => toLegacyRecommendation(cut));
}

module.exports = { getRecommendations, getHairstyleById, getAllHairstyles };
