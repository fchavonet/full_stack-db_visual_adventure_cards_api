import Ajv from "ajv";
import addFormats from "ajv-formats";
import { parse } from "csv-parse";
import fs from "fs-extra";

const BASE_URL = "https://fchavonet.github.io/web-db_visual_adventure_cards_api/";
const CSV_FILE = "./data/cards.csv";
const SCHEMA_FILE = "./schema/card.schema.json";
const OUTPUT_DIRECTORY = "./api/v1/";
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

/********************
* UTILITY FUNCTIONS *
********************/

// Format card number to a 3-digit string (001, 002, 003, etc...).
export function formatCardNumber(number) {
  const numberAsString = String(number).trim();
  const parsedNumber = Number(numberAsString);

  if (Number.isNaN(parsedNumber)) {
    return null;
  }

  if (parsedNumber < 10) {
    return "00" + String(parsedNumber);
  }

  if (parsedNumber < 100) {
    return "0" + String(parsedNumber);
  }

  return String(parsedNumber);
}

// Create card ID (p1-001, p1-002, p1-003...).
export function createCardId(partNumber, formattedNumber) {
  return "p" + String(partNumber) + "-" + formattedNumber;
}

// Create image relative path.
export function createImagePath(imageType, partNumber, formattedNumber, extension) {
  return "assets/images/" + imageType + "/part_" + String(partNumber) + "-" + formattedNumber + "." + extension;
}

// Create full image URL.
export function createFullImageUrl(baseUrl, imagePath) {
  if (baseUrl.endsWith("/")) {
    return baseUrl + imagePath;
  }

  return baseUrl + "/" + imagePath;
}

// Check if value is valid and not empty.
export function isValidValue(value) {
  if (value === undefined || value === null) {
    return false;
  }

  if (String(value).trim().length === 0) {
    return false;
  }

  return true;
}

/*************************
* API CREATION FUNCTIONS *
*************************/

// Read the CSV file and return data.
export async function readCsvFile(filePath) {
  const fileContent = await fs.readFile(filePath, "utf8");

  return new Promise((resolve, reject) => {
    const allRows = [];
    const csvParser = parse(fileContent, {
      bom: true,
      columns: true,
      trim: true,
      skip_empty_lines: true
    });

    csvParser.on("readable", () => {
      let currentRow;

      while ((currentRow = csvParser.read()) !== null) {
        allRows.push(currentRow);
      }
    });

    csvParser.on("error", (error) => reject(error));
    csvParser.on("end", () => resolve(allRows));
  });
}

// Load JSON schema.
export async function loadJsonSchema() {
  const schemaContent = await fs.readFile(SCHEMA_FILE, "utf8");

  return JSON.parse(schemaContent);
}

// Determines the rarity of the card.
export function determineCardRarity(rarityValue) {
  if (!isValidValue(rarityValue)) {
    return "standard";
  }

  const cleanRarity = String(rarityValue).toLowerCase().trim();

  if (cleanRarity === "standard") {
    return "standard";
  }

  if (cleanRarity === "prism") {
    return "prism";
  }

  if (cleanRarity === "special") {
    return "special";
  }

  return "standard";
}

// Find the path to the image that actually exists.
export async function findExistingImagePath(imageType, partNumber, formattedNumber) {
  for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
    const extension = IMAGE_EXTENSIONS[i];
    const imagePath = createImagePath(imageType, partNumber, formattedNumber, extension);
    const imageExists = await fs.pathExists(imagePath);

    if (imageExists) {
      return { path: imagePath, exists: true };
    }
  }

  const defaultPath = createImagePath(imageType, partNumber, formattedNumber, "png");

  return { path: defaultPath, exists: false };
}

// Convert CSV row to card object.
export async function convertRowToCard(csvRow) {
  const partNumber = String(csvRow.part).trim();

  if (!isValidValue(partNumber)) {
    throw new Error("Invalid part number: " + String(csvRow.part));
  }

  const formattedNumber = formatCardNumber(csvRow.number);

  if (formattedNumber === null) {
    throw new Error("Invalid card number: " + String(csvRow.number));
  }

  const cardId = createCardId(partNumber, formattedNumber);

  const frontImageInfo = await findExistingImagePath("front", partNumber, formattedNumber);
  const backImageInfo = await findExistingImagePath("back", partNumber, formattedNumber);

  const frontImageUrl = createFullImageUrl(BASE_URL, frontImageInfo.path);
  const backImageUrl = createFullImageUrl(BASE_URL, backImageInfo.path);

  const cardObject = {
    id: cardId,
    part: partNumber,
    number: formattedNumber
  };

  if (isValidValue(csvRow.year)) {
    const yearNumber = Number(csvRow.year);

    if (!Number.isNaN(yearNumber) && yearNumber >= 1900) {
      cardObject.year = yearNumber;
    }
  }

  cardObject.rarity = determineCardRarity(csvRow.rarity);

  if (isValidValue(csvRow.title_jp)) {
    cardObject.title_jp = String(csvRow.title_jp);
  } else {
    cardObject.title_jp = "タイトルなし";
  }

  if (isValidValue(csvRow.title_en)) {
    cardObject.title_en = String(csvRow.title_en);
  }

  if (isValidValue(csvRow.title_fr)) {
    cardObject.title_fr = String(csvRow.title_fr);
  }

  cardObject.front_image_url = frontImageUrl;
  cardObject.back_image_url = backImageUrl;

  cardObject.updated_at = new Date().toISOString();

  return {
    card: cardObject,
    frontImageExists: frontImageInfo.exists,
    backImageExists: backImageInfo.exists
  };
}

// Group cards by part number.
export function groupCardsByPart(allCards) {
  const cardsByPart = new Map();

  for (let i = 0; i < allCards.length; i++) {
    const currentCard = allCards[i];
    const partKey = String(currentCard.part);

    if (!cardsByPart.has(partKey)) {
      cardsByPart.set(partKey, []);
    }

    const cardsInThisPart = cardsByPart.get(partKey);
    cardsInThisPart.push(currentCard);
  }

  return cardsByPart;
}

// Write JSON data to file with proper formatting.
export async function writeJsonFile(filePath, dataToWrite) {
  const lastSlashIndex = filePath.lastIndexOf("/");

  if (lastSlashIndex > -1) {
    const directoryPath = filePath.substring(0, lastSlashIndex);
    await fs.ensureDir(directoryPath);
  }

  const prettyJson = JSON.stringify(dataToWrite, null, 2);
  await fs.writeFile(filePath, prettyJson + "\n", "utf8");
}

/**********************
* MAIN BUILD FUNCTION *
**********************/

// Build complete API files structure with validation and statistics.
export async function buildApiFiles() {
  const commandArguments = process.argv.slice(2);
  const isCheckOnlyMode = commandArguments.includes("--check");

  await fs.ensureDir(OUTPUT_DIRECTORY);

  const csvRows = await readCsvFile(CSV_FILE);

  const allBuiltCards = [];
  let totalWarnings = 0;

  for (let i = 0; i < csvRows.length; i++) {
    const currentRow = csvRows[i];
    const cardInfo = await convertRowToCard(currentRow);

    if (!cardInfo.frontImageExists) {
      console.warn("WARNING: " + cardInfo.card.id + " front image missing -> " + cardInfo.card.front_image_url);
      totalWarnings = totalWarnings + 1;
    }

    if (!cardInfo.backImageExists) {
      console.warn("WARNING: " + cardInfo.card.id + " back image missing -> " + cardInfo.card.back_image_url);
      totalWarnings = totalWarnings + 1;
    }

    allBuiltCards.push(cardInfo.card);
  }

  const jsonSchema = await loadJsonSchema();
  const ajvValidator = new Ajv({ allErrors: true, strict: false });
  addFormats(ajvValidator);
  const validateCard = ajvValidator.compile(jsonSchema);

  for (let i = 0; i < allBuiltCards.length; i++) {
    const currentCard = allBuiltCards[i];
    const isValid = validateCard(currentCard);

    if (!isValid) {
      console.error("Validation error for " + currentCard.id + ": " + JSON.stringify(validateCard.errors));
      process.exit(1);
    }
  }

  if (isCheckOnlyMode) {
    console.log("Verification completed.");
    if (totalWarnings > 0) {
      console.log("Warnings: " + String(totalWarnings));
    }
    return;
  }

  await writeJsonFile(OUTPUT_DIRECTORY + "/cards.json", allBuiltCards);

  const cardsByPart = groupCardsByPart(allBuiltCards);

  const cardsByPartEntries = Array.from(cardsByPart.entries());
  for (let i = 0; i < cardsByPartEntries.length; i++) {
    const partNumber = cardsByPartEntries[i][0];
    const cardsInPart = cardsByPartEntries[i][1];

    await writeJsonFile(OUTPUT_DIRECTORY + "/parts/" + partNumber + ".json", cardsInPart);
  }

  for (let i = 0; i < allBuiltCards.length; i++) {
    const currentCard = allBuiltCards[i];

    await writeJsonFile(OUTPUT_DIRECTORY + "/cards/" + currentCard.id + ".json", currentCard);
  }

  const partStatistics = {};

  const cardsByPartEntriesForStats = Array.from(cardsByPart.entries());
  for (let i = 0; i < cardsByPartEntriesForStats.length; i++) {
    const partNumber = cardsByPartEntriesForStats[i][0];
    const cardsInPart = cardsByPartEntriesForStats[i][1];
    let commonYear = null;

    for (let j = 0; j < cardsInPart.length; j++) {
      const currentCard = cardsInPart[j];

      if (typeof currentCard.year === "number") {
        if (commonYear === null) {
          commonYear = currentCard.year;
        } else if (commonYear !== currentCard.year) {
          commonYear = null;
          break;
        }
      }
    }

    partStatistics[partNumber] = {
      total_cards: cardsInPart.length,
      year: commonYear
    };
  }

  const metadataObject = {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    counts: {
      parts: Array.from(cardsByPart.keys()).length,
      cards: allBuiltCards.length
    },
    parts: partStatistics
  };

  await writeJsonFile(OUTPUT_DIRECTORY + "/meta.json", metadataObject);

  if (totalWarnings > 0) {
    console.log("Build completed with " + String(totalWarnings) + " warnings.");
  } else {
    console.log("Build completed successfully.");
  }
}

buildApiFiles().catch((error) => {
  console.error(error);
  process.exit(1);
});
