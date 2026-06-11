const config = require("../config");
const {
  getRecommendations,
} = require("../data/haircutData");

const LLM_DISABLED = config.disableLlm;
const CHAT_TIMEOUT_MS = Math.max(config.requestTimeout || 15000, 5000);

const SYSTEM_PROMPT = `
You are StyleSense, a friendly and knowledgeable hair consultant
for a salon booking platform called SalonSocial.

YOUR PERSONALITY:
- Warm, approachable, and conversational
- Knowledgeable but never condescending
- Encouraging - make users feel confident about their hair

WHAT YOU HELP WITH:
- Hair care routines and tips
- Product recommendations (shampoo, conditioner, treatments, styling)
- Styling techniques and tutorials
- Hair problems (frizz, damage, thinning, oiliness, dryness)
- Hair type advice (straight, wavy, curly, coily)
- Colour maintenance and treatments
- General hair health advice

WHAT YOU DO NOT DO:
- You do not discuss topics unrelated to hair
- If asked about something unrelated, gently redirect:
  "I'm best at hair topics! Ask me about care routines,
   products, or styling and I'll have great advice for you."

RESPONSE STYLE:
- Keep responses under 100 words unless the question needs detail
- Be direct and practical - give real advice, not vague tips
- Use a conversational tone - not clinical or robotic
- Never repeat the same recommendation twice in a session
- Do NOT list haircut names or face shape recommendations -
  that is handled separately by the system

GREETING BEHAVIOR:
- If greeted, respond warmly and invite a hair question
- Never refuse a greeting or immediately restrict the user
`;

const SUPPORTED_FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond", "Oblong"];
const SUPPORTED_HAIR_TYPES = ["Straight", "Wavy", "Curly", "Coily"];
const SUPPORTED_LIFESTYLES = ["Professional", "Casual", "Trendy"];
const OFF_TOPIC_RESPONSE =
  "I'm best at hair topics! Ask me about care routines, products, or styling and I'll have great advice for you.";

const FACE_SHAPE_GUIDANCE = {
  Oval: {
    best: "most lengths and silhouettes work",
    avoid: "too much side width if you want a sharper shape",
  },
  Round: {
    best: "height at the crown, longer layers, and soft face-framing pieces",
    avoid: "blunt cheek-level width",
  },
  Square: {
    best: "movement, layers, and waves that soften the jaw",
    avoid: "hard blunt lines at jaw level",
  },
  Heart: {
    best: "fullness around the jaw and cheek area",
    avoid: "too much top-heavy volume",
  },
  Diamond: {
    best: "width around the forehead and jaw with softer outlines",
    avoid: "very narrow, slicked-back silhouettes",
  },
  Oblong: {
    best: "collarbone lengths, waves, curtain bangs, and layered shapes that add width",
    avoid: "very long, flat, centre-parted length with no movement",
  },
};

function getLatestUserMessage(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user" && messages[index]?.content) {
      return messages[index].content.trim();
    }
  }
  return "";
}

function getPreviousAssistantMessage(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant" && messages[index]?.content) {
      return messages[index].content.trim();
    }
  }
  return "";
}

function normalizeFaceShape(value) {
  const candidate = String(value || "").toLowerCase();
  return SUPPORTED_FACE_SHAPES.find((shape) => shape.toLowerCase() === candidate) || null;
}

function normalizeHairType(value) {
  const candidate = String(value || "").toLowerCase();
  return SUPPORTED_HAIR_TYPES.find((type) => type.toLowerCase() === candidate) || null;
}

function normalizeLifestyle(value) {
  const candidate = String(value || "").toLowerCase();
  return SUPPORTED_LIFESTYLES.find((item) => item.toLowerCase() === candidate) || null;
}

function inferGender(message) {
  const text = String(message || "").toLowerCase();
  if (/\b(female|woman|girl|lady|women)\b/.test(text)) return "female";
  if (/\b(male|man|boy|guy|men)\b/.test(text)) return "male";
  return null;
}

function inferFaceShape(message) {
  const text = String(message || "");
  return SUPPORTED_FACE_SHAPES.find((shape) =>
    new RegExp(`\\b${shape.toLowerCase()}\\b`, "i").test(text)
  ) || null;
}

function inferHairType(message) {
  const text = String(message || "");
  return SUPPORTED_HAIR_TYPES.find((type) =>
    new RegExp(`\\b${type.toLowerCase()}\\b`, "i").test(text)
  ) || null;
}

function inferLifestyle(message) {
  const text = String(message || "");
  return SUPPORTED_LIFESTYLES.find((item) =>
    new RegExp(`\\b${item.toLowerCase()}\\b`, "i").test(text)
  ) || null;
}

function extractProfile(messages = []) {
  const profile = {};

  for (const message of messages) {
    if (typeof message?.content !== "string") continue;

    const content = message.content;

    if (message.role === "system") {
      const faceShapeMatch = content.match(/Face shape:\s*([A-Za-z]+)/i);
      const hairTypeMatch = content.match(/Hair type:\s*([A-Za-z]+)/i);
      const genderMatch = content.match(/Gender:\s*([A-Za-z]+)/i);
      const lifestyleMatch = content.match(/Lifestyle:\s*([A-Za-z]+)/i);

      if (faceShapeMatch) profile.faceShape = normalizeFaceShape(faceShapeMatch[1]);
      if (hairTypeMatch) profile.hairType = normalizeHairType(hairTypeMatch[1]);
      if (genderMatch) profile.gender = String(genderMatch[1]).toLowerCase();
      if (lifestyleMatch) profile.lifestyle = normalizeLifestyle(lifestyleMatch[1]);
      continue;
    }

    if (message.role === "user") {
      profile.faceShape = inferFaceShape(content) || profile.faceShape;
      profile.hairType = inferHairType(content) || profile.hairType;
      profile.gender = inferGender(content) || profile.gender;
      profile.lifestyle = inferLifestyle(content) || profile.lifestyle;
    }
  }

  return profile;
}

function isHairTopic(message) {
  const text = String(message || "").toLowerCase();
  return /(hair|hairstyle|haircut|style|fringe|bangs|fade|crop|bob|lob|colour|color|curl|salon|shampoo|conditioner|product|treatment|keratin|balayage|trim|cut|layers|frizz|scalp|bangs|blowout|perm)/.test(text);
}

function inferLengthPreference(message) {
  const text = String(message || "").toLowerCase();
  const wantsShort = /\b(short|shorter|chin-length|bob|lob|pixie)\b/.test(text);
  const wantsLong = /\b(long|longer|keep it long|length)\b/.test(text);

  if (wantsShort && wantsLong) return "compare";
  if (wantsShort) return "short";
  if (wantsLong) return "long";
  return null;
}

function isCorrectionMessage(message) {
  const text = String(message || "").toLowerCase();
  return /(those are|mostly male|not male|too male|too masculine|i meant|bruh|you missed|you were wrong|that sounds male|that feels male)/.test(text);
}

function isRecommendationIntent(message) {
  const text = String(message || "").toLowerCase();
  return /(what|which|recommend|suggest|suit|best|should i|would suit|what haircut|what hairstyle|what cut)/.test(text);
}

function getRecommendedStyles(profile, limit = 3) {
  if (!profile.faceShape) return [];

  return getRecommendations(profile.faceShape, profile.gender || "female", limit)
    .map((cut) => ({
      ...cut,
      description: cut.why,
    }));
}

function formatStyleList(styles) {
  return styles
    .slice(0, 3)
    .map((style) => `${style.name}: ${style.description}`)
    .join(" ");
}

function buildFemaleOblongReply(lengthPreference, corrective = false) {
  const intro = corrective
    ? "You're right - those suggestions leaned too masculine for an oblong face."
    : "For a woman with an oblong face, I would not keep it very long and flat.";

  if (lengthPreference === "short") {
    return `${intro} If you want to go shorter, I would steer you toward a soft bob or textured lob rather than something severe, because that keeps width around the cheeks and jaw. Curtain bangs, airy face-framing pieces, or loose bends help even more so the face feels balanced instead of longer.`;
  }

  if (lengthPreference === "long") {
    return `${intro} You can keep it long, but make it intentional: long layers, soft waves, and curtain bangs will look much better than flat one-length hair. The goal is movement and width around the cheekbone area so the face does not read extra long.`;
  }

  return `${intro} The sweetest spot is usually a collarbone or medium length cut with layers, soft waves, or curtain bangs, because that adds width and softness. If you love length, keep it layered and airy; if you want shorter, a textured bob or lob is usually more flattering than going very cropped.`;
}

function buildLengthAdvice(profile, lengthPreference) {
  const shape = profile.faceShape || null;
  const guidance = shape ? FACE_SHAPE_GUIDANCE[shape] : null;

  if (shape === "Oblong" && profile.gender === "female") {
    return buildFemaleOblongReply(lengthPreference);
  }

  if (shape === "Oblong") {
    return "For an oblong face, I would usually steer you away from very long, flat length. Medium lengths with movement, texture, or some fringe tend to balance the face better than keeping everything long and straight.";
  }

  if (guidance && shape) {
    return `For a ${shape.toLowerCase()} face, I'd choose the length that gives you ${guidance.best}. I would avoid ${guidance.avoid}.`;
  }

  return "The best length depends on your face shape, hair texture, and how much styling you want to do. Share those and I can guide you more precisely.";
}

function buildRecommendationReply(profile, options = {}) {
  const styles = getRecommendedStyles(profile, 3);
  const shape = profile.faceShape ? profile.faceShape.toLowerCase() : "face";
  const prefix = options.corrective
    ? "You're right - let me correct that. I'd shift you toward "
    : `For your ${shape} shape, I'd lean toward `;

  if (profile.faceShape === "Oblong" && profile.gender === "female") {
    return buildFemaleOblongReply(options.lengthPreference || null, options.corrective);
  }

  if (styles.length > 0) {
    return `${prefix}${formatStyleList(styles)}${profile.faceShape ? ` This works especially well for ${shape} proportions` : ""}.${profile.gender === "female" ? " If you want, I can narrow that down into softer, more feminine, or more polished options." : " If you want, I can narrow that down by maintenance, vibe, or hair type."}`;
  }

  if (profile.faceShape) {
    const guidance = FACE_SHAPE_GUIDANCE[profile.faceShape];
    return `${prefix}${guidance ? guidance.best : "shapes that balance your features"}. ${guidance ? `I'd avoid ${guidance.avoid}.` : ""} Tell me whether you want something softer, sharper, shorter, or lower-maintenance and I'll make it more specific.`;
  }

  return "Tell me your face shape, hair type, and whether you want something soft, edgy, short, or low-maintenance, and I'll give you a much more tailored set of styles.";
}

function buildCorrectionReply(profile, previousAssistantMessage) {
  const hadMasculineMiss =
    /\b(pompadour|side part|caesar|fade|quiff|slick back|undercut)\b/i.test(previousAssistantMessage);

  if (profile.gender === "female" && profile.faceShape === "Oblong") {
    return buildFemaleOblongReply(null, true);
  }

  if (profile.gender === "female") {
    const recommended = formatStyleList(getRecommendedStyles(profile, 3));
    return `You're right - let me correct that. For you, I'd lean more toward ${recommended || "soft layers, face-framing pieces, and movement around the cheek and jaw area"} so it still suits your features without feeling masculine. If you want, I can narrow it into short, medium, or long options next.`;
  }

  if (hadMasculineMiss) {
    return "You're right to call that out. Let me reset and tailor it more carefully to you - tell me whether you want something softer, longer, shorter, or more androgynous, and I'll refine it properly.";
  }

  return buildRecommendationReply(profile, { corrective: true });
}

function buildProductReply(profile) {
  const hairType = profile.hairType ? profile.hairType.toLowerCase() : "hair";
  return `For ${hairType}, I'd usually start with a gentle cleanser, a richer conditioner, and one styling product matched to your finish goal. If frizz is the issue, go for smoothing or anti-humidity products; if definition matters more, a curl cream, mousse, or lightweight gel usually works better. Tell me your exact hair type and main concern and I can narrow this down into a simple routine.`;
}

function buildCareReply(profile) {
  return `A simple salon-approved routine would be trims every 8 to 12 weeks, a cleanser and conditioner matched to your hair type, and one treatment for your main concern like dryness, frizz, or damage. If your hair is ${profile.hairType ? profile.hairType.toLowerCase() : "notably textured or dry"}, I'd also add a weekly mask or leave-in. If you tell me what your hair currently feels like, I can make that much more specific.`;
}

function buildFallbackReply(messages) {
  const latestMessage = getLatestUserMessage(messages);
  const previousAssistantMessage = getPreviousAssistantMessage(messages);

  if (!latestMessage) {
    return "I'm here to help with cuts, colour direction, care routines, and salon-ready style advice. Tell me your face shape, hair type, or the look you're aiming for and I'll narrow it down properly.";
  }

  if (!isHairTopic(latestMessage)) {
    return OFF_TOPIC_RESPONSE;
  }

  const profile = extractProfile(messages);
  const lower = latestMessage.toLowerCase();
  const lengthPreference = inferLengthPreference(latestMessage);

  if (isCorrectionMessage(latestMessage)) {
    return buildCorrectionReply(profile, previousAssistantMessage);
  }

  if (lengthPreference === "compare" || /\bshould i\b/.test(lower)) {
    return buildLengthAdvice(profile, lengthPreference);
  }

  if (/(product|shampoo|conditioner|serum|mask|routine)/.test(lower)) {
    return buildProductReply(profile);
  }

  if (/(trim|maintenance|maintain|care|frizz|dry|damage|breakage|scalp)/.test(lower)) {
    return buildCareReply(profile);
  }

  if (profile.faceShape && isRecommendationIntent(lower)) {
    return buildRecommendationReply(profile, { lengthPreference });
  }

  if (profile.faceShape) {
    return "Got your face shape noted. What would you like help with next - products, styling, care, or a haircut direction?";
  }

  return "Tell me your hair type, main concern, and the finish you want, and I'll give you practical salon-real advice instead of generic tips.";
}

function shouldPreferCuratedReply(messages) {
  const latestMessage = getLatestUserMessage(messages);
  if (!latestMessage) return true;
  if (!isHairTopic(latestMessage)) return true;

  const lengthPreference = inferLengthPreference(latestMessage);

  return Boolean(
    isCorrectionMessage(latestMessage) ||
      lengthPreference ||
      !isHairTopic(latestMessage)
  );
}

function buildModelDirective(messages) {
  const latestMessage = getLatestUserMessage(messages);
  const previousAssistantMessage = getPreviousAssistantMessage(messages);
  const profile = extractProfile(messages);
  const notes = [];

  if (profile.faceShape) notes.push(`Remember the user's face shape is ${profile.faceShape}.`);
  if (profile.hairType) notes.push(`Remember the user's hair type is ${profile.hairType}.`);
  if (profile.gender) notes.push(`Remember the user identifies as ${profile.gender}.`);
  if (profile.lifestyle) notes.push(`Remember the user's lifestyle is ${profile.lifestyle}.`);
  if (isCorrectionMessage(latestMessage)) {
    notes.push("The latest user message is a correction. Acknowledge the miss and revise the previous recommendation directly.");
  }
  if (profile.gender === "female" && profile.faceShape === "Oblong") {
    notes.push("Avoid masculine haircut lists. Prefer long layers, curtain bangs, soft lobs, and movement around the cheeks or jaw.");
  }
  if (/\bshould i\b/i.test(latestMessage) || inferLengthPreference(latestMessage)) {
    notes.push("Answer the length decision directly before listing style ideas.");
  }
  if (previousAssistantMessage) {
    notes.push("Stay consistent with the earlier conversation instead of resetting to generic help text.");
  }

  if (notes.length === 0) return null;
  return { role: "system", content: notes.join(" ") };
}

function buildModelMessages(messages) {
  const directive = buildModelDirective(messages);
  return directive
    ? [{ role: "system", content: SYSTEM_PROMPT }, directive, ...messages]
    : [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
}

function responseLooksOffTarget(reply, messages) {
  const latestMessage = getLatestUserMessage(messages);
  const profile = extractProfile(messages);
  const text = String(reply || "").toLowerCase();

  if (!text.trim()) return true;

  if (isHairTopic(latestMessage) && /i can help with cuts, colour direction/i.test(reply)) {
    return true;
  }

  if (profile.gender === "female" && /(pompadour|caesar cut|side part|quiff|slick back)/i.test(reply)) {
    return true;
  }

  if (isCorrectionMessage(latestMessage) && /tell me your face shape, hair type/i.test(text)) {
    return true;
  }

  return false;
}

function providerError(message = "Chat provider unavailable", status = 503) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function shouldRetryStatus(status) {
  return [408, 409, 429, 500, 502, 503, 504].includes(status);
}

function cleanProviderMessage(status) {
  if (status === 429) return "Chat is temporarily busy. Please try again shortly.";
  if (status === 401 || status === 403) return "Chat provider is not configured correctly.";
  return "Chat is temporarily unavailable. Please try again shortly.";
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function postGroqJson(messages) {
  const url = `${config.pythonSidecarUrl.replace(/\/+$/, "")}/chat`;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        if (shouldRetryStatus(response.status) && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
          continue;
        }
        throw providerError(cleanProviderMessage(response.status), response.status);
      }

      const data = await response.json();
      return String(data.message || "").trim();
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError") {
        lastError = providerError("Chat provider timed out.", 504);
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
        continue;
      }
    }
  }

  throw lastError || providerError();
}

async function streamGroq(messages, onChunk) {
  const url = `${config.pythonSidecarUrl.replace(/\/+$/, "")}/chat/stream`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok || !response.body) {
    throw providerError(cleanProviderMessage(response.status), response.status);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const line = event
        .split(/\r?\n/)
        .find((entry) => entry.startsWith("data:"));
      if (!line) continue;

      const raw = line.replace(/^data:\s*/, "");
      if (!raw || raw === "[DONE]") continue;

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }

      if (payload.error) {
        throw providerError("Chat is temporarily unavailable. Please try again shortly.", 503);
      }

      if (payload.chunk) {
        fullResponse += payload.chunk;
        onChunk(payload.chunk);
      }
    }
  }

  return fullResponse.trim();
}

function shouldUseFallback(error) {
  return Boolean(
    error &&
    (error.name === "AbortError" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ECONNABORTED" ||
      error.status >= 500 ||
      /groq|connect|fetch failed|timeout|temporarily unavailable/i.test(String(error.message || "")))
  );
}

async function chat(messages) {
  if (LLM_DISABLED) {
    return buildFallbackReply(messages);
  }

  if (shouldPreferCuratedReply(messages)) {
    return buildFallbackReply(messages);
  }

  try {
    const reply = await postGroqJson(buildModelMessages(messages));
    if (responseLooksOffTarget(reply, messages)) {
      return buildFallbackReply(messages);
    }

    return reply;
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    return buildFallbackReply(messages);
  }
}

function fallbackFaceShapeRecommendations(faceShape) {
  return getRecommendations(faceShape, "female", 3).map((cut) => `${cut.name}: ${cut.why}`);
}

function parseRecommendationLines(content) {
  return String(content || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

async function recommendStylesForFaceShape(faceShape) {
  const shape = normalizeFaceShape(faceShape);
  if (!shape) return [];
  if (LLM_DISABLED) return fallbackFaceShapeRecommendations(shape);

  const prompt = `Recommend 3 hairstyles for a ${shape} face shape. Be concise, one sentence per style.`;

  try {
    const content = await postGroqJson([
        {
          role: "system",
          content:
            "You are a salon hairstyle consultant. Return exactly three concise hairstyle recommendations, one per line.",
        },
        { role: "user", content: prompt },
      ]);

    const parsed = parseRecommendationLines(content);
    return parsed.length > 0 ? parsed : fallbackFaceShapeRecommendations(shape);
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    return fallbackFaceShapeRecommendations(shape);
  }
}

async function chatStream(messages, onChunk) {
  if (!LLM_DISABLED && !shouldPreferCuratedReply(messages)) {
    try {
      const streamedReply = await streamGroq(buildModelMessages(messages), onChunk);
      return streamedReply || buildFallbackReply(messages);
    } catch (error) {
      if (!shouldUseFallback(error)) throw error;
    }
  }

  const finalReply = await chat(messages);
  const chunks = finalReply.match(/.{1,100}(\s|$)/g) || [finalReply];
  let fullResponse = "";

  for (const chunk of chunks) {
    fullResponse += chunk;
    onChunk(chunk);
  }

  return fullResponse;
}

function buildContextMessage(userProfile, userMessage) {
  const messages = [];

  if (userProfile && Object.keys(userProfile).length > 0) {
    const { faceShape, hairType, gender, lifestyle } = userProfile;
    const contextParts = [];

    if (faceShape) contextParts.push(`Face shape: ${faceShape}`);
    if (hairType) contextParts.push(`Hair type: ${hairType}`);
    if (gender) contextParts.push(`Gender: ${gender}`);
    if (lifestyle) contextParts.push(`Lifestyle: ${lifestyle}`);

    if (contextParts.length > 0) {
      messages.push({
        role: "system",
        content: `User profile context: ${contextParts.join(", ")}. Use this to personalize your advice.`,
      });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

module.exports = {
  chat,
  chatStream,
  buildContextMessage,
  recommendStylesForFaceShape,
  __private: {
    extractProfile,
    buildFallbackReply,
    shouldPreferCuratedReply,
    buildModelDirective,
    responseLooksOffTarget,
  },
};
