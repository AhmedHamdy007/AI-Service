/**
 * Product Knowledge Base
 * Curated list of hair care products with metadata
 * Maps hair types, concerns, and budget ranges
 */

const PRODUCTS = [
  // ── CURLY & WAVY ────────────────────────────────────────────────────────
  {
    id: "devacurl-cream",
    name: "SuperCream Coconut Curl Styler",
    brand: "DevaCurl",
    price: 28,
    priceFormatted: "$28.00",
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&h=300&fit=crop",
    description: "Lightweight curl-defining cream that eliminates frizz and enhances natural curl pattern",
    hairTypes: ["curly", "wavy", "coily"],
    concerns: ["frizz", "dryness", "definition"],
    budgetCategory: "20-40",
    website: "amazon.com",
    productUrl: "https://amazon.com/DevaCurl",
    rating_count: 2341,
  },
  {
    id: "cantu-shea-butter",
    name: "Shea Butter Leave-In Conditioner",
    brand: "Cantu",
    price: 7,
    priceFormatted: "$7.00",
    rating: 4.4,
    image: "https://images.unsplash.com/photo-1596450492317-c76a6b99f0f1?w=300&h=300&fit=crop",
    description: "Affordable, nourishing leave-in conditioner ideal for dry curls",
    hairTypes: ["curly", "coily", "wavy"],
    concerns: ["dryness", "damage", "lack-of-definition"],
    budgetCategory: "under-20",
    website: "target.com",
    productUrl: "https://target.com/cantu",
    rating_count: 5234,
  },
  {
    id: "kinky-curly-knot-today",
    name: "Knot Today Detangler",
    brand: "Kinky-Curly",
    price: 21,
    priceFormatted: "$21.00",
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1596450492317-c76a6b99f0f1?w=300&h=300&fit=crop",
    description: "Slip-free detangler that defines curls without flakiness",
    hairTypes: ["curly", "coily", "wavy"],
    concerns: ["tangles", "dryness", "definition"],
    budgetCategory: "20-40",
    website: "amazon.com",
    productUrl: "https://amazon.com/kinky-curly",
    rating_count: 1823,
  },

  // ── FRIZZ & SMOOTHING ────────────────────────────────────────────────────
  {
    id: "moroccanoil-treatment",
    name: "Moroccanoil Treatment Original",
    brand: "Moroccanoil",
    price: 44,
    priceFormatted: "$44.00",
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop",
    description: "Iconic argan oil treatment that eliminates frizz and adds incredible shine",
    hairTypes: ["all"],
    concerns: ["frizz", "dryness", "lack-of-shine"],
    budgetCategory: "40-60",
    website: "sephora.com",
    productUrl: "https://sephora.com/moroccanoil",
    rating_count: 8923,
  },
  {
    id: "smoothing-keratin",
    name: "Brazilian Blowout Smoothing Solution",
    brand: "Brazilian Blowout",
    price: 65,
    priceFormatted: "$65.00",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&h=300&fit=crop",
    description: "Professional smoothing treatment for frizzy and unruly hair",
    hairTypes: ["wavy", "curly", "thick"],
    concerns: ["frizz", "dryness", "lack-of-smoothness"],
    budgetCategory: "60-plus",
    website: "sephora.com",
    productUrl: "https://sephora.com/blowout",
    rating_count: 3421,
  },

  // ── VOLUME & TEXTURE ────────────────────────────────────────────────────
  {
    id: "ouai-volume-mousse",
    name: "Volume Boost Mousse",
    brand: "OUAI",
    price: 28,
    priceFormatted: "$28.00",
    rating: 4.3,
    image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&h=300&fit=crop",
    description: "Lightweight mousse that adds volume and texture without weighing hair down",
    hairTypes: ["fine", "straight", "thin"],
    concerns: ["lack-of-volume", "limp", "thin"],
    budgetCategory: "20-40",
    website: "sephora.com",
    productUrl: "https://sephora.com/ouai",
    rating_count: 2654,
  },
  {
    id: "tresemme-mousse",
    name: "TRESemmé Beauty-Full Volume Mousse",
    brand: "TRESemmé",
    price: 3.99,
    priceFormatted: "$3.99",
    rating: 4.1,
    image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&h=300&fit=crop",
    description: "Budget-friendly mousse that adds bounce and volume to fine hair",
    hairTypes: ["fine", "straight", "thin"],
    concerns: ["lack-of-volume", "limp"],
    budgetCategory: "under-20",
    website: "walmart.com",
    productUrl: "https://walmart.com/tresemme",
    rating_count: 4123,
  },

  // ── DAMAGE & REPAIR ────────────────────────────────────────────────────
  {
    id: "olaplex-no3",
    name: "Olaplex No. 3 Hair Perfector",
    brand: "Olaplex",
    price: 30,
    priceFormatted: "$30.00",
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1596450492317-c76a6b99f0f1?w=300&h=300&fit=crop",
    description: "Professional hair repair treatment that mends broken bonds",
    hairTypes: ["all"],
    concerns: ["damage", "dryness", "breakage"],
    budgetCategory: "20-40",
    website: "sephora.com",
    productUrl: "https://sephora.com/olaplex",
    rating_count: 7654,
  },
  {
    id: "keratin-complex-mask",
    name: "Keratin Complex Strengthening mask",
    brand: "Coppola",
    price: 24,
    priceFormatted: "$24.00",
    rating: 4.4,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&h=300&fit=crop",
    description: "Deep conditioning mask infused with keratin to repair damaged hair",
    hairTypes: ["all"],
    concerns: ["damage", "dryness", "brittleness"],
    budgetCategory: "20-40",
    website: "amazon.com",
    productUrl: "https://amazon.com/coppola",
    rating_count: 3421,
  },

  // ── SCALP & OIL CONTROL ────────────────────────────────────────────────
  {
    id: "neutrogena-shampoo",
    name: "Neutrogena T/Gel Therapeutic Shampoo",
    brand: "Neutrogena",
    price: 7,
    priceFormatted: "$7.00",
    rating: 4.2,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&h=300&fit=crop",
    description: "Medicated shampoo that controls dandruff and soothes scalp",
    hairTypes: ["all"],
    concerns: ["dandruff", "oily-scalp", "itching"],
    budgetCategory: "under-20",
    website: "walmart.com",
    productUrl: "https://walmart.com/neutrogena",
    rating_count: 5621,
  },
  {
    id: "kérastase-purifying",
    name: "Kérastase Fusio-Scrub Scalp Serum",
    brand: "Kérastase",
    price: 58,
    priceFormatted: "$58.00",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1596450492317-c76a6b99f0f1?w=300&h=300&fit=crop",
    description: "Luxury scalp treatment that purifies and removes buildup",
    hairTypes: ["all"],
    concerns: ["oily-scalp", "dandruff", "buildup"],
    budgetCategory: "40-60",
    website: "sephora.com",
    productUrl: "https://sephora.com/kerastase",
    rating_count: 1234,
  },

  // ── STRAIGHT & FINE ────────────────────────────────────────────────────
  {
    id: "pantene-pro-v",
    name: "Pantene Pro-V Gold Series Shampoo",
    brand: "Pantene",
    price: 5,
    priceFormatted: "$5.00",
    rating: 4.0,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&h=300&fit=crop",
    description: "Affordable daily shampoo for straight and fine hair",
    hairTypes: ["straight", "fine"],
    concerns: ["dryness", "lack-of-shine"],
    budgetCategory: "under-20",
    website: "target.com",
    productUrl: "https://target.com/pantene",
    rating_count: 12345,
  },
  {
    id: "bumble-ab-straight",
    name: "Bumble and bumble Straight Blow Dry",
    brand: "Bumble and bumble",
    price: 38,
    priceFormatted: "$38.00",
    rating: 4.4,
    image: "https://images.unsplash.com/photo-1596450492317-c76a6b99f0f1?w=300&h=300&fit=crop",
    description: "Professional blow dry cream for smooth, straight styles",
    hairTypes: ["straight"],
    concerns: ["frizz", "dryness", "smoothness"],
    budgetCategory: "20-40",
    website: "sephora.com",
    productUrl: "https://sephora.com/bumble",
    rating_count: 2134,
  },
];

/**
 * Get all products
 */
function getAllProducts() {
  return PRODUCTS;
}

/**
 * Filter products based on criteria
 */
function filterProducts({ hairType, concerns, budgetCategory, limit = 6 }) {
  let results = PRODUCTS;

  // Filter by hair type
  if (hairType) {
    results = results.filter((p) =>
      p.hairTypes.includes("all") || p.hairTypes.includes(hairType.toLowerCase())
    );
  }

  // Filter by concerns
  if (concerns) {
    const concernList = Array.isArray(concerns) ? concerns : [concerns];
    results = results.filter((p) =>
      concernList.some((c) =>
        p.concerns.some((pc) => pc.toLowerCase().includes(c.toLowerCase()))
      )
    );
  }

  // Filter by budget
  if (budgetCategory) {
    results = results.filter((p) => p.budgetCategory === budgetCategory);
  }

  // Sort by rating (highest first)
  results.sort((a, b) => b.rating - a.rating);

  // Return limited results
  return results.slice(0, limit);
}

/**
 * Get product by ID
 */
function getProductById(productId) {
  return PRODUCTS.find((p) => p.id === productId) || null;
}

/**
 * Get products by brand
 */
function getProductsByBrand(brand) {
  return PRODUCTS.filter((p) => p.brand.toLowerCase().includes(brand.toLowerCase()));
}

/**
 * Get available filter options
 */
function getFilterOptions() {
  return {
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
}

module.exports = {
  getAllProducts,
  filterProducts,
  getProductById,
  getProductsByBrand,
  getFilterOptions,
};
