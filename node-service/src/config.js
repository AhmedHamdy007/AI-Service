/**
 * Runtime configuration (validated once at startup / import time).
 *
 * Centralizing config keeps defaults/validation consistent and avoids
 * scattered process.env access across services.
 */

const validateConfig = require("./utils/config");

module.exports = validateConfig();
