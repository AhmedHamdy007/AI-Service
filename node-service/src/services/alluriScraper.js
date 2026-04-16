/**
 * Allure Scraper
 * Scrapes Allure article/gallery pages by reading __NEXT_DATA__ JSON.
 */

const axios = require("axios");

const SOURCE = {
  name: "Allure",
  baseUrl: "https://www.allure.com",
  credibilityScore: 9,
  category: "general",
  description: "Beauty expert recommendations",
};

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const SITEMAP_URL = "https://www.allure.com/sitemap.xml";
const MAX_SITEMAPS = 4;
const MAX_ARTICLES = 6;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

function extractUrlsFromSitemap(xml) {
  const urls = [];
  const regex = /<loc>(.*?)<\/loc>/g;
  let match = null;
  while ((match = regex.exec(xml))) {
    urls.push(match[1]);
  }
  return urls;
}

async function fetchXml(url) {
  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  return res.data;
}

function normalizeKeyword(value) {
  if (!value) return null;
  return String(value).toLowerCase().replace(/\s+/g, "-");
}

function buildKeywordSet(hairType, concerns) {
  const keys = new Set();
  if (hairType) {
    const list = Array.isArray(hairType) ? hairType : [hairType];
    list.forEach((t) => keys.add(normalizeKeyword(t)));
  }
  if (concerns) {
    const list = Array.isArray(concerns) ? concerns : [concerns];
    list.forEach((c) => keys.add(normalizeKeyword(c)));
  }
  keys.add("hair");
  return Array.from(keys).filter(Boolean);
}

async function getCandidateArticleUrls(hairType, concerns) {
  const cacheKey = `allure:sitemap:${hairType || "all"}:${concerns || "all"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const keywords = buildKeywordSet(hairType, concerns);
  const sitemapIndexXml = await fetchXml(SITEMAP_URL);
  const sitemapUrls = extractUrlsFromSitemap(sitemapIndexXml).slice(0, MAX_SITEMAPS);

  let articleUrls = [];
  for (const sitemapUrl of sitemapUrls) {
    try {
      const xml = await fetchXml(sitemapUrl);
      const urls = extractUrlsFromSitemap(xml);
      articleUrls = articleUrls.concat(urls);
    } catch {
      continue;
    }
  }

  const filtered = articleUrls.filter((url) => {
    if (!url.includes("allure.com")) return false;
    if (!url.includes("/gallery/") && !url.includes("/story/")) return false;
    const lower = url.toLowerCase();
    return keywords.some((k) => lower.includes(k));
  });

  const unique = Array.from(new Set(filtered)).slice(0, MAX_ARTICLES);
  setCache(cacheKey, unique);
  return unique;
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function looksLikeProduct(obj) {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  const hasName =
    typeof obj.productName === "string" ||
    typeof obj.productTitle === "string" ||
    typeof obj.name === "string" ||
    typeof obj.title === "string";
  const hasBrand =
    typeof obj.brand === "string" ||
    typeof obj.brandName === "string" ||
    (obj.brand && typeof obj.brand.name === "string");
  const hasUrl =
    typeof obj.productUrl === "string" ||
    typeof obj.url === "string" ||
    typeof obj.link === "string" ||
    typeof obj.shoppingLink === "string";
  const hasProductKey = keys.some((k) => k.toLowerCase().includes("product"));
  return hasName && (hasUrl || hasBrand || hasProductKey);
}

function normalizeProduct(obj, pageUrl) {
  const name = obj.productName || obj.productTitle || obj.name || obj.title;
  const brand =
    obj.brand?.name || obj.brandName || obj.brand || "Unknown";
  const productUrl =
    obj.productUrl || obj.url || obj.link || obj.shoppingLink || null;
  const image =
    obj.image?.url || obj.imageUrl || (Array.isArray(obj.image) ? obj.image[0] : obj.image) || null;
  const price = obj.price || obj.productPrice || null;

  return {
    name,
    brand,
    price,
    currency: obj.currency || "USD",
    rating: obj.rating || null,
    ratingCount: obj.ratingCount || 0,
    description: obj.description || obj.dek || name,
    image,
    productUrl,
    sku: obj.sku || null,
    source: SOURCE.name,
    sourceUrl: pageUrl,
    credibilityScore: SOURCE.credibilityScore,
    category: SOURCE.category,
  };
}

function collectProducts(node, pageUrl, output) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectProducts(item, pageUrl, output));
    return;
  }
  if (typeof node !== "object") return;

  if (looksLikeProduct(node)) {
    output.push(normalizeProduct(node, pageUrl));
  }

  Object.values(node).forEach((value) => {
    collectProducts(value, pageUrl, output);
  });
}

function extractProductsFromNextData(nextData, pageUrl) {
  const products = [];

  const pageProps = nextData?.props?.pageProps;
  if (pageProps?.gallery?.items) {
    collectProducts(pageProps.gallery.items, pageUrl, products);
  }
  if (pageProps?.article?.body) {
    collectProducts(pageProps.article.body, pageUrl, products);
  }
  if (pageProps?.article?.content) {
    collectProducts(pageProps.article.content, pageUrl, products);
  }

  collectProducts(nextData, pageUrl, products);

  return products;
}

async function scrapeAllurePage(url) {
  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const nextData = extractNextData(res.data);
  if (!nextData) return [];

  const products = extractProductsFromNextData(nextData, url);

  const seen = new Set();
  const unique = [];
  products.forEach((p) => {
    if (!p.name) return;
    const key = `${p.brand}_${p.name}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(p);
  });

  return unique;
}

async function searchRecommendations(hairType, concerns) {
  const queryKey = `${hairType || "all"}:${concerns || "all"}`;
  const cacheKey = `allure:search:${queryKey}`;
  const cached = getCached(cacheKey);
  if (cached) return { ...cached, cached: true };

  const urls = await getCandidateArticleUrls(hairType, concerns);
  let allProducts = [];

  for (const url of urls) {
    try {
      const products = await scrapeAllurePage(url);
      allProducts = allProducts.concat(products);
    } catch {
      continue;
    }
  }

  const seen = new Set();
  allProducts = allProducts.filter((p) => {
    const key = `${p.brand}_${p.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const result = {
    query: `allure:${queryKey}`,
    hairType: hairType || null,
    concerns: Array.isArray(concerns) ? concerns : concerns ? [concerns] : [],
    products: allProducts,
    totalFound: allProducts.length,
    sources: {
      [SOURCE.name]: {
        credibilityScore: SOURCE.credibilityScore,
        count: allProducts.length,
        cached: false,
      },
    },
    scraped: new Date().toISOString(),
  };

  setCache(cacheKey, result);
  return { ...result, cached: false };
}

async function scrapeByHairType(hairType) {
  const result = await searchRecommendations(hairType, null);
  return result.products || [];
}

async function scrapeByConcern(concern) {
  const result = await searchRecommendations(null, concern);
  return result.products || [];
}

async function scrapeAll() {
  const result = await searchRecommendations(null, null);
  return [{ query: result.query, products: result.products || [] }];
}

function clearCache() {
  cache.clear();
}

function getCacheStats() {
  return {
    size: cache.size,
    items: Array.from(cache.keys()),
  };
}

module.exports = {
  searchRecommendations,
  scrapeByHairType,
  scrapeByConcern,
  scrapeAll,
  clearCache,
  getCacheStats,
};
