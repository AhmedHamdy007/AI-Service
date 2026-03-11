const express = require("express");
const { chat, chatStream, buildContextMessage } = require("../services/ollamaChat");
const {
  validateChatMessage,
  validateChatHistory,
  validateGender,
  validateFaceShape,
  validateHairType,
  validateLifestyle,
} = require("../utils/validation");

const router = express.Router();

/**
 * POST /api/chat
 * Standard (non-streaming) chat endpoint.
 *
 * Body (JSON):
 *   message      — required: user's message
 *   history      — optional: [{role, content}, ...] previous messages
 *   userProfile  — optional: {faceShape, hairType, gender, lifestyle}
 *
 * Microsoft best practice: validate all user inputs
 */
router.post("/", async (req, res) => {
  try {
    const { message, history = [], userProfile = {} } = req.body;

    // Validate inputs
    const validatedMessage = validateChatMessage(message);
    const validatedHistory = validateChatHistory(history);

    // Validate optional user profile
    const validatedProfile = {};
    if (userProfile.faceShape) {
      validatedProfile.faceShape = userProfile.faceShape;
    }
    if (userProfile.hairType) {
      validatedProfile.hairType = validateHairType(userProfile.hairType);
    }
    if (userProfile.gender) {
      validatedProfile.gender = validateGender(userProfile.gender);
    }
    if (userProfile.lifestyle) {
      validatedProfile.lifestyle = validateLifestyle(userProfile.lifestyle);
    }

    req.logger.debug("Chat request", {
      request_id: req.id,
      messageLength: validatedMessage.length,
      historyLength: validatedHistory.length,
    });

    // Build messages array: history + context + new message
    const contextMessages = buildContextMessage(validatedProfile, validatedMessage);
    const allMessages = [...validatedHistory, ...contextMessages];

    const reply = await chat(allMessages);

    req.logger.info("Chat response generated", {
      request_id: req.id,
      replyLength: reply.length,
    });

    res.json({
      success: true,
      data: {
        role: "assistant",
        content: reply,
      },
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

/**
 * POST /api/chat/stream
 * Streaming chat via Server-Sent Events (SSE).
 *
 * Body (JSON):
 *   message      — required
 *   history      — optional
 *   userProfile  — optional
 *
 * Microsoft best practice: implement streaming with proper error handling
 */
router.post("/stream", async (req, res) => {
  try {
    const { message, history = [], userProfile = {} } = req.body;

    // Validate inputs
    const validatedMessage = validateChatMessage(message);
    const validatedHistory = validateChatHistory(history);

    // Validate optional user profile
    const validatedProfile = {};
    if (userProfile.hairType) {
      validatedProfile.hairType = validateHairType(userProfile.hairType);
    }
    if (userProfile.gender) {
      validatedProfile.gender = validateGender(userProfile.gender);
    }
    if (userProfile.lifestyle) {
      validatedProfile.lifestyle = validateLifestyle(userProfile.lifestyle);
    }

    req.logger.debug("Chat stream request", {
      request_id: req.id,
    });

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Request-ID", req.id);
    res.flushHeaders();

    const contextMessages = buildContextMessage(validatedProfile, validatedMessage);
    const allMessages = [...validatedHistory, ...contextMessages];

    let totalChunks = 0;

    try {
      await chatStream(allMessages, (chunk) => {
        totalChunks++;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      });

      req.logger.info("Chat stream completed", {
        request_id: req.id,
        totalChunks,
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      req.logger.error("Chat stream error", {
        request_id: req.id,
        totalChunks,
      }, err);

      res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
    } finally {
      res.end();
    }
  } catch (err) {
    req.logger.error("Chat stream validation error", {
      request_id: req.id,
    }, err);

    res.setHeader("Content-Type", "application/json");
    res.status(400).json({
      success: false,
      error: err.message,
      request_id: req.id,
    });
  }
});

/**
 * GET /api/chat/examples
 * Returns example questions users can ask the chat assistant.
 */
router.get("/examples", (req, res) => {
  res.json({
    success: true,
    data: [
      "What hairstyle suits a round face?",
      "What haircut is best for curly hair?",
      "Recommend a professional hairstyle for a woman",
      "I have a square face and straight hair — what should I try?",
      "How do I style a textured crop?",
      "What's the difference between a taper and a fade?",
      "How often should I trim my hair?",
      "What products should I use for wavy hair?",
    ],
    request_id: req.id,
  });
});

module.exports = router;
