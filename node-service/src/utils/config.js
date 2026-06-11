/**
 * Configuration validation and defaults.
 * Microsoft best practice: validate environment at startup.
 */

const logger = require("./logger").logger;

function csvEnv(name) {
  const value = process.env[name];
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateConfig() {
  const config = {
    port: parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    pythonSidecarUrl: process.env.PYTHON_SIDECAR_URL || "http://localhost:8001",
    disableLlm: process.env.DISABLE_LLM === "true",
    logLevel: process.env.LOG_LEVEL || "INFO",
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "15000", 10),
    corsAllowedOrigins: csvEnv("CORS_ALLOWED_ORIGINS"),
    jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || "",
    jwtIssuer: process.env.JWT_ISSUER || "salon-platform.auth",
    jwtAudience: process.env.JWT_AUDIENCE || "salon-platform.api",
  };

  // Validate configuration
  const errors = [];

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT} (must be 1-65535)`);
  }

  if (!config.pythonSidecarUrl.startsWith("http")) {
    errors.push(
      `Invalid PYTHON_SIDECAR_URL: ${config.pythonSidecarUrl} (must be HTTP/HTTPS)`
    );
  }

  if (!["development", "production", "staging"].includes(config.nodeEnv)) {
    logger.warn(
      `Unusual NODE_ENV: ${config.nodeEnv}. Using development defaults.`
    );
  }

  if (errors.length > 0) {
    logger.error("Configuration validation failed", {
      errors,
    });
    throw new Error(`Configuration invalid:\n${errors.join("\n")}`);
  }

  logger.info("Configuration loaded successfully", {
    port: config.port,
    nodeEnv: config.nodeEnv,
    pythonSidecarUrl: config.pythonSidecarUrl,
    disableLlm: config.disableLlm,
  });

  return config;
}

module.exports = validateConfig;
