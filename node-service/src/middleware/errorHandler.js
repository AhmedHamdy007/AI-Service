const { ValidationError } = require("../utils/validation");

/**
 * Global error handler middleware.
 * Catches all errors thrown in async routes (via express-async-errors).
 * Microsoft best practice: standardized error responses with request ID.
 */
function errorHandler(err, req, res, next) {
  const requestId = req.id || "unknown";
  const logger = req.logger;

  // Log the error
  logger?.error(`Request failed: ${err.message}`, {
    request_id: requestId,
    method: req.method,
    path: req.path,
    error_name: err.name,
  }, err);

  // Validation errors
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: err.message,
      field: err.field,
      request_id: requestId,
    });
  }

  // Axios errors from sidecar calls
  if (err.response) {
    logger?.warn("Upstream service error", {
      request_id: requestId,
      status: err.response.status,
      service: "python-sidecar",
    });

    return res.status(err.response.status || 502).json({
      success: false,
      error: err.response.data?.detail || "Upstream service error",
      service: "python-sidecar",
      request_id: requestId,
    });
  }

  // Connection refused (sidecar down)
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    logger?.error("Service unavailable", {
      request_id: requestId,
      code: err.code,
      service: "python-sidecar",
    });

    return res.status(503).json({
      success: false,
      error: "Python sidecar service is unavailable",
      hint: "Make sure the python-sidecar container is running",
      request_id: requestId,
    });
  }

  // Timeout errors
  if (err.code === "ECONNABORTED") {
    logger?.warn("Request timeout", {
      request_id: requestId,
      timeout_ms: err.timeout,
    });

    return res.status(504).json({
      success: false,
      error: "Request timeout",
      hint: "The operation took too long to complete",
      request_id: requestId,
    });
  }

  // Multer file upload errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "File too large (max 10MB)",
      field: "file",
      request_id: requestId,
    });
  }

  if (err.code === "LIMIT_PART_COUNT") {
    return res.status(400).json({
      success: false,
      error: "Too many file parts",
      request_id: requestId,
    });
  }

  // Generic server error
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message || "",
    request_id: requestId,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = errorHandler;
