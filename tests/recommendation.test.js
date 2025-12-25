import assert from "assert";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { buildRecommendation, buildAutofillDetails } from "../src/scoring.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadJson = async (relativePath) => {
  const filePath = path.join(__dirname, "..", relativePath);
  const data = await readFile(filePath, "utf-8");
  return JSON.parse(data);
};

const runTests = async () => {
  const [cards, rules, apps] = await Promise.all([
    loadJson("data/cards.json"),
    loadJson("data/rules.json"),
    loadJson("data/apps.json"),
  ]);

  const recommendation = buildRecommendation({
    cards,
    input: {
      amount: 120,
      category: "other",
      merchantApp: "uber",
      location: "San Francisco, CA",
      gpsUnavailable: false,
      usingOtherApp: true,
      platform: "apple",
    },
    rules,
    apps,
  });

  assert.ok(recommendation.topChoice, "Expected a top choice recommendation");
  assert.strictEqual(recommendation.input.category, "travel");
  assert.ok(recommendation.autofill, "Expected autofill details");

  const autofill = buildAutofillDetails(cards[0]);
  assert.match(autofill.maskedPan, /\*\*\*\* \*\*\*\* \*\*\*\* \d{4}/);

  const transit = buildRecommendation({
    cards,
    input: {
      amount: 3,
      category: "other",
      merchantApp: "subway-turnstile",
      location: "New York, NY",
      gpsUnavailable: false,
      usingOtherApp: false,
      platform: "android",
    },
    rules,
    apps,
  });

  assert.strictEqual(transit.input.category, "transit");

  const mandatory = buildRecommendation({
    cards,
    input: {
      amount: 80,
      category: "dining",
      merchantApp: "",
      location: "New York, NY",
      gpsUnavailable: false,
      usingOtherApp: false,
      platform: "android",
    },
    rules,
    apps,
  });

  assert.ok(mandatory.prioritizeMandatory, "Expected mandatory spend prioritization");

  console.log("All tests passed.");
};

runTests();
