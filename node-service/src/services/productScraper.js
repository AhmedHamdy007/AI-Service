/**
 * Product Scraper/Fetcher Service
 * Scrapes product recommendations from trusted beauty websites
 * Uses recommendation websites instead of e-commerce sites
 * Provides expert-curated recommendations
 */

const {
  scrapeByHairType,
  scrapeByConcern,
  scrapeAll,
  getCacheStats: getSourceCacheStats,
  clearCache: clearSourceCache,
} = require("./recommendationScraper");

const {
  filterAndRankProducts,
  parseRecommendation,
} = require("./recommendationParser");

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours for parsed results

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

/**
 * Generate cache key from search params
 */
function getCacheKey(hairType, concerns, budgetCategory) {
  return `products:${hairType}:${concerns}:${budgetCategory}`;
}

/**
 * Main search function
 * Scrapes recommendations from trusted beauty websites
 * Returns expert-curated products
 */
async function searchProducts({ hairType, concerns, budgetCategory, limit = 6 }) {
  const cacheKey = getCacheKey(hairType, concerns, budgetCategory);

  // Check cache first
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

    // Scrape by hair type if provided
    if (hairType) {
      const hairTypeResults = await scrapeByHairType(hairType);
      scrapedProducts = scrapedProducts.concat(hairTypeResults);
    }

    // Scrape by concern if provided
    if (concerns) {
      const concernArray = Array.isArray(concerns) ? concerns : [concerns];
      for (const concern of concernArray) {
        const concernResults = await scrapeByConcern(concern);
        scrapedProducts = scrapedProducts.concat(concernResults);
      }
    }

    // If no specific filters, scrape all sources
    if (!hairType && !concerns) {
      const allResults = await scrapeAll();
      allResults.forEach((result) => {
        scrapedProducts = scrapedProducts.concat(result.products);
      });
    }

    // Filter, rank, and format products
    const userProfile = {
      hairType,
      concerns: Array.isArray(concerns) ? concerns : concerns ? [concerns] : [],
      budgetCategory,
    };

    const products = filterAndRankProducts(scrapedProducts, userProfile, limit);

    // Cache the results
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
        "definition",
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
 * Clear cache (for testing or manual refresh)
 */
function clearCache() {
  cache.clear();
  clearSourceCache();
}

/**
 * Get cache stats (for monitoring)
 */
function getCacheStats() {
  return {
    parsedResults: cache.size,
    cachedKeys: Array.from(cache.keys()),
    sourceCacheStats: getSourceCacheStats(),
  };
}

module.exports = {
  searchProducts,
  getAvailableFilters,
  clearCache,
  getCacheStats,
  // Exportable for advanced usage
  getCached,
  setCache,
};

/**
 * Example: Integration point for RapidAPI
 * Uncomment and configure to use real API
 */
async function searchProductsViaRapidAPI({ hairType, concerns, budgetCategory, limit }) {
  // const options = {
  //   method: 'GET',
  //   url: 'https://api.rapidapi.com/beauty/products',
  //   params: {
  //     hairType: hairType,
  //     concern: concerns,
  //     maxPrice: budgetCategory,
  //     limit: limit
  //   },
  //   headers: {
  //     'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
  //     'X-RapidAPI-Host': 'api.rapidapi.com'
  //   }
  // };
  //
  // try {
  //   const response = await axios.request(options);
  //   return response.data;
  // } catch (error) {
  //   console.error('RapidAPI error:', error);
  //   throw error;
  // }
}

/**
 * Example: Integration point for Amazon PA-API
 * Requires AWS credentials
 */
async function searchProductsViaAmazonAPI({ hairType, concerns, limit }) {
  // Implementation would require:
  // - AWS credentials
  // - amazon-paapi package
  // - Product Advertising API subscription
  //
  // Example structure:
  // const results = await searchAmazonProducts({
  //   keywords: `${hairType} hair ${concerns}`,
  //   index: 'Beauty',
  //   itemCount: limit
  // });
}

module.exports = {
  searchProducts,
  getAvailableFilters,
  clearCache,
  getCacheStats,
  // Exportable for advanced usage
  getCached,
  setCache,
};
