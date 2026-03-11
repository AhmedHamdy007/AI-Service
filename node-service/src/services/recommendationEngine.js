const HAIRSTYLES = require("./hairstyleKnowledge");

/**
 * Score a hairstyle against user attributes.
 * Returns a 0-100 score.
 */
function scoreHairstyle(hairstyle, { faceShape, hairType, gender, lifestyle }) {
  let score = 0;

  // Face shape match — most important factor (40 pts)
  if (hairstyle.suitableFaceShapes.includes(faceShape)) {
    score += 40;
  } else {
    // Partial credit for adjacent shapes
    const adjacentShapes = getAdjacentShapes(faceShape);
    const hasAdjacent = hairstyle.suitableFaceShapes.some((s) =>
      adjacentShapes.includes(s)
    );
    if (hasAdjacent) score += 15;
  }

  // Hair type match (25 pts)
  if (hairType && hairstyle.hairTypes.includes(hairType)) {
    score += 25;
  }

  // Gender match (20 pts)
  if (gender && hairstyle.gender.includes(gender.toLowerCase())) {
    score += 20;
  }

  // Lifestyle match (15 pts)
  if (lifestyle && hairstyle.lifestyles.includes(lifestyle)) {
    score += 15;
  }

  return score;
}

/**
 * Face shapes that are "similar" — used for partial scoring
 */
function getAdjacentShapes(shape) {
  const adjacency = {
    Oval:    ["Heart", "Oblong"],
    Round:   ["Square", "Oval"],
    Square:  ["Round", "Oblong", "Diamond"],
    Heart:   ["Oval", "Diamond"],
    Diamond: ["Heart", "Square"],
    Oblong:  ["Oval", "Square"],
  };
  return adjacency[shape] || [];
}

/**
 * Main recommendation function.
 * Returns top N hairstyles sorted by score.
 */
function getRecommendations({ faceShape, hairType, gender, lifestyle, limit = 5 }) {
  if (!faceShape) {
    throw new Error("faceShape is required");
  }

  const scored = HAIRSTYLES.map((style) => ({
    ...style,
    score: scoreHairstyle(style, { faceShape, hairType, gender, lifestyle }),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // If we couldn't fill the list, pad with face-shape-only matches
  if (scored.length < limit) {
    const ids   = new Set(scored.map((s) => s.id));
    const extra = HAIRSTYLES.filter(
      (s) =>
        !ids.has(s.id) &&
        s.suitableFaceShapes.includes(faceShape)
    ).slice(0, limit - scored.length);

    extra.forEach((s) =>
      scored.push({ ...s, score: 10 })
    );
  }

  return scored.map(({ score, ...style }) => ({
    ...style,
    matchScore: score,
    matchPercent: Math.min(100, score),
  }));
}

/**
 * Get a single hairstyle by ID
 */
function getHairstyleById(id) {
  return HAIRSTYLES.find((s) => s.id === id) || null;
}

/**
 * Get all hairstyles (with optional filter)
 */
function getAllHairstyles({ gender, faceShape, hairType } = {}) {
  return HAIRSTYLES.filter((s) => {
    if (gender    && !s.gender.includes(gender.toLowerCase()))          return false;
    if (faceShape && !s.suitableFaceShapes.includes(faceShape))         return false;
    if (hairType  && !s.hairTypes.includes(hairType))                   return false;
    return true;
  });
}

module.exports = { getRecommendations, getHairstyleById, getAllHairstyles };
