require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");

const { requestLoggingMiddleware, logger } = require("./utils/logger");
const config = require("./config");
const {
  createCorsOptions,
  securityHeadersMiddleware,
} = require("../../../shared/http/httpSecurity");

const faceRoutes = require("./routes/face.routes");
const faceShapeRoutes = require("./routes/faceShape.routes");
const recommendationRoutes = require("./routes/recommendation.routes");
const chatRoutes = require("./routes/chat.routes");
const productRoutes = require("./routes/products.routes");
const { authenticate } = require("./middleware/authenticate");
const { customerOnly } = require("./middleware/customerOnly");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = config.port;
const corsOptions = createCorsOptions({
  nodeEnv: config.nodeEnv,
  corsAllowedOrigins: config.corsAllowedOrigins,
  allowedMethods: ["GET", "POST"],
});

// Middleware
app.use(securityHeadersMiddleware);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(requestLoggingMiddleware);

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ai-microservice",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (req, res) => {
  // Keep readiness deterministic and reasonably fast.
  // We treat the python sidecar as required; chat LLM calls are handled there.
  try {
    const { checkSidecarHealth } = require("./services/sidecarClient");
    await checkSidecarHealth({ timeoutMs: 1500 });

    res.json({ ready: true, timestamp: new Date().toISOString() });
  } catch (err) {
    req.logger?.warn("Readiness check failed", { request_id: req.id }, err);

    res.status(503).json({
      ready: false,
      error: "Python sidecar is unavailable",
      timestamp: new Date().toISOString(),
      request_id: req.id,
    });
  }
});

app.use("/api/face", authenticate, customerOnly, faceRoutes);
app.use("/api/face-shape", authenticate, customerOnly, faceShapeRoutes);
app.use("/ai/face-shape", authenticate, customerOnly, faceShapeRoutes);
app.use("/api/recommendations", authenticate, customerOnly, recommendationRoutes);
app.use("/api/chat", authenticate, customerOnly, chatRoutes);
app.use("/api/products", authenticate, customerOnly, productRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    request_id: req.id,
  });
});

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info("Service started successfully", {
    port: PORT,
    environment: config.nodeEnv,
    pythonSidecar: config.pythonSidecarUrl,
  });
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} signal received: closing HTTP server`);
  const forceExitTimer = setTimeout(() => {
    logger.error("Forcing shutdown after timeout", { signal });
    process.exit(1);
  }, 10000);
  forceExitTimer.unref?.();

  server.close(() => {
    logger.info("HTTP server closed");
    clearTimeout(forceExitTimer);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", {}, new Error(String(reason)));
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {}, error);
  process.exit(1);
});

module.exports = app;
