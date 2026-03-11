/**
 * Configuration validation and defaults.
 * Microsoft best practice: validate environment at startup.
 */

const logger = require("./logger").logger;

function validateConfig() {
  const config = {
    port: parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    pythonSidecarUrl: process.env.PYTHON_SIDECAR_URL || "http://localhost:8001",
    ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
    logLevel: process.env.LOG_LEVEL || "INFO",
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "15000", 10),
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

  if (!config.ollamaHost.startsWith("http")) {
    errors.push(
      `Invalid OLLAMA_HOST: ${config.ollamaHost} (must be HTTP/HTTPS)`
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
    ollamaHost: config.ollamaHost,
  });

  return config;
}

module.exports = validateConfig;
