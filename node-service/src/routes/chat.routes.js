const express = require("express");
const { chat, chatStream, buildContextMessage } = require("../services/groqChat");
const { getRecommendations } = require("../data/haircutData");
const {
  validateChatMessage,
  validateChatHistory,
  validateGender,
  validateFaceShape,
  validateHairType,
  validateLifestyle,
} = require("../utils/validation");

const router = express.Router();
const CHAT_RATE_WINDOW_MS = 60 * 1000;
const CHAT_RATE_MAX = 30;
const chatRateBuckets = new Map();

function chatRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.user?.id || req.ip || "anonymous";
  const bucket = chatRateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    chatRateBuckets.set(key, { count: 1, resetAt: now + CHAT_RATE_WINDOW_MS });
    return next();
  }

  if (bucket.count >= CHAT_RATE_MAX) {
    return res.status(429).json({
      success: false,
      error: "Too many chat requests. Please try again shortly.",
      request_id: req.id,
    });
  }

  bucket.count += 1;
  return next();
}

const FACE_SHAPES = [
  "oval",
  "round",
  "square",
  "heart",
  "oblong",
  "diamond",
  "long",
];

const FACE_SHAPE_LABELS = {
  oval: "Oval",
  round: "Round",
  square: "Square",
  heart: "Heart",
  oblong: "Oblong",
  diamond: "Diamond",
  long: "Oblong",
};

const HAIRCUT_RECOMMENDATION_TRIGGERS = [
  "recommend",
  "recommendation",
  "what haircut",
  "what hairstyle",
  "what style",
  "what cut",
  "suits my face",
  "suits a",
  "for my face",
  "for a",
  "haircut for",
  "hairstyle for",
  "what should i get",
  "what should i cut",
  "suitable",
];

const GREETING_TRIGGERS = [
  "hello",
  "hi",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "hola",
  "yo",
  "sup",
  "what's up",
  "whats up",
];

const MALE_SIGNALS = [
  "male",
  "man",
  "men",
  "guy",
  "boy",
  "masculine",
  "he",
  "his",
  "husband",
  "boyfriend",
  "brother",
  "father",
  "dad",
];

const FEMALE_SIGNALS = [
  "female",
  "woman",
  "women",
  "girl",
  "feminine",
  "she",
  "her",
  "wife",
  "girlfriend",
  "sister",
  "mother",
  "mom",
];

const hasWordSignal = (text, signal) => {
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(text);
};

const normalizeMessage = (message) =>
  String(message || "").toLowerCase().replace(/[’]/g, "'").trim();

const isGreeting = (message) => {
  const lower = normalizeMessage(message);
  return GREETING_TRIGGERS.some(
    (g) =>
      lower === g ||
      lower.startsWith(`${g} `) ||
      lower.startsWith(`${g}!`)
  );
};

const parseGenderFromMessage = (message) => {
  const lower = normalizeMessage(message);
  const isMale = MALE_SIGNALS.some((signal) => hasWordSignal(lower, signal));
  const isFemale = FEMALE_SIGNALS.some((signal) => hasWordSignal(lower, signal));

  if (isMale && !isFemale) return "male";
  if (isFemale && !isMale) return "female";
  return null;
};

const parseFaceShapeFromMessage = (message) => {
  const lower = normalizeMessage(message);
  const shape = FACE_SHAPES.find((item) => {
    if (item === "long") {
      return /\blong\s+(face|face shape)\b/.test(lower);
    }

    return hasWordSignal(lower, item);
  });

  return shape ? FACE_SHAPE_LABELS[shape] : null;
};

const isExplicitHaircutAsk = (message) => {
  const lower = normalizeMessage(message);
  return (
    /\b(recommend|suggest)\b.*\b(haircut|hairstyle|hair style|cut)\b/.test(lower) ||
    /\b(what haircut|what hairstyle|what cut|what style suits my face|what style suits me)\b/.test(lower) ||
    /\bsuits my face\b/.test(lower) ||
    /\bwhat should i (get|cut)\b/.test(lower)
  );
};

const isHaircutRecommendationRequest = (message) => {
  const lower = normalizeMessage(message);
  const mentionsFaceShape = Boolean(parseFaceShapeFromMessage(message));
  const mentionsRecommendation = HAIRCUT_RECOMMENDATION_TRIGGERS.some((trigger) =>
    lower.includes(trigger)
  );
  const hasGenderAndFaceShape = mentionsFaceShape && Boolean(parseGenderFromMessage(message));

  return (
    (mentionsFaceShape && mentionsRecommendation) ||
    isExplicitHaircutAsk(message) ||
    hasGenderAndFaceShape
  );
};

function normalizeFaceShape(value) {
  const candidate = String(value || "").toLowerCase();
  return FACE_SHAPE_LABELS[candidate] || null;
}

function inferFaceShape(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = String(messages[index]?.content || "");
    const match = parseFaceShapeFromMessage(content);
    if (match) return match;
  }
  return null;
}

function inferGender(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const gender = parseGenderFromMessage(messages[index]?.content || "");
    if (gender) return gender;
  }
  return null;
}

function validateProfile(userProfile = {}, validatedMessage, validatedHistory) {
  const messages = [...validatedHistory, { role: "user", content: validatedMessage }];
  const validatedProfile = {};

  if (userProfile.faceShape) {
    const normalizedShape = normalizeFaceShape(userProfile.faceShape);
    validatedProfile.faceShape = validateFaceShape(normalizedShape || userProfile.faceShape);
  } else {
    const inferredShape = inferFaceShape(messages);
    if (inferredShape) validatedProfile.faceShape = inferredShape;
  }

  if (userProfile.hairType) {
    validatedProfile.hairType = validateHairType(userProfile.hairType);
  }

  if (userProfile.gender) {
    validatedProfile.gender = validateGender(userProfile.gender);
  } else {
    const inferred = inferGender(messages);
    if (inferred) validatedProfile.gender = inferred;
  }

  if (userProfile.lifestyle) {
    validatedProfile.lifestyle = validateLifestyle(userProfile.lifestyle);
  }

  return validatedProfile;
}

function toHaircutCard(cut) {
  return {
    id: cut.id,
    name: cut.name,
    altName: cut.altName,
    why: cut.why,
    tags: cut.tags,
    imageUrl: cut.imageUrl,
  };
}

function buildRecommendationResponse(validatedMessage, validatedProfile) {
  const detectedFaceShape = parseFaceShapeFromMessage(validatedMessage);
  const detectedGender = parseGenderFromMessage(validatedMessage);
  const faceShape = detectedFaceShape || validatedProfile.faceShape;
  const gender = detectedGender || validatedProfile.gender;

  if (!faceShape) {
    const message =
      "What's your face shape? (oval, round, square, heart, diamond, or oblong) Not sure? Try our face scan for an instant result!";

    return {
      role: "assistant",
      content: message,
      message,
      hasRecommendations: false,
      suggestFaceScan: true,
      detectedGender: detectedGender || undefined,
    };
  }

  if (!gender) {
    const message =
      "I'd love to recommend some cuts! Are we looking for men's or women's hairstyles?";

    return {
      role: "assistant",
      content: message,
      message,
      hasRecommendations: false,
      needsGender: true,
      detectedFaceShape: faceShape,
      faceShape,
    };
  }

  const recommendations = getRecommendations(faceShape, gender, 3).map(toHaircutCard);
  const shape = faceShape.toLowerCase();
  const message = `Based on your ${shape} face shape, here are my top ${gender === "male" ? "men's" : "women's"} picks!`;

  return {
    role: "assistant",
    content: message,
    message,
    hasRecommendations: true,
    suggestFaceScan: false,
    faceShape,
    gender,
    detectedFaceShape: faceShape,
    detectedGender: gender,
    recommendations,
  };
}

async function buildChatResponse(validatedMessage, validatedHistory, validatedProfile) {
  if (isGreeting(validatedMessage)) {
    const message =
      "Hey! I'm StyleSense, your personal hair consultant. Ask me about hairstyles, hair care, products, or tell me your face shape and I'll find the perfect cut for you!";

    return {
      role: "assistant",
      content: message,
      message,
      hasRecommendations: false,
    };
  }

  if (isHaircutRecommendationRequest(validatedMessage)) {
    return buildRecommendationResponse(validatedMessage, validatedProfile);
  }

  const contextMessages = buildContextMessage(validatedProfile, validatedMessage);
  const allMessages = [...validatedHistory, ...contextMessages];
  const reply = await chat(allMessages);
  const detectedFaceShape = parseFaceShapeFromMessage(validatedMessage);
  const detectedGender = parseGenderFromMessage(validatedMessage);

  return {
    role: "assistant",
    content: reply,
    message: reply,
    hasRecommendations: false,
    detectedFaceShape: detectedFaceShape || undefined,
    detectedGender: detectedGender || undefined,
  };
}

function writeSsePayload(res, payload) {
  const chunks = String(payload.content || "").match(/.{1,100}(\s|$)/g) || [payload.content || ""];

  chunks.forEach((chunk) => {
    if (chunk) res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  });

  res.write(`data: ${JSON.stringify({ done: true, ...payload })}\n\n`);
}

/**
 * POST /api/chat
 * Standard (non-streaming) chat endpoint.
 *
 * Body (JSON):
 *   message      - required: user's message
 *   history      - optional: [{role, content}, ...] previous messages
 *   userProfile  - optional: {faceShape, hairType, gender, lifestyle}
 */
router.post("/", chatRateLimit, async (req, res) => {
  try {
    const {
      message,
      history = [],
      userProfile = {},
      sessionFaceShape = null,
      sessionGender = null,
    } = req.body;

    const validatedMessage = validateChatMessage(message);
    const validatedHistory = validateChatHistory(history);
    const profileInput = {
      ...userProfile,
      faceShape: sessionFaceShape || userProfile.faceShape,
      gender: sessionGender || userProfile.gender,
    };
    const validatedProfile = validateProfile(profileInput, validatedMessage, validatedHistory);

    req.logger.debug("Chat request", {
      request_id: req.id,
      messageLength: validatedMessage.length,
      historyLength: validatedHistory.length,
    });

    const reply = await buildChatResponse(validatedMessage, validatedHistory, validatedProfile);

    req.logger.info("Chat response generated", {
      request_id: req.id,
      replyLength: reply.content.length,
      hasRecommendations: reply.hasRecommendations,
    });

    res.json({
      success: true,
      data: reply,
      request_id: req.id,
    });
  } catch (err) {
    throw err;
  }
});

/**
 * POST /api/chat/stream
 * Streaming chat via Server-Sent Events (SSE).
 */
router.post("/stream", chatRateLimit, async (req, res) => {
  try {
    const {
      message,
      history = [],
      userProfile = {},
      sessionFaceShape = null,
      sessionGender = null,
    } = req.body;

    const validatedMessage = validateChatMessage(message);
    const validatedHistory = validateChatHistory(history);
    const profileInput = {
      ...userProfile,
      faceShape: sessionFaceShape || userProfile.faceShape,
      gender: sessionGender || userProfile.gender,
    };
    const validatedProfile = validateProfile(profileInput, validatedMessage, validatedHistory);

    req.logger.debug("Chat stream request", {
      request_id: req.id,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Request-ID", req.id);
    res.flushHeaders();

    try {
      if (isGreeting(validatedMessage) || isHaircutRecommendationRequest(validatedMessage)) {
        const reply = await buildChatResponse(validatedMessage, validatedHistory, validatedProfile);
        writeSsePayload(res, reply);

        req.logger.info("Chat stream completed", {
          request_id: req.id,
          hasRecommendations: reply.hasRecommendations,
        });
      } else {
        const contextMessages = buildContextMessage(validatedProfile, validatedMessage);
        const allMessages = [...validatedHistory, ...contextMessages];
        const detectedFaceShape = parseFaceShapeFromMessage(validatedMessage);
        const detectedGender = parseGenderFromMessage(validatedMessage);
        let streamedContent = "";

        const fullResponse = await chatStream(allMessages, (chunk) => {
          streamedContent += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        });

        const reply = {
          role: "assistant",
          content: fullResponse || streamedContent,
          message: fullResponse || streamedContent,
          hasRecommendations: false,
          detectedFaceShape: detectedFaceShape || undefined,
          detectedGender: detectedGender || undefined,
        };

        res.write(`data: ${JSON.stringify({ done: true, ...reply })}\n\n`);

        req.logger.info("Chat stream completed", {
          request_id: req.id,
          hasRecommendations: false,
        });
      }
    } catch (err) {
      req.logger.error("Chat stream error", {
        request_id: req.id,
      }, err);

      const message = err.status === 429
        ? "Chat is temporarily busy. Please try again shortly."
        : "Chat is temporarily unavailable. Please try again shortly.";
      res.write(`data: ${JSON.stringify({ error: message, done: true })}\n\n`);
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
      "I have a square face and straight hair - what should I try?",
      "How do I style a textured crop?",
      "What's the difference between a taper and a fade?",
      "How often should I trim my hair?",
      "What products should I use for wavy hair?",
    ],
    request_id: req.id,
  });
});

module.exports = router;
