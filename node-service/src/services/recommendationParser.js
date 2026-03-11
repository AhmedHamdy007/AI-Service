/**
 * Recommendation Parser
 * Transforms scraped data into consistent product format
 */

/**
 * Extract brand name from product name
 * Example: "Cantu Shea Butter Leave-In Conditioner" → "Cantu"
 */
function extractBrand(productName) {
  const brands = [
    "DevaCurl",
    "Cantu",
    "Kinky-Curly",
    "Moroccanoil",
    "OuAI",
    "Brazilian Blowout",
    "Olaplex",
    "Kérastase",
    "TRESemmé",
    "Pantene",
    "Bumble and bumble",
    "Coppola",
    "Neutrogena",
    "Allure",
    "Byrdie",
  ];

  for (const brand of brands) {
    if (productName.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }

  // Extract first 1-2 words if no known brand found
  const words = productName.split(" ");
  return words[0];
}

/**
 * Estimate price from text
 * Example: "$28.00", "about $30" → 28, 30
 */
function estimatePrice(priceText) {
  if (!priceText) return null;

  const match = priceText.match(/\$(\d+(?:\.\d{2})?)/);
  if (match) {
    return parseFloat(match[1]);
  }

  return null;
}

/**
 * Assign budget category based on price
 */
function getBudgetCategory(price) {
  if (!price) return "unknown";
  if (price < 20) return "under-20";
  if (price < 40) return "20-40";
  if (price < 60) return "40-60";
  return "60-plus";
}

/**
 * Assign credibility rating based on source
 */
function getCredibilityRating(credibilityScore) {
  if (credibilityScore >= 90) return 5;
  if (credibilityScore >= 75) return 4.5;
  if (credibilityScore >= 60) return 4;
  return 3.5;
}

/**
 * Parse scraped recommendation into consistent format
 */
function parseRecommendation(scrapedProduct) {
  const brand = extractBrand(scrapedProduct.name);
  const price = estimatePrice(scrapedProduct.price);

  return {
    id: scrapedProduct.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, ""),
    name: scrapedProduct.name,
    brand,
    price: price || null,
    priceFormatted: scrapedProduct.price || "Price not listed",
    rating: getCredibilityRating(scrapedProduct.credibilityScore),
    image: null, // Could extract from source later
    description: scrapedProduct.description || scrapedProduct.name,
    hairTypes: inferHairTypes(scrapedProduct.category),
    concerns: inferConcerns(scrapedProduct.category),
    budgetCategory: getBudgetCategory(price),
    website: extractWebsite(scrapedProduct.productUrl),
    productUrl: scrapedProduct.productUrl,
    source: scrapedProduct.source,
    sourceUrl: scrapedProduct.sourceUrl,
    credibilityScore: scrapedProduct.credibilityScore,
  };
}

/**
 * Infer hair types from category
 */
function inferHairTypes(category) {
  const categoryMap = {
    curly: ["curly", "wavy", "coily"],
    "curly-community": ["curly", "coily"],
    frizz: ["all"],
    damage: ["all"],
    volume: ["fine", "straight", "thin"],
    "general-care": ["all"],
  };

  return categoryMap[category] || ["all"];
}

/**
 * Infer concerns from category
 */
function inferConcerns(category) {
  const categoryMap = {
    curly: ["definition", "frizz"],
    "curly-community": ["definition", "frizz", "dryness"],
    frizz: ["frizz"],
    damage: ["damage", "breakage"],
    volume: ["lack-of-volume", "limp"],
    "general-care": ["dryness", "shine"],
  };

  return categoryMap[category] || ["general"];
}

/**
 * Extract website domain
 */
function extractWebsite(productUrl) {
  if (!productUrl) return "unknown";

  try {
    const url = new URL(productUrl);
    return url.hostname.replace("www.", "");
  } catch {
    return "external";
  }
}

/**
 * Sort products by relevance score
 */
function scoreProduct(product, userProfile) {
  let score = 0;

  // High credibility score boost
  if (product.credibilityScore >= 90) score += 40;
  else if (product.credibilityScore >= 75) score += 30;
  else score += 20;

  // Hair type match
  if (userProfile.hairType && product.hairTypes) {
    if (
      product.hairTypes.includes("all") ||
      product.hairTypes.includes(userProfile.hairType)
    ) {
      score += 35;
    }
  }

  // Concern match
  if (userProfile.concerns && product.concerns) {
    const matchedConcerns = userProfile.concerns.filter((c) =>
      product.concerns.includes(c)
    );
    score += matchedConcerns.length * 20;
  }

  // Budget match
  if (
    userProfile.budgetCategory &&
    product.budgetCategory === userProfile.budgetCategory
  ) {
    score += 15;
  }

  // Price preference
  if (userProfile.maxPrice && product.price && product.price <= userProfile.maxPrice) {
    score += 10;
  }

  return score;
}

/**
 * Filter and rank products
 */
function filterAndRankProducts(scrapedProducts, userProfile, limit = 6) {
  // Parse all scraped products
  const parsed = scrapedProducts.map(parseRecommendation);

  // Remove duplicates by name
  const seen = new Map();
  const unique = [];

  parsed.forEach((product) => {
    const normalizedName = product.name.toLowerCase();
    if (!seen.has(normalizedName)) {
      seen.set(normalizedName, product);
      unique.push(product);
    } else {
      // Keep the one with higher credibility
      const existing = seen.get(normalizedName);
      if (product.credibilityScore > existing.credibilityScore) {
        const idx = unique.findIndex((p) => p.name === existing.name);
        unique[idx] = product;
        seen.set(normalizedName, product);
      }
    }
  });

  // Score and rank
  const scored = unique
    .map((product) => ({
      ...product,
      matchScore: scoreProduct(product, userProfile),
    }))
    .filter((p) => p.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  return scored;
}

module.exports = {
  parseRecommendation,
  filterAndRankProducts,
  extractBrand,
  estimatePrice,
  getBudgetCategory,
  getCredibilityRating,
  scoreProduct,
};
