/**
 * Basic unit tests for validation functions.
 * Microsoft best practice: include at least basic test coverage.
 */

const {
  validateFaceShape,
  validateHairType,
  validateGender,
  validateLifestyle,
  validateChatMessage,
  validateImageFile,
  ValidationError,
} = require("../src/utils/validation");

describe("Validation Utilities", () => {
  describe("validateFaceShape", () => {
    it("should accept valid face shapes", () => {
      expect(() => validateFaceShape("Oval")).not.toThrow();
      expect(() => validateFaceShape("Round")).not.toThrow();
      expect(() => validateFaceShape("Diamond")).not.toThrow();
    });

    it("should reject invalid face shapes", () => {
      expect(() => validateFaceShape("InvalidShape")).toThrow(ValidationError);
      expect(() => validateFaceShape("")).toThrow(ValidationError);
      expect(() => validateFaceShape(null)).toThrow(ValidationError);
    });
  });

  describe("validateHairType", () => {
    it("should accept valid hair types", () => {
      expect(validateHairType("Straight")).toBe("Straight");
      expect(validateHairType("Wavy")).toBe("Wavy");
      expect(validateHairType("Curly")).toBe("Curly");
    });

    it("should return null for empty input", () => {
      expect(validateHairType(null)).toBeNull();
      expect(validateHairType(undefined)).toBeNull();
    });

    it("should reject invalid hair types", () => {
      expect(() => validateHairType("Invalid")).toThrow(ValidationError);
    });
  });

  describe("validateGender", () => {
    it("should normalize gender to lowercase", () => {
      expect(validateGender("Male")).toBe("male");
      expect(validateGender("FEMALE")).toBe("female");
    });

    it("should accept valid genders", () => {
      expect(validateGender("male")).toBe("male");
      expect(validateGender("female")).toBe("female");
    });

    it("should reject invalid genders", () => {
      expect(() => validateGender("other")).toThrow(ValidationError);
    });
  });

  describe("validateChatMessage", () => {
    it("should accept valid messages", () => {
      expect(validateChatMessage("Hello world")).toBe("Hello world");
      expect(validateChatMessage("  Trimmed  ")).toBe("Trimmed");
    });

    it("should reject empty messages", () => {
      expect(() => validateChatMessage("")).toThrow(ValidationError);
      expect(() => validateChatMessage("   ")).toThrow(ValidationError);
      expect(() => validateChatMessage(null)).toThrow(ValidationError);
    });

    it("should reject messages exceeding max length", () => {
      const longMessage = "a".repeat(5001);
      expect(() => validateChatMessage(longMessage)).toThrow(ValidationError);
    });
  });

  describe("validateImageFile", () => {
    it("should accept valid image files", () => {
      const file = {
        mimetype: "image/jpeg",
        size: 1024 * 100, // 100KB
      };
      expect(() => validateImageFile(file)).not.toThrow();
    });

    it("should reject non-image files", () => {
      const file = {
        mimetype: "text/plain",
        size: 1024,
      };
      expect(() => validateImageFile(file)).toThrow(ValidationError);
    });

    it("should reject oversized files", () => {
      const file = {
        mimetype: "image/jpeg",
        size: 11 * 1024 * 1024, // 11MB
      };
      expect(() => validateImageFile(file)).toThrow(ValidationError);
    });
  });
});
