/**
 * Jest configuration for testing.
 * Microsoft best practice: proper test setup and coverage reporting.
 */

module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/index.js",
  ],
  coveragePathIgnorePatterns: ["/node_modules/"],
  testPathIgnorePatterns: ["/node_modules/"],
  verbose: true,
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
};
