const axios = require("axios");
const FormData = require("form-data");

const config = require("../config");

const http = axios.create({
  baseURL: config.pythonSidecarUrl,
  timeout: config.requestTimeout,
});

/**
 * Send an image buffer to the Python sidecar for face analysis.
 * @param {Buffer} imageBuffer
 * @param {string} mimetype
 * @returns {Object} face analysis result
 */
async function analyzeFace(imageBuffer, mimetype = "image/jpeg") {
  const form = new FormData();
  form.append("file", imageBuffer, {
    filename: "upload.jpg",
    contentType: mimetype,
  });

  const response = await http.post("/face/analyze", form, {
    headers: form.getHeaders(),
    // Model inference can be slow on cold start; use configured default timeout.
  });

  return response.data;
}

/**
 * Health check for the Python sidecar
 */
async function checkSidecarHealth({ timeoutMs } = {}) {
  const response = await http.get("/health", {
    timeout: timeoutMs ?? Math.min(5000, config.requestTimeout),
  });
  return response.data;
}

/**
 * Get supported face shapes from sidecar
 */
async function getSupportedShapes({ timeoutMs } = {}) {
  const response = await http.get("/face/shapes", {
    timeout: timeoutMs ?? Math.min(5000, config.requestTimeout),
  });
  return response.data;
}

module.exports = { analyzeFace, checkSidecarHealth, getSupportedShapes };
