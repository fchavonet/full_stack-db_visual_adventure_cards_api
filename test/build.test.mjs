import fs from "fs-extra";
import path from "path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatCardNumber, createCardId, createImagePath, createFullImageUrl, isValidValue } from "../build.mjs";
import { readCsvFile, loadJsonSchema, determineCardRarity, findExistingImagePath, convertRowToCard, groupCardsByPart, writeJsonFile } from "../build.mjs";
import { buildApiFiles } from "../build.mjs";

/********************
* UTILITY FUNCTIONS *
********************/

describe("Utility functions", () => {
  describe("formatCardNumber", () => {
    it("Should format card number to 3-digit string >", () => {
      expect(formatCardNumber(0)).toBe("000");
      expect(formatCardNumber(1)).toBe("001");
      expect(formatCardNumber(42)).toBe("042");
      expect(formatCardNumber(100)).toBe("100");
    });
  });

  describe("createCardId", () => {
    it("Should create card ID (p1-001, p1-002...) >", () => {
      expect(createCardId(1, "000")).toBe("p1-000");
      expect(createCardId(1, "001")).toBe("p1-001");
      expect(createCardId(1, "042")).toBe("p1-042");
      expect(createCardId(3, "100")).toBe("p3-100");
    });
  });

  describe("createImagePath", () => {
    it("Should create image relative path >", () => {
      expect(createImagePath("front", 1, "000", "jpg")).toBe("assets/images/front/part_1-000.jpg");
      expect(createImagePath("front", 1, "001", "jpg")).toBe("assets/images/front/part_1-001.jpg");
      expect(createImagePath("front", 1, "042", "jpg")).toBe("assets/images/front/part_1-042.jpg");
      expect(createImagePath("front", 3, "100", "jpg")).toBe("assets/images/front/part_3-100.jpg");
    });
  });

  describe("createFullImageUrl", () => {
    it("Should create full image URL >", () => {
      const base1 = "https://fchavonet.github.io/web-db_visual_adventure_cards_api";
      const base2 = "https://fchavonet.github.io/web-db_visual_adventure_cards_api/";

      const path1 = "assets/images/front/part_1-000.jpg";
      const path2 = "assets/images/front/part_1-001.jpg";
      const path3 = "assets/images/front/part_1-042.jpg";
      const path4 = "assets/images/front/part_3-100.jpg";

      expect(createFullImageUrl(base1, path1)).toBe("https://fchavonet.github.io/web-db_visual_adventure_cards_api/assets/images/front/part_1-000.jpg");
      expect(createFullImageUrl(base2, path2)).toBe("https://fchavonet.github.io/web-db_visual_adventure_cards_api/assets/images/front/part_1-001.jpg");
      expect(createFullImageUrl(base2, path3)).toBe("https://fchavonet.github.io/web-db_visual_adventure_cards_api/assets/images/front/part_1-042.jpg");
      expect(createFullImageUrl(base2, path4)).toBe("https://fchavonet.github.io/web-db_visual_adventure_cards_api/assets/images/front/part_3-100.jpg");
    });
  });

  describe("isValidValue", () => {
    it("Should check if value is valid and not empty >", () => {
      // Valid values.
      expect(isValidValue("Hello")).toBe(true);
      expect(isValidValue(42)).toBe(true);
      expect(isValidValue(" 0 ")).toBe(true);
      expect(isValidValue(true)).toBe(true);

      // Invalid values.
      expect(isValidValue(undefined)).toBe(false);
      expect(isValidValue(null)).toBe(false);
      expect(isValidValue("")).toBe(false);
      expect(isValidValue("   ")).toBe(false);
    });
  });
});

/*************************
* API CREATION FUNCTIONS *
*************************/

describe("API creation functions", () => {
  describe("readCsvFile", () => {
    it("Should read CSV file and return data >", async () => {
      const testFilePath = path.join(process.cwd(), "test", "sample.csv");
      const csvContent = `part,number,year,title_jp,title_en,title_fr,rarity
1,1,1991,宝ものはいただきだ！,I'll take that treasure!,Je prends ce trésor !,prism`;

      await fs.ensureDir(path.dirname(testFilePath));
      await fs.writeFile(testFilePath, csvContent, "utf8");

      const allRows = await readCsvFile(testFilePath);

      expect(allRows).toEqual([
        {
          part: "1",
          number: "1",
          year: "1991",
          title_jp: "宝ものはいただきだ！",
          title_en: "I'll take that treasure!",
          title_fr: "Je prends ce trésor !",
          rarity: "prism"
        }
      ]);
    });
  });

  describe("loadJsonSchema", () => {
    it("Should load JSON schema >", async () => {
      const schema = await loadJsonSchema();

      expect(schema).toBeTypeOf("object");
      expect(schema).toHaveProperty("$schema");
      expect(schema).toHaveProperty("type");
      expect(schema.type).toBe("object");
    });
  });

  describe("determineCardRarity", () => {
    it("Should determine card rarity >", () => {
      // Invalid or empty values.
      expect(determineCardRarity(null)).toBe("standard");
      expect(determineCardRarity(undefined)).toBe("standard");
      expect(determineCardRarity("")).toBe("standard");
      expect(determineCardRarity(0)).toBe("standard");
      expect(determineCardRarity(false)).toBe("standard");

      // Valid rarity values.
      expect(determineCardRarity("standard")).toBe("standard");
      expect(determineCardRarity("Standard")).toBe("standard");
      expect(determineCardRarity("  STANDARD  ")).toBe("standard");
      expect(determineCardRarity("prism")).toBe("prism");
      expect(determineCardRarity("Prism")).toBe("prism");
      expect(determineCardRarity("  PRISM  ")).toBe("prism");
      expect(determineCardRarity("special")).toBe("special");
      expect(determineCardRarity("Special")).toBe("special");
      expect(determineCardRarity("  SPECIAL  ")).toBe("special");

      // Unknown values default to standard.
      expect(determineCardRarity("promo")).toBe("standard");
      expect(determineCardRarity("other")).toBe("standard");
      expect(determineCardRarity("123")).toBe("standard");
    });
  });

  describe("findExistingImagePath", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("Should find existing image path with fallback extensions >", async () => {
      // Image exists (jpg).
      vi.spyOn(fs, "pathExists").mockResolvedValueOnce(true);
      let result = await findExistingImagePath("front", 1, "001");
      expect(result.path).toBe("assets/images/front/part_1-001.jpg");
      expect(result.exists).toBe(true);

      // No image exists.
      vi.spyOn(fs, "pathExists").mockResolvedValue(false);
      result = await findExistingImagePath("front", 1, "999");
      expect(result.path).toBe("assets/images/front/part_1-999.png");
      expect(result.exists).toBe(false);
    });
  });

  describe("convertRowToCard", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("Should convert CSV row to card object >", async () => {
      vi.spyOn(fs, "pathExists").mockResolvedValue(true);

      const csvRow = {
        part: "1",
        number: "5",
        title_jp: "Test Card JP",
        title_en: "Test Card EN",
        title_fr: "Test Card FR",
        rarity: "prism",
        year: "2025"
      };

      const result = await convertRowToCard(csvRow);

      expect(result.card.id).toBe("p1-005");
      expect(result.card.part).toBe(1);
      expect(result.card.number).toBe("005");
      expect(result.card.title_jp).toBe("Test Card JP");
      expect(result.card.title_en).toBe("Test Card EN");
      expect(result.card.title_fr).toBe("Test Card FR");
      expect(result.card.rarity).toBe("prism");
      expect(result.card.year).toBe(2025);
      expect(result.frontImageExists).toBe(true);
      expect(result.backImageExists).toBe(true);
    });
  });

  describe("groupCardsByPart", () => {
    it("Should group cards by part number >", () => {
      const cards = [
        { id: "p1-001", part: 1, number: "001", title_jp: "Card P1" },
        { id: "p2-050", part: 2, number: "050", title_jp: "Card P2" },
        { id: "p3-100", part: 3, number: "100", title_jp: "Card P3" },
        { id: "p4-150", part: 4, number: "150", title_jp: "Card P4" }
      ];

      const result = groupCardsByPart(cards);

      expect(result.size).toBe(4);
      expect(result.has("1")).toBe(true);
      expect(result.has("2")).toBe(true);
      expect(result.has("3")).toBe(true);
      expect(result.has("4")).toBe(true);

      expect(result.get("1").length).toBe(1);
      expect(result.get("2").length).toBe(1);
      expect(result.get("3").length).toBe(1);
      expect(result.get("4").length).toBe(1);

      expect(result.get("1")[0].id).toBe("p1-001");
      expect(result.get("2")[0].id).toBe("p2-050");
      expect(result.get("3")[0].id).toBe("p3-100");
      expect(result.get("4")[0].id).toBe("p4-150");
    });
  });

  describe("writeJsonFile", () => {
    beforeEach(async () => {
      await fs.emptyDir("./test-output");
    });

    afterEach(async () => {
      await fs.remove("./test-output");
    });

    it("Should write JSON data to file with proper formatting >", async () => {
      const testData = { id: "p1-001", part: 1, title_jp: "Test Card" };
      const filePath = "./test-output/subdir/test.json";

      await writeJsonFile(filePath, testData);

      const fileExists = await fs.pathExists(filePath);
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(filePath, "utf8");
      const parsedData = JSON.parse(fileContent);

      expect(parsedData.id).toBe("p1-001");
      expect(parsedData.part).toBe(1);
      expect(fileContent.endsWith("\n")).toBe(true);
    });
  });
});

/**********************
* MAIN BUILD FUNCTION *
**********************/

describe("Main build function", () => {
  describe("buildApiFiles", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("Should build complete API files structure with validation and statistics >", async () => {
      // Mock console methods.
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });

      // Mock process.exit to prevent actual exit.
      const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => { });

      // Mock file system operations.
      vi.spyOn(fs, "readFile")
        .mockResolvedValueOnce("part,number,year,title_jp,title_en,title_fr,rarity\n1,1,1991,Test,Test,Test,standard")
        .mockResolvedValueOnce('{"$schema":"http://json-schema.org/draft-07/schema#","type":"object"}');

      vi.spyOn(fs, "pathExists").mockResolvedValue(true);
      vi.spyOn(fs, "ensureDir").mockResolvedValue();
      vi.spyOn(fs, "writeFile").mockResolvedValue();

      try {
        // Test basic function existence and type.
        expect(typeof buildApiFiles).toBe("function");

        // Test that function can be called without throwing.
        await buildApiFiles();

        // Verify console output was called (build completion message).
        expect(consoleSpy).toHaveBeenCalled();

      } finally {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
      }
    });
  });
});
