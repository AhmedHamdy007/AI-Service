const {
  chat,
  __private: {
    extractProfile,
    buildFallbackReply,
    shouldPreferCuratedReply,
    responseLooksOffTarget,
  },
} = require("../src/services/groqChat");

describe("groqChat concierge guidance", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("carries forward face shape and gender from user history", () => {
    const profile = extractProfile([
      {
        role: "user",
        content: "i have an oblong face shape should i cut my hair shorter or keep it long",
      },
      {
        role: "assistant",
        content: "Some earlier reply",
      },
      {
        role: "user",
        content: "bruh these mostly male haircuts im a female!",
      },
    ]);

    expect(profile).toEqual({
      faceShape: "Oblong",
      gender: "female",
    });
  });

  test("builds a feminine oblong recommendation instead of male cuts", () => {
    const reply = buildFallbackReply([
      {
        role: "user",
        content: "i have a oblong face shape should i cut my hair shorter or keep it long im a girl",
      },
    ]);

    expect(reply).toMatch(/oblong face/i);
    expect(reply).toMatch(/collarbone|medium length|long layers|curtain bangs/i);
    expect(reply).toMatch(/textured bob|lob/i);
    expect(reply).not.toMatch(/pompadour|caesar|side part/i);
  });

  test("uses a corrective reply instead of resetting on follow-up", () => {
    const reply = buildFallbackReply([
      {
        role: "user",
        content: "i have a oblong face shape should i cut my hair shorter or keep it long",
      },
      {
        role: "assistant",
        content: "Try a Pompadour, Side Part, or Caesar Cut.",
      },
      {
        role: "user",
        content: "bruh these mostly male haircuts im a female!",
      },
    ]);

    expect(reply).toMatch(/you're right/i);
    expect(reply).toMatch(/long layers|curtain bangs|soft bob|textured lob/i);
    expect(reply).not.toMatch(/tell me your face shape, hair type/i);
  });

  test("lets the model answer direct face-shape recommendation questions first", () => {
    const messages = [
      {
        role: "user",
        content: "i have a oblong face shape should i cut my hair shorter or keep it long im a girl",
      },
    ];

    expect(shouldPreferCuratedReply(messages)).toBe(true);
  });

  test("does not prefer curated haircut replies for product questions with face-shape context", () => {
    const messages = [
      {
        role: "system",
        content: "User profile context: Face shape: Diamond, Gender: male. Use this to personalize your advice.",
      },
      {
        role: "user",
        content: "what's the best products for definition and volume",
      },
    ];

    expect(shouldPreferCuratedReply(messages)).toBe(false);
    expect(buildFallbackReply(messages)).toMatch(/definition|mousse|gel|curl cream|conditioner/i);
    expect(buildFallbackReply(messages)).not.toMatch(/Slick Back|Bro Flow|Modern Mullet|Wolf Cut|Soft Shag/i);
  });

  test("falls back when Groq returns an off-target masculine answer", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "For an oblong face, try a Pompadour or Caesar Cut.",
      }),
    });

    const reply = await chat([
      {
        role: "system",
        content: "User profile context: Face shape: Oblong, Gender: female. Use this to personalize your advice.",
      },
      {
        role: "user",
        content: "What haircut suits me best?",
      },
    ]);

    expect(responseLooksOffTarget("For an oblong face, try a Pompadour or Caesar Cut.", [
      {
        role: "system",
        content: "User profile context: Face shape: Oblong, Gender: female. Use this to personalize your advice.",
      },
      {
        role: "user",
        content: "What haircut suits me best?",
      },
    ])).toBe(true);
    expect(reply).toMatch(/long layers|curtain bangs|soft bob|textured lob/i);
  });
});
