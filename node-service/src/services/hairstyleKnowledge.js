const {
  MALE_HAIRCUTS,
  FEMALE_HAIRCUTS,
} = require("../data/haircutData");

const toTitleCase = (value) => {
  const text = String(value || "");
  return text.slice(0, 1).toUpperCase() + text.slice(1).toLowerCase();
};

module.exports = [...MALE_HAIRCUTS, ...FEMALE_HAIRCUTS].map((cut) => ({
  ...cut,
  gender: [cut.gender],
  suitableFaceShapes: cut.faceShapes.map(toTitleCase),
  hairTypes: [],
  lifestyles: [],
  description: cut.why,
}));
