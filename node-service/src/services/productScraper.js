/**
 * Product Scraper/Fetcher Service
 * Scrapes product recommendations from trusted beauty websites
 * Uses recommendation websites instead of e-commerce sites
 * Provides expert-curated recommendations
 */

const axios = require("axios");

const config = require("../config");

const { filterAndRankProducts } = require("./recommendationParser");

const http = axios.create({
  baseURL: config.pythonSidecarUrl,
  timeout: config.requestTimeout,
});

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes for parsed results

/**
 * Get cached data or null if expired
 */
function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

/**
 * Set cache with TTL
 */
function setCache(key, data) {
  cache.set(key, {
    data,
    expiry: Date.now() + CACHE_TTL,
  });
}

function normalizeKeyPart(value) {
  if (!value) return "all";
  if (Array.isArray(value)) return value.join("|");
  return String(value);
}

/**
 * Generate cache key from search params
 */
function getCacheKey(hairType, concerns, budgetCategory) {
  return `products:${normalizeKeyPart(hairType)}:${normalizeKeyPart(concerns)}:${normalizeKeyPart(budgetCategory)}`;
}

/**
 * Main search function
 * Scrapes recommendations from trusted beauty websites
 * Returns expert-curated products
 */
async function searchProducts({ hairType, concerns, budgetCategory, limit = 6 }) {
  const cacheKey = getCacheKey(hairType, concerns, budgetCategory);

  const cached = getCached(cacheKey);
  if (cached) {
    return {
      products: cached,
      cached: true,
      source: "expert-recommendations",
    };
  }

  try {
    let scrapedProducts = [];

    const response = await http.post("/products/recommendations", {
      hairType,
      concerns,
      limit: Math.max(limit * 3, 20),
    });

    scrapedProducts = response.data?.data || [];

    const userProfile = {
      hairType,
      concerns: Array.isArray(concerns) ? concerns : concerns ? [concerns] : [],
      budgetCategory,
    };

    const products = filterAndRankProducts(scrapedProducts, userProfile, limit);

    setCache(cacheKey, products);

    return {
      products,
      cached: false,
      source: "expert-recommendations",
      recommendationCount: scrapedProducts.length,
    };
  } catch (error) {
    throw new Error(`Product search failed: ${error.message}`);
  }
}

/**
 * Get filter options for UI dropdowns
 */
async function getAvailableFilters() {
  const cacheKey = "filter-options";

  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const options = {
      hairTypes: ["straight", "wavy", "curly", "coily", "fine", "thick"],
      concerns: [
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
      ],
      budgetCategories: ["under-20", "20-40", "40-60", "60-plus"],
    };

    setCache(cacheKey, options);
    return options;
  } catch (error) {
    throw new Error(`Failed to get filter options: ${error.message}`);
  }
}

/**
 * Get cache stats (for monitoring)
 */
function getCacheStats() {
  return {
    parsedResults: cache.size,
    cachedKeys: Array.from(cache.keys()),
    sourceCacheStats: null,
  };
}

module.exports = {
  searchProducts,
  getAvailableFilters,
  getCacheStats,
  getCached,
  setCache,
};
