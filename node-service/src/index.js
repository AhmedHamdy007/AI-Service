require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");

const { requestLoggingMiddleware, logger } = require("./utils/logger");
const config = require("./config");

const faceRoutes = require("./routes/face.routes");
const recommendationRoutes = require("./routes/recommendation.routes");
const chatRoutes = require("./routes/chat.routes");
const productRoutes = require("./routes/products.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = config.port;

// Middleware
app.use(cors());
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
  // We treat the python sidecar as required; Ollama may be optional per deployment.
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

app.use("/api/face", faceRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/products", productRoutes);

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
    ollama: config.ollamaHost,
  });
});

function shutdown(signal) {
  logger.info(`${signal} signal received: closing HTTP server`);
  server.close(() => {
    logger.info("HTTP server closed");
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
