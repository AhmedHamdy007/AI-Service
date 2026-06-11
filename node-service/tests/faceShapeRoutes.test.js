require("express-async-errors");

jest.mock("../src/services/sidecarClient", () => ({
  analyzeFaceShape: jest.fn(),
}));

jest.mock("../src/services/groqChat", () => ({
  recommendStylesForFaceShape: jest.fn(),
}));

const express = require("express");
const request = require("supertest");

const { analyzeFaceShape } = require("../src/services/sidecarClient");
const { recommendStylesForFaceShape } = require("../src/services/groqChat");
const errorHandler = require("../src/middleware/errorHandler");
const faceShapeRoutes = require("../src/routes/faceShape.routes");

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.id = "test-request";
    req.logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    next();
  });
  app.use("/api/face-shape", faceShapeRoutes);
  app.use(errorHandler);
  return app;
}

describe("face shape route", () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns ConvNeXt face shape result with hairstyle recommendations", async () => {
    analyzeFaceShape.mockResolvedValue({
      face_detected: true,
      shape: "Oval",
      confidence: 0.87,
      method: "cnn",
      all_scores: {
        Heart: 0.03,
        Oblong: 0.02,
        Oval: 0.87,
        Round: 0.05,
        Square: 0.03,
      },
    });
    recommendStylesForFaceShape.mockResolvedValue([
      "Long layers work beautifully with balanced oval proportions.",
      "A textured bob keeps the look modern and light.",
      "Soft waves add movement without overwhelming the face.",
    ]);

    const response = await request(app)
      .post("/api/face-shape")
      .attach("image", Buffer.from("fake-image"), {
        filename: "face.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    expect(analyzeFaceShape).toHaveBeenCalledWith(expect.any(Buffer), "image/jpeg");
    expect(recommendStylesForFaceShape).toHaveBeenCalledWith("Oval");
    expect(response.body.face_shape).toMatchObject({
      shape: "Oval",
      confidence: 0.87,
      method: "cnn",
      face_detected: true,
    });
    expect(response.body.recommendations).toHaveLength(3);
  });

  test("skips recommendations when no face is detected", async () => {
    analyzeFaceShape.mockResolvedValue({
      face_detected: false,
      shape: null,
      confidence: 0,
      method: null,
      all_scores: {},
    });

    const response = await request(app)
      .post("/api/face-shape")
      .attach("image", Buffer.from("fake-image"), {
        filename: "face.png",
        contentType: "image/png",
      })
      .expect(200);

    expect(recommendStylesForFaceShape).not.toHaveBeenCalled();
    expect(response.body.recommendations).toEqual([]);
    expect(response.body.message).toMatch(/clearer/i);
  });

  test("returns low-confidence CNN result with recommendations when views disagree", async () => {
    analyzeFaceShape.mockResolvedValue({
      face_detected: true,
      shape: "Square",
      confidence: 0.48,
      method: "cnn_low_confidence",
      is_confident: false,
      uncertainty_reason: "cnn_views_disagree",
      all_scores: {
        Heart: 0.01,
        Oblong: 0.01,
        Oval: 0.32,
        Round: 0.18,
        Square: 0.48,
      },
      candidates: [
        { shape: "Square", confidence: 0.48 },
        { shape: "Oval", confidence: 0.32 },
      ],
    });
    recommendStylesForFaceShape.mockResolvedValue([
      "Soft layers can balance stronger square features.",
      "A textured bob keeps the result polished.",
      "Side-swept styling softens the jawline.",
    ]);

    const response = await request(app)
      .post("/api/face-shape")
      .attach("image", Buffer.from("fake-image"), {
        filename: "face.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    expect(recommendStylesForFaceShape).toHaveBeenCalledWith("Square");
    expect(response.body.face_shape).toMatchObject({
      shape: "Square",
      method: "cnn_low_confidence",
      is_confident: false,
      uncertainty_reason: "cnn_views_disagree",
    });
    expect(response.body.recommendations).toHaveLength(3);
    expect(response.body.data.candidates).toHaveLength(2);
  });

  test("returns 503 when the python sidecar is unavailable", async () => {
    const error = new Error("connect refused");
    error.code = "ECONNREFUSED";
    analyzeFaceShape.mockRejectedValue(error);

    const response = await request(app)
      .post("/api/face-shape")
      .attach("image", Buffer.from("fake-image"), {
        filename: "face.webp",
        contentType: "image/webp",
      })
      .expect(503);

    expect(response.body.message).toBe("AI analysis temporarily unavailable");
  });
});
