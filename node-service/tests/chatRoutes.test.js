jest.mock("../src/services/groqChat", () => ({
  chat: jest.fn(async (messages) => {
    const latest = [...messages].reverse().find((message) => message.role === "user")?.content || "";

    if (/weather/i.test(latest)) {
      return "I'm best at hair topics! Ask me about care routines, products, or styling and I'll have great advice for you.";
    }

    if (/frizz/i.test(latest)) {
      return "For frizz, use a hydrating conditioner, add a leave-in on damp hair, and finish with a light serum or anti-humidity cream.";
    }

    if (/curly hair/i.test(latest)) {
      return "For curly hair, cleanse gently, condition well, style with curl cream or gel while damp, and dry without rough towel friction.";
    }

    return "For definition and volume, start with a lightweight leave-in, a volumizing mousse at the roots, and a light gel or curl cream through the mid-lengths.";
  }),
  buildContextMessage: jest.requireActual("../src/services/groqChat").buildContextMessage,
}));

const express = require("express");
const request = require("supertest");
const chatRoutes = require("../src/routes/chat.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.id = "test-request";
    req.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };
    next();
  });
  app.use("/api/chat", chatRoutes);
  return app;
}

describe("chat routes StyleSense intent handling", () => {
  const app = buildApp();

  test("greets warmly without recommendation cards", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "hello" })
      .expect(200);

    expect(res.body.data.message).toMatch(/Hey! I'm StyleSense/i);
    expect(res.body.data.message).not.toMatch(/only able to help/i);
    expect(res.body.data.hasRecommendations).toBe(false);
  });

  test("handles conversational greetings without restriction text", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "hi how are you" })
      .expect(200);

    expect(res.body.data.message).toMatch(/StyleSense/i);
    expect(res.body.data.message).not.toMatch(/only able to help/i);
    expect(res.body.data.hasRecommendations).toBe(false);
  });

  test.each([
    ["my hair is really frizzy what should I do", /frizz|hydrating|leave-in/i],
    ["how do I maintain curly hair", /curly hair|curl cream|gel/i],
  ])("keeps normal hair advice in conversation mode for %s", async (message, expected) => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message })
      .expect(200);

    expect(res.body.data.message).toMatch(expected);
    expect(res.body.data.hasRecommendations).toBe(false);
    expect(res.body.data.recommendations).toBeUndefined();
  });

  test("sends product questions to conversational chat without cards", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        message: "what's the best products for definition and volume",
        sessionFaceShape: "Diamond",
        sessionGender: "male",
      })
      .expect(200);

    expect(res.body.data.message).toMatch(/definition and volume/i);
    expect(res.body.data.hasRecommendations).toBe(false);
    expect(res.body.data.recommendations).toBeUndefined();
  });

  test("uses male recommendations when the message says male diamond face shape", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "recommend me a haircut for a male with diamond face shape" })
      .expect(200);

    expect(res.body.data.hasRecommendations).toBe(true);
    expect(res.body.data.detectedGender).toBe("male");
    expect(res.body.data.detectedFaceShape).toBe("Diamond");
    expect(res.body.data.recommendations.map((cut) => cut.name)).toEqual([
      "Slick Back",
      "Bro Flow",
      "Modern Mullet",
    ]);
  });

  test("uses female recommendations when the message says oval face female", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "what haircut suits an oval face female" })
      .expect(200);

    expect(res.body.data.hasRecommendations).toBe(true);
    expect(res.body.data.detectedGender).toBe("female");
    expect(res.body.data.recommendations.map((cut) => cut.name)).toEqual([
      "Long Bob",
      "Butterfly Cut",
      "Bixie Cut",
    ]);
  });

  test("asks for face shape when recommendation request has no context", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "recommend me a haircut" })
      .expect(200);

    expect(res.body.data.hasRecommendations).toBe(false);
    expect(res.body.data.suggestFaceScan).toBe(true);
    expect(res.body.data.message).toMatch(/What's your face shape/i);
  });

  test("asks for gender when face shape is known but gender is missing", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "recommend me a haircut for diamond face" })
      .expect(200);

    expect(res.body.data.hasRecommendations).toBe(false);
    expect(res.body.data.needsGender).toBe(true);
    expect(res.body.data.message).toMatch(/men's or women's/i);
  });

  test("redirects non-hair questions through chat without cards", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "what's the weather like" })
      .expect(200);

    expect(res.body.data.message).toMatch(/best at hair topics/i);
    expect(res.body.data.hasRecommendations).toBe(false);
  });
});
