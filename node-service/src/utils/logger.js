const crypto = require("crypto");

/**
 * Simple structured logger with request ID tracking.
 * Microsoft best practice: structured logging with context.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor(serviceName = "ai-service") {
    this.serviceName = serviceName;
    this.level = LOG_LEVELS[process.env.LOG_LEVEL || "INFO"];
  }

  _format(level, message, context = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...context,
    });
  }

  debug(message, context = {}) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log(this._format("DEBUG", message, context));
    }
  }

  info(message, context = {}) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(this._format("INFO", message, context));
    }
  }

  warn(message, context = {}) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(this._format("WARN", message, context));
    }
  }

  error(message, context = {}, error_obj = null) {
    if (this.level <= LOG_LEVELS.ERROR) {
      const errorContext = { ...context };
      if (error_obj) {
        errorContext.error_message = error_obj.message;
        errorContext.error_stack = error_obj.stack;
      }
      console.error(this._format("ERROR", message, errorContext));
    }
  }
}

const logger = new Logger();

/**
 * Middleware: Add request ID and log incoming requests
 */
function requestLoggingMiddleware(req, res, next) {
  // Generate or use existing request ID
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  req.logger = logger;

  const start = Date.now();

  logger.info("Incoming request", {
    request_id: requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Log response when it's finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
    });
  });

  next();
}

module.exports = { logger, requestLoggingMiddleware, Logger };
