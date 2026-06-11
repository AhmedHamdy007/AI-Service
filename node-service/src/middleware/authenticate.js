const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const config = require("../config");

let cachedPublicKey = null;

function readPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  if (!config.jwtPublicKeyPath) {
    throw new Error("JWT_PUBLIC_KEY_PATH is required for authenticated AI routes");
  }

  const resolved = path.resolve(config.jwtPublicKeyPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`JWT public key file not found at ${resolved}`);
  }

  cachedPublicKey = fs.readFileSync(resolved, "utf8");
  return cachedPublicKey;
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthenticated: no token provided.",
      request_id: req.id,
    });
  }

  try {
    const token = authHeader.slice("Bearer ".length).trim();
    const payload = jwt.verify(token, readPublicKey(), {
      algorithms: ["RS256"],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });

    req.auth = payload;
    req.user = {
      id: payload.sub,
      role: payload.role || null,
    };
    return next();
  } catch (error) {
    req.logger?.warn("AI route authentication failed", {
      request_id: req.id,
      error: error.message,
    });
    return res.status(401).json({
      success: false,
      error: "Unauthenticated: invalid or expired token.",
      request_id: req.id,
    });
  }
}

module.exports = { authenticate };
