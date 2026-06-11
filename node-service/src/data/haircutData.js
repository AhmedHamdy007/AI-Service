const MALE_HAIRCUTS = [
  {
    id: "textured-crop",
    name: "Textured Crop",
    altName: "French Crop",
    gender: "male",
    faceShapes: ["oval", "round", "square", "heart"],
    why: "Adds texture on top; fringe softens sharp features and reduces forehead length.",
    tags: ["trending", "low-maintenance", "versatile"],
    imageUrl: "/assets/haircuts/male-haircuts/french-crop.jpg",
  },
  {
    id: "taper-fade",
    name: "Low Taper Fade",
    altName: "Mid Taper Fade",
    gender: "male",
    faceShapes: ["oval", "round", "square"],
    why: "Clean sides make the face look sharper and more defined.",
    tags: ["clean", "classic", "customizable"],
    imageUrl: "/assets/haircuts/male-haircuts/low-taper-fade.jpeg",
  },
  {
    id: "buzz-cut-lineup",
    name: "Buzz Cut with Line-up",
    altName: "Buzz Cut",
    gender: "male",
    faceShapes: ["oval", "square", "diamond"],
    why: "Highlights jawline and bone structure. Best for confident, low-maintenance clients.",
    tags: ["bold", "low-maintenance", "sharp"],
    imageUrl: "/assets/haircuts/male-haircuts/buzz-cut.jpeg",
  },
  {
    id: "curtain-haircut",
    name: "Curtain Haircut",
    altName: "Middle Part Flow",
    gender: "male",
    faceShapes: ["oval", "oblong", "heart"],
    why: "Adds width around the sides, softens long or narrow faces.",
    tags: ["trending", "retro", "relaxed"],
    imageUrl: "/assets/haircuts/male-haircuts/curtain-haircut.jpeg",
  },
  {
    id: "modern-mullet",
    name: "Modern Mullet",
    altName: "Wolf Cut for Men",
    gender: "male",
    faceShapes: ["oval", "square", "diamond"],
    why: "Adds personality and movement. Fashion-forward statement cut.",
    tags: ["edgy", "trendy", "bold"],
    imageUrl: "/assets/haircuts/male-haircuts/modern-mullet.jpeg",
  },
  {
    id: "slick-back",
    name: "Slick Back",
    altName: "Wet Look",
    gender: "male",
    faceShapes: ["oval", "square", "diamond"],
    why: "Strong, polished style that exposes facial structure.",
    tags: ["polished", "classic", "formal"],
    imageUrl: "/assets/haircuts/male-haircuts/slick-back.jpeg",
  },
  {
    id: "curly-top-fade",
    name: "Curly Top Fade",
    altName: "Curly Fade",
    gender: "male",
    faceShapes: ["round", "square", "oval"],
    why: "Keeps volume on top while controlling the sides. Ideal for curly hair.",
    tags: ["curly", "volume", "clean"],
    imageUrl: "/assets/haircuts/male-haircuts/curly-fade.jpeg",
  },
  {
    id: "bro-flow",
    name: "Bro Flow",
    altName: "Medium Layered Cut",
    gender: "male",
    faceShapes: ["oval", "oblong", "diamond"],
    why: "Natural and relaxed. Matches the trend toward longer, softer styles.",
    tags: ["relaxed", "natural", "effortless"],
    imageUrl: "/assets/haircuts/male-haircuts/curtain-haircut.jpeg",
  },
];

const FEMALE_HAIRCUTS = [
  {
    id: "soft-blunt-bob",
    name: "Soft Blunt Bob",
    altName: "Blunt Bob",
    gender: "female",
    faceShapes: ["oval", "heart", "square", "round"],
    why: "Structured but softer than a sharp bob. Adaptable and on-trend for 2026.",
    tags: ["trending", "chic", "structured"],
    imageUrl: "/assets/haircuts/female-haircuts/soft-blunt-bob.jpeg",
  },
  {
    id: "lob",
    name: "Long Bob",
    altName: "Lob",
    gender: "female",
    faceShapes: ["oval", "round", "square", "heart", "oblong", "diamond"],
    why: "Safe, flattering recommendation for almost every face shape.",
    tags: ["versatile", "classic", "low-maintenance"],
    imageUrl: "/assets/haircuts/female-haircuts/long-bob.jpg",
  },
  {
    id: "butterfly-cut",
    name: "Butterfly Cut",
    altName: "Face-Framing Layers",
    gender: "female",
    faceShapes: ["oval", "square", "oblong"],
    why: "Adds volume and face-framing layers. One of the biggest trends of 2026.",
    tags: ["trending", "volume", "feminine"],
    imageUrl: "/assets/haircuts/female-haircuts/butterfly.jpeg",
  },
  {
    id: "bixie-cut",
    name: "Bixie Cut",
    altName: "Bob-Pixie",
    gender: "female",
    faceShapes: ["oval", "heart", "square"],
    why: "A mix of bob and pixie. Trendy, short, and stylish.",
    tags: ["bold", "short", "trendy"],
    imageUrl: "/assets/haircuts/female-haircuts/Curly_Bixie.jpg",
  },
  {
    id: "soft-shag",
    name: "Soft Shag",
    altName: "Shag Cut",
    gender: "female",
    faceShapes: ["oval", "square", "heart", "round"],
    why: "Adds movement and texture. Customizable to avoid excess width on round faces.",
    tags: ["textured", "relaxed", "layered"],
    imageUrl: "/assets/haircuts/female-haircuts/soft-shag.jpg",
  },
  {
    id: "wolf-cut",
    name: "Wolf Cut",
    altName: "Layered Wolf",
    gender: "female",
    faceShapes: ["oval", "heart", "square", "diamond"],
    why: "Edgy and layered. Volume on top, personality throughout.",
    tags: ["edgy", "volume", "trending"],
    imageUrl: "/assets/haircuts/female-haircuts/wolf-cut.jpg",
  },
  {
    id: "micro-bob",
    name: "Micro Bob",
    altName: "Short Bob",
    gender: "female",
    faceShapes: ["oval", "heart"],
    why: "Highlights cheekbones and jawline. Best for balanced or delicate features.",
    tags: ["chic", "short", "bold"],
    imageUrl: "/assets/haircuts/female-haircuts/micro-bob.jpg",
  },
  {
    id: "birkin-bangs",
    name: "Birkin Bangs",
    altName: "Soft Fringe",
    gender: "female",
    faceShapes: ["oval", "oblong", "heart", "square"],
    why: "Softens forehead and balances longer faces. Works across most face shapes.",
    tags: ["soft", "classic", "flattering"],
    imageUrl: "/assets/haircuts/female-haircuts/birkini-bangs.jpeg",
  },
  {
    id: "midi-cut",
    name: "Midi Cut",
    altName: "Medium Layers",
    gender: "female",
    faceShapes: ["oval", "round", "square", "heart", "oblong", "diamond"],
    why: "Low-risk, low-maintenance. Suitable for any client.",
    tags: ["versatile", "low-maintenance", "natural"],
    imageUrl: "/assets/haircuts/female-haircuts/midi-cut.jpg",
  },
  {
    id: "cowboy-bob",
    name: "Cowboy Bob",
    altName: "Textured Bob",
    gender: "female",
    faceShapes: ["square", "round", "oval"],
    why: "Textured bob with movement. Length adjustable for face shape.",
    tags: ["textured", "trending", "movement"],
    imageUrl: "/assets/haircuts/female-haircuts/cowboy-bob.jpeg",
  },
];

const FACE_SHAPE_RECOMMENDATIONS = {
  oval: {
    male: ["textured-crop", "slick-back", "bro-flow", "curtain-haircut"],
    female: ["lob", "butterfly-cut", "bixie-cut", "wolf-cut"],
  },
  round: {
    male: ["taper-fade", "textured-crop", "curly-top-fade"],
    female: ["lob", "soft-shag", "butterfly-cut"],
  },
  square: {
    male: ["textured-crop", "slick-back", "taper-fade", "modern-mullet"],
    female: ["soft-blunt-bob", "butterfly-cut", "soft-shag"],
  },
  heart: {
    male: ["curtain-haircut", "taper-fade", "textured-crop"],
    female: ["bixie-cut", "lob", "birkin-bangs"],
  },
  oblong: {
    male: ["curtain-haircut", "bro-flow", "taper-fade"],
    female: ["birkin-bangs", "lob", "midi-cut"],
  },
  diamond: {
    male: ["slick-back", "bro-flow", "modern-mullet"],
    female: ["wolf-cut", "soft-shag", "lob"],
  },
};

const getRecommendations = (faceShape, gender, limit = 3) => {
  const shape = faceShape?.toLowerCase();
  const normalizedGender = gender === "male" ? "male" : "female";
  const ids = FACE_SHAPE_RECOMMENDATIONS[shape]?.[normalizedGender] || [];
  const allCuts = normalizedGender === "male" ? MALE_HAIRCUTS : FEMALE_HAIRCUTS;

  const recommended = ids
    .map((id) => allCuts.find((h) => h.id === id))
    .filter(Boolean)
    .slice(0, limit);

  if (recommended.length < limit) {
    const extras = allCuts
      .filter(
        (h) =>
          h.faceShapes.includes(shape) &&
          !recommended.find((r) => r.id === h.id)
      )
      .slice(0, limit - recommended.length);
    recommended.push(...extras);
  }

  return recommended;
};

module.exports = {
  MALE_HAIRCUTS,
  FEMALE_HAIRCUTS,
  FACE_SHAPE_RECOMMENDATIONS,
  getRecommendations,
};
