const express = require("express");
const { searchProducts, getAvailableFilters, getCacheStats } = require("../services/productScraper");
const {
  validateProductHairType,
  validateProductConcerns,
  validateBudgetCategory,
  validateProductLimit,
  ValidationError,
} = require("../utils/validation");

const router = express.Router();

/**
 * POST /api/products/search
 * Search for hair care products based on user attributes
 *
 * Body (JSON):
 *   hairType      — optional: straight | wavy | curly | coily | fine | thick
 *   concerns      — optional: frizz | dryness | damage | etc.
 *   budgetCategory — optional: under-20 | 20-40 | 40-60 | 60-plus
 *   limit         — optional: number (default 6, max 50)
 *
 * Microsoft best practice: validate all user inputs
 */
router.post("/search", async (req, res) => {
  try {
    const { hairType, concerns, budgetCategory, limit } = req.body;

    // Validate inputs
    const validatedHairType = validateProductHairType(hairType);
    const validatedConcerns = validateProductConcerns(concerns);
    const validatedBudget = validateBudgetCategory(budgetCategory);
    const validatedLimit = validateProductLimit(limit);

    req.logger.debug("Product search request", {
      request_id: req.id,
      hairType: validatedHairType,
      concerns: validatedConcerns,
      budget: validatedBudget,
      limit: validatedLimit,
    });

    // Search products
    const result = await searchProducts({
      hairType: validatedHairType,
      concerns: validatedConcerns,
      budgetCategory: validatedBudget,
      limit: validatedLimit,
    });

    req.logger.info("Product search completed", {
      request_id: req.id,
      productCount: result.products.length,
      source: result.source,
      cached: result.cached,
    });

    res.json({
      success: true,
      data: result.products,
      count: result.products.length,
      source: result.source,
      cached: result.cached,
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

/**
 * GET /api/products/filters
 * Get available filter options for UI dropdowns
 *
 * Returns:
 *   hairTypes: available hair type options
 *   concerns: available concern options
 *   budgetCategories: available budget categories
 */
router.get("/filters", async (req, res) => {
  try {
    req.logger.debug("Fetching filter options", {
      request_id: req.id,
    });

    const filters = await getAvailableFilters();

    req.logger.info("Filter options fetched", {
      request_id: req.id,
      filterCount: Object.keys(filters).length,
    });

    res.json({
      success: true,
      data: filters,
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

/**
 * GET /api/products/stats
 * Get cache statistics (for monitoring/debugging)
 *
 * Admin only endpoint
 */
router.get("/stats", (req, res) => {
  try {
    const stats = getCacheStats();

    req.logger.debug("Cache stats requested", {
      request_id: req.id,
      ...stats,
    });

    res.json({
      success: true,
      data: stats,
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

/**
 * POST /api/products/search/advanced
 * Advanced product search with multiple filters
 *
 * Body (JSON):
 *   hairType      — optional: string or array
 *   concerns      — optional: string or array
 *   budgetCategory — optional: string
 *   minRating     — optional: number (0-5)
 *   maxPrice      — optional: number
 *   limit         — optional: number
 *   sortBy        — optional: rating | price | brand
 *
 * Returns: ranked products based on filters
 */
router.post("/search/advanced", async (req, res) => {
  try {
    const {
      hairType,
      concerns,
      budgetCategory,
      minRating,
      maxPrice,
      limit,
      sortBy = "rating",
    } = req.body;

    // Validate inputs
    const validatedHairType = validateProductHairType(hairType);
    const validatedConcerns = validateProductConcerns(concerns);
    const validatedBudget = validateBudgetCategory(budgetCategory);
    const validatedLimit = validateProductLimit(limit);

    // Validate additional filters
    if (minRating !== undefined) {
      if (typeof minRating !== "number" || minRating < 0 || minRating > 5) {
        throw new ValidationError(
          "minRating must be a number between 0 and 5",
          "minRating"
        );
      }
    }

    if (maxPrice !== undefined) {
      if (typeof maxPrice !== "number" || maxPrice < 0) {
        throw new ValidationError("maxPrice must be a positive number", "maxPrice");
      }
    }

    if (!["rating", "price", "brand"].includes(sortBy)) {
      throw new ValidationError(
        "sortBy must be one of: rating, price, brand",
        "sortBy"
      );
    }

    req.logger.debug("Advanced product search request", {
      request_id: req.id,
      hairType: validatedHairType,
      concerns: validatedConcerns,
      budget: validatedBudget,
      minRating,
      maxPrice,
      sortBy,
    });

    // Search products
    let result = await searchProducts({
      hairType: validatedHairType,
      concerns: validatedConcerns,
      budgetCategory: validatedBudget,
      limit: validatedLimit * 2, // Get more for filtering
    });

    // Apply additional filters
    let products = result.products;

    if (minRating) {
      products = products.filter((p) => p.rating >= minRating);
    }

    if (maxPrice) {
      products = products.filter((p) => p.price <= maxPrice);
    }

    // Sort
    if (sortBy === "rating") {
      products.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "price") {
      products.sort((a, b) => a.price - b.price);
    } else if (sortBy === "brand") {
      products.sort((a, b) => a.brand.localeCompare(b.brand));
    }

    // Apply limit
    products = products.slice(0, validatedLimit);

    req.logger.info("Advanced product search completed", {
      request_id: req.id,
      productCount: products.length,
    });

    res.json({
      success: true,
      data: products,
      count: products.length,
      filters: {
        hairType: validatedHairType,
        concerns: validatedConcerns,
        budgetCategory: validatedBudget,
        minRating,
        maxPrice,
        sortBy,
      },
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

module.exports = router;
