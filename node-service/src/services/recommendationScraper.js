const alluri = require("./alluriScraper");

module.exports = {
  searchRecommendations: alluri.searchRecommendations,
  scrapeByHairType: alluri.scrapeByHairType,
  scrapeByConcern: alluri.scrapeByConcern,
  scrapeAll: alluri.scrapeAll,
  clearCache: alluri.clearCache,
  getCacheStats: alluri.getCacheStats,
};
