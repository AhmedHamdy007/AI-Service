/**
 * Recommendation Parser
 * Transforms scraped data into consistent product format
 */

/**
 * Extract brand name from product name
 * Example: "Cantu Shea Butter Leave-In Conditioner" -> "Cantu"
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
    "Kerastase",
    "TRESemme",
    "Pantene",
    "Bumble and bumble",
    "Coppola",
    "Neutrogena",
    "Allure",
    "Byrdie",
  ];

  if (!productName || typeof productName !== "string") return "Unknown";

  for (const brand of brands) {
    if (productName.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }

  const words = productName.split(" ");
  return words[0] || "Unknown";
}

/**
 * Estimate price from text
 * Example: "$28.00", "about $30" -> 28, 30
 */
function estimatePrice(priceText) {
  if (!priceText) return null;
  if (typeof priceText === "number") return priceText;

  const match = String(priceText)
    .replace(/,/g, "")
    .match(/(?:RM|MYR|£|\$|€)\s*(\d+(?:\.\d{1,2})?)/i);
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
 * Uses 0-10 scale for source credibility.
 */
function getCredibilityRating(credibilityScore) {
  if (!credibilityScore) return 3.5;
  if (credibilityScore >= 9) return 5;
  if (credibilityScore >= 8) return 4.5;
  if (credibilityScore >= 7) return 4;
  if (credibilityScore >= 6) return 3.5;
  return 3;
}

/**
 * Parse scraped recommendation into consistent format
 */
function parseRecommendation(scrapedProduct) {
  const brand = scrapedProduct.brand || extractBrand(scrapedProduct.name);
  const price = estimatePrice(scrapedProduct.price);
  const productUrl = scrapedProduct.productUrl || scrapedProduct.url || null;
  const sourceUrl = scrapedProduct.sourceUrl || scrapedProduct.pageUrl || null;
  const credibilityScore = scrapedProduct.credibilityScore || scrapedProduct.sourceCredibility;

  return {
    id: scrapedProduct.name
      ? scrapedProduct.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
      : "unknown",
    name: scrapedProduct.name || "Unknown",
    brand,
    price: price || null,
    priceFormatted: scrapedProduct.priceFormatted || scrapedProduct.price || "Price not listed",
    rating: scrapedProduct.rating || getCredibilityRating(credibilityScore),
    image: scrapedProduct.image || null,
    description: scrapedProduct.description || scrapedProduct.name || "",
    hairTypes: inferHairTypes(scrapedProduct.category),
    concerns: inferConcerns(scrapedProduct.category),
    budgetCategory: getBudgetCategory(price),
    website: extractWebsite(productUrl),
    productUrl,
    source: scrapedProduct.source || "unknown",
    sourceUrl,
    credibilityScore,
    ratingCount: scrapedProduct.ratingCount || 0,
  };
}

/**
 * Infer hair types from category
 */
function inferHairTypes(category) {
  if (!category) return ["all"];

  const categoryMap = {
    curly: ["curly", "wavy", "coily"],
    "curly-hair": ["curly", "coily"],
    frizz: ["all"],
    damage: ["all"],
    "general-care": ["all"],
    volume: ["fine", "straight", "thin"],
    general: ["all"],
    "hair-specific": ["all"],
  };

  return categoryMap[category] || ["all"];
}

/**
 * Infer concerns from category
 */
function inferConcerns(category) {
  if (!category) return ["general"];

  const categoryMap = {
    curly: ["lack-of-definition", "frizz"],
    "curly-hair": ["lack-of-definition", "frizz", "dryness"],
    frizz: ["frizz"],
    damage: ["damage", "breakage"],
    "general-care": ["dryness", "damage", "lack-of-shine"],
    volume: ["lack-of-volume", "limp"],
    general: ["general"],
    "hair-specific": ["general"],
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

  if (product.credibilityScore >= 9) score += 40;
  else if (product.credibilityScore >= 8) score += 30;
  else if (product.credibilityScore >= 7) score += 25;
  else score += 20;

  if (userProfile.hairType && product.hairTypes) {
    const hairTypes = Array.isArray(userProfile.hairType)
      ? userProfile.hairType
      : [userProfile.hairType];

    if (product.hairTypes.includes("all") || hairTypes.some((t) => product.hairTypes.includes(t))) {
      score += 35;
    }
  }

  if (userProfile.concerns && product.concerns) {
    const matchedConcerns = userProfile.concerns.filter((c) =>
      product.concerns.includes(c)
    );
    score += matchedConcerns.length * 20;
  }

  if (
    userProfile.budgetCategory &&
    product.budgetCategory === userProfile.budgetCategory
  ) {
    score += 15;
  }

  if (userProfile.maxPrice && product.price && product.price <= userProfile.maxPrice) {
    score += 10;
  }

  return score;
}

/**
 * Filter and rank products
 */
function filterAndRankProducts(scrapedProducts, userProfile, limit = 6) {
  const parsed = scrapedProducts.map(parseRecommendation);

  const seen = new Map();
  const unique = [];

  parsed.forEach((product) => {
    const normalizedName = product.name.toLowerCase();
    if (!seen.has(normalizedName)) {
      seen.set(normalizedName, product);
      unique.push(product);
    } else {
      const existing = seen.get(normalizedName);
      if (product.credibilityScore > existing.credibilityScore) {
        const idx = unique.findIndex((p) => p.name === existing.name);
        unique[idx] = product;
        seen.set(normalizedName, product);
      }
    }
  });

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
