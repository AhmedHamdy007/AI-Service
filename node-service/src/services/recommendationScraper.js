/**
 * Recommendation Scraper
 * Fetches product recommendations from trusted beauty websites
 * Uses JSON-LD structured data (no heavy dependencies needed)
 */

const axios = require("axios");

// Recommendation sources with their URLs and credibility scores
const RECOMMENDATION_SOURCES = [
  {
    name: "Allure",
    baseUrl: "https://www.allure.com",
    credibilityScore: 9,
    category: "general",
    description: "Beauty expert recommendations",
  },
  {
    name: "Byrdie",
    baseUrl: "https://www.byrdie.com",
    credibilityScore: 8,
    category: "general",
    description: "Hair and beauty guides",
  },
  {
    name: "StyleCraze",
    baseUrl: "https://www.stylecraze.com",
    credibilityScore: 7,
    category: "hair-specific",
    description: "Hair care recommendations",
  },
  {
    name: "NaturalHair",
    baseUrl: "https://www.naturalhair.com",
    credibilityScore: 8,
    category: "curly-hair",
    description: "Natural and curly hair products",
  },
];

// Cache for scraped recommendations (24 hour TTL)
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
 * Extract JSON-LD structured data from HTML
 * Most modern websites embed product recommendations this way
 */
function extractJsonLd(html) {
  try {
    const jsonLdRegex = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
    const matches = html.matchAll(jsonLdRegex);
    const results = [];

    for (const match of matches) {
      try {
        const jsonData = JSON.parse(match[1]);
        results.push(jsonData);
      } catch (e) {
        // Skip malformed JSON-LD
        continue;
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}

/**
 * Parse product data from JSON-LD
 * Handles multiple JSON-LD schema types (Product, BreadcrumbList, etc.)
 */
function parseProductsFromJsonLd(jsonLdArray) {
  const products = [];

  jsonLdArray.forEach((item) => {
    // Handle Product schema
    if (item["@type"] === "Product") {
      products.push({
        name: item.name,
        brand: item.brand?.name || item.brand || "Unknown",
        price: item.offers?.[0]?.price || item.offers?.price || null,
        currency: item.offers?.[0]?.priceCurrency || item.offers?.priceCurrency || "USD",
        rating: item.aggregateRating?.ratingValue || null,
        ratingCount: item.aggregateRating?.ratingCount || 0,
        description: item.description,
        image: item.image?.[0] || item.image,
        url: item.url,
        sku: item.sku,
      });
    }

    // Handle Collection of Products
    if (item["@type"] === "Collection" && item.hasPart) {
      item.hasPart.forEach((product) => {
        if (product["@type"] === "Product") {
          products.push({
            name: product.name,
            brand: product.brand?.name || product.brand || "Unknown",
            price: product.offers?.[0]?.price || product.offers?.price || null,
            currency: product.offers?.[0]?.priceCurrency || product.offers?.priceCurrency || "USD",
            rating: product.aggregateRating?.ratingValue || null,
            ratingCount: product.aggregateRating?.ratingCount || 0,
            description: product.description,
            image: product.image?.[0] || product.image,
            url: product.url,
            sku: product.sku,
          });
        }
      });
    }

    // Handle ItemList (common for product lists)
    if (item["@type"] === "ItemList" && item.itemListElement) {
      item.itemListElement.forEach((element) => {
        if (element.item && element.item["@type"] === "Product") {
          const product = element.item;
          products.push({
            name: product.name,
            brand: product.brand?.name || product.brand || "Unknown",
            price: product.offers?.[0]?.price || product.offers?.price || null,
            currency: product.offers?.[0]?.priceCurrency || product.offers?.priceCurrency || "USD",
            rating: product.aggregateRating?.ratingValue || null,
            ratingCount: product.aggregateRating?.ratingCount || 0,
            description: product.description,
            image: product.image?.[0] || product.image,
            url: product.url,
            sku: product.sku,
          });
        }
      });
    }
  });

  return products;
}

/**
 * Fetch recommendations from a single source
 */
async function fetchFromSource(source, searchQuery) {
  try {
    const cacheKey = `recommendation:${source.name}:${searchQuery}`;
    const cached = getCached(cacheKey);

    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }

    // Construct search URL
    const searchUrl = `${source.baseUrl}/search?q=${encodeURIComponent(searchQuery)}`;

    // Fetch page with timeout
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Extract JSON-LD structured data
    const jsonLdArray = extractJsonLd(response.data);

    // Parse products from JSON-LD
    const products = parseProductsFromJsonLd(jsonLdArray);

    const result = {
      source: source.name,
      credibilityScore: source.credibilityScore,
      products: products.slice(0, 10), // Limit to 10 per source
      productCount: products.length,
      scraped: new Date().toISOString(),
    };

    // Cache the results (24 hours)
    setCache(cacheKey, result);

    return {
      ...result,
      cached: false,
    };
  } catch (error) {
    return {
      source: source.name,
      error: error.message,
      products: [],
      cached: false,
    };
  }
}

/**
 * Search recommendations across all sources
 */
async function searchRecommendations(hairType, concerns) {
  if (!hairType) {
    throw new Error("hairType is required");
  }

  // Build search query
  const concernList = Array.isArray(concerns)
    ? concerns.join(" ")
    : concerns || "";
  const searchQuery = `${hairType} hair ${concernList} products`;

  // Cache key for combined results
  const cacheKey = `recommendation:all:${searchQuery}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  // Fetch from multiple sources in parallel
  const promises = RECOMMENDATION_SOURCES.map((source) =>
    fetchFromSource(source, searchQuery).catch((err) => ({
      source: source.name,
      error: err.message,
      products: [],
    }))
  );

  const results = await Promise.all(promises);

  // Combine and rank by credibility
  let allProducts = [];
  const sourcesData = {};

  results.forEach((result) => {
    sourcesData[result.source] = {
      credibilityScore: result.credibilityScore,
      count: result.products.length,
      cached: result.cached,
      error: result.error,
    };

    result.products.forEach((product) => {
      allProducts.push({
        ...product,
        source: result.source,
        sourceCredibility: result.credibilityScore,
      });
    });
  });

  // Remove duplicates (same product name from different sources)
  const seen = new Set();
  allProducts = allProducts.filter((p) => {
    const key = `${p.brand}_${p.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by:
  // 1. Source credibility (higher is better)
  // 2. Rating (higher is better)
  // 3. Rating count (more reviews is better)
  allProducts.sort((a, b) => {
    if (b.sourceCredibility !== a.sourceCredibility) {
      return b.sourceCredibility - a.sourceCredibility;
    }
    if ((b.rating || 0) !== (a.rating || 0)) {
      return (b.rating || 0) - (a.rating || 0);
    }
    return (b.ratingCount || 0) - (a.ratingCount || 0);
  });

  const finalResult = {
    query: searchQuery,
    hairType,
    concerns: Array.isArray(concerns) ? concerns : [concerns],
    products: allProducts.slice(0, 20), // Top 20 products
    totalFound: allProducts.length,
    sources: sourcesData,
    scraped: new Date().toISOString(),
  };

  // Cache results (24 hours)
  setCache(cacheKey, finalResult);

  return {
    ...finalResult,
    cached: false,
  };
}

/**
 * Get available recommendation sources
 */
function getSources() {
  return RECOMMENDATION_SOURCES.map((s) => ({
    name: s.name,
    baseUrl: s.baseUrl,
    credibilityScore: s.credibilityScore,
    category: s.category,
    description: s.description,
  }));
}

/**
 * Clear cache (for testing or manual refresh)
 */
function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    size: cache.size,
    items: Array.from(cache.keys()),
  };
}

module.exports = {
  searchRecommendations,
  getSources,
  clearCache,
  getCacheStats,
  extractJsonLd,
  parseProductsFromJsonLd,
};
