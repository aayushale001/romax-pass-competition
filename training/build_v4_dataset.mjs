import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { allV4Scenarios } from "./v4_scenario_library.mjs";

const system =
  "Return one compact membership-card JSON object. Preserve primaryColor. Include name, memberId, qrCode. usesQr=true.";
const coreFields = ["name", "memberId", "qrCode"];
const allowedFields = new Set([
  "name", "photo", "email", "phone", "memberId", "tier", "expiryDate",
  "dateJoined", "studentId", "course", "loyaltyPoints", "qrCode", "decorativeArt",
]);
const allowedMoods = new Set([
  "official", "minimal", "premium", "playful", "creative", "cyberpunk",
  "academic", "luxury", "event", "identity",
]);
const allowedTokens = {
  orientation: new Set(["landscape", "portrait"]),
  backgroundMode: new Set(["solid", "gradient", "image", "image-overlay", "pattern"]),
  colorUsage: new Set(["subtle", "balanced", "dominant", "full"]),
  brandAssetSource: new Set(["none", "logo", "hero", "background"]),
  brandAssetTreatment: new Set(["standard", "logo-watermark", "background-emblem", "hero-backdrop", "side-emblem"]),
  brandAssetIntensity: new Set(["subtle", "medium", "bold"]),
};

function hashInt(value) {
  return Number.parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function seededShuffle(values, seed, identity = (value) => JSON.stringify(value)) {
  return [...values]
    .map((value) => ({ value, order: hashInt(`${seed}:${identity(value)}`) }))
    .sort((a, b) => a.order - b.order)
    .map(({ value }) => value);
}

function uniqueFields(fields, removeFields = []) {
  const removed = new Set(removeFields);
  return [...new Set([...coreFields, ...fields])]
    .filter((field) => allowedFields.has(field) && !removed.has(field))
    .slice(0, 8);
}

function assetChoice(brand, preferred) {
  if (brand.assets.includes(preferred)) return preferred;
  if (brand.assets.includes("logo")) return "logo";
  if (brand.assets.includes("hero")) return "hero";
  if (brand.assets.includes("background")) return "background";
  return "none";
}

function compatibleTreatment(source, requested) {
  if (source === "none") return "standard";
  if (source === "logo" && requested === "hero-backdrop") return "background-emblem";
  if ((source === "hero" || source === "background") && requested === "logo-watermark") return "hero-backdrop";
  return requested;
}

function compatibleBackground(source, requested) {
  if (source !== "none" || !["image", "image-overlay"].includes(requested)) return requested;
  return "pattern";
}

function articleFor(word) {
  return /^[aeiou]/i.test(word) ? "An" : "A";
}

function outputFor(brand, scenario, id) {
  const source = assetChoice(brand, scenario.preferredAsset);
  const requiredFields = uniqueFields(
    [
      ...brand.industryFields.slice(0, 2),
      ...scenario.fields,
      ...(scenario.usesPhoto ? ["photo"] : []),
      ...(scenario.usesDecorativeArt ? ["decorativeArt"] : []),
    ],
    scenario.removeFields,
  );

  return {
    id,
    name: `${brand.businessName} ${scenario.mood[0].toUpperCase()}${scenario.mood.slice(1)} Pass`.slice(0, 70),
    description: `${articleFor(scenario.mood)} ${scenario.mood} membership card shaped around ${brand.tone.split(",").slice(0, 2).join(" and ")} brand qualities.`.slice(0, 160),
    mood: scenario.mood,
    requiredFields,
    designTokens: {
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      textColor: ["subtle", "balanced"].includes(scenario.colorUsage) ? "#111827" : "#ffffff",
      orientation: scenario.orientation,
      backgroundMode: compatibleBackground(source, scenario.backgroundMode),
      colorUsage: scenario.colorUsage,
      brandAssetSource: source,
      brandAssetTreatment: compatibleTreatment(source, scenario.treatment),
      brandAssetIntensity: source === "none" ? "subtle" : scenario.intensity,
      usesLogo: brand.assets.includes("logo"),
      usesQr: true,
      usesPhoto: requiredFields.includes("photo"),
      usesDecorativeArt: requiredFields.includes("decorativeArt"),
    },
  };
}

function brandLine(brand) {
  return [
    `brand=${brand.businessName}`,
    `industry=${brand.industry}`,
    `colors=${brand.primaryColor},${brand.secondaryColor}`,
    `tone=${brand.tone}`,
    `assets=${brand.assets.join(",") || "none"}`,
  ].join("; ");
}

function buildCurrentState(brand, scenario, exampleIndex) {
  const moods = ["official", "minimal", "premium", "creative", "identity"];
  const orientations = ["landscape", "portrait"];
  const backgrounds = ["solid", "gradient", "pattern", "image-overlay"];
  return [
    moods[hashInt(`${scenario.key}:mood:${exampleIndex}`) % moods.length],
    orientations[hashInt(`${brand.businessName}:orientation`) % orientations.length],
    backgrounds[hashInt(`${scenario.key}:background`) % backgrounds.length],
    uniqueFields([
      ...brand.industryFields.slice(0, 2),
      ...(hashInt(`${scenario.key}:photo`) % 3 === 0 ? ["photo"] : []),
      ...(hashInt(`${scenario.key}:art`) % 4 === 0 ? ["decorativeArt"] : []),
    ]).join(","),
  ].join(",");
}

function makeExample(brand, scenario, id, exampleIndex) {
  const promptParts = [`id=${id}`, brandLine(brand)];
  if (scenario.task === "refinement") {
    promptParts.push(`current=${buildCurrentState(brand, scenario, exampleIndex)}`);
    promptParts.push(`refine=${scenario.prompt}`);
  } else {
    promptParts.push(`direction=${scenario.prompt}`);
  }
  const expected = outputFor(brand, scenario, id);
  validateConcept(expected);
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: promptParts.join("; ") },
      { role: "assistant", content: JSON.stringify(expected) },
    ],
    metadata: {
      task: scenario.task,
      brand: brand.businessName,
      industry: brand.industry,
      scenario: scenario.key,
      expected,
    },
  };
}

function buildSplit(scenarios, brands, split) {
  const rows = [];
  const orderedBrands = seededShuffle(brands, `${split}-brands`, (brand) => brand.businessName);
  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    for (let expansionIndex = 0; expansionIndex < 10; expansionIndex += 1) {
      const brand = orderedBrands[(scenarioIndex * 7 + expansionIndex * 11) % orderedBrands.length];
      const id = `${split}-${String(scenarioIndex + 1).padStart(3, "0")}-${String(expansionIndex + 1).padStart(2, "0")}`;
      rows.push(makeExample(brand, scenario, id, expansionIndex));
    }
  }
  return rows;
}

function validateConcept(concept) {
  if (!concept.id || !concept.name || !concept.description) throw new Error("Missing text field");
  if (!allowedMoods.has(concept.mood)) throw new Error(`Invalid mood: ${concept.mood}`);
  if (concept.name.length > 70 || concept.description.length > 160) throw new Error("Text too long");
  if (concept.requiredFields.length < 3 || concept.requiredFields.length > 8) throw new Error("Invalid field count");
  if (new Set(concept.requiredFields).size !== concept.requiredFields.length) throw new Error("Duplicate required field");
  for (const field of coreFields) if (!concept.requiredFields.includes(field)) throw new Error(`Missing ${field}`);
  for (const field of concept.requiredFields) if (!allowedFields.has(field)) throw new Error(`Invalid field ${field}`);
  for (const key of ["primaryColor", "secondaryColor", "textColor"]) {
    if (!/^#[0-9a-fA-F]{6}$/.test(concept.designTokens[key])) throw new Error(`Invalid ${key}`);
  }
  for (const [key, allowed] of Object.entries(allowedTokens)) {
    if (!allowed.has(concept.designTokens[key])) throw new Error(`Invalid ${key}`);
  }
  if (!concept.designTokens.usesQr) throw new Error("QR lock missing");
  if (concept.designTokens.usesPhoto !== concept.requiredFields.includes("photo")) throw new Error("Photo mismatch");
  if (concept.designTokens.usesDecorativeArt !== concept.requiredFields.includes("decorativeArt")) throw new Error("Art mismatch");
}

function promptTokens(prompt) {
  return new Set(prompt.toLowerCase().match(/[a-z0-9-]+/g) ?? []);
}

function jaccard(left, right) {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function validateScenarioLibrary() {
  const keys = new Set();
  const prompts = new Set();
  let maximumSimilarity = { score: 0, left: "", right: "" };

  for (const scenario of allV4Scenarios) {
    const normalizedPrompt = scenario.prompt.toLowerCase().replace(/\s+/g, " ").trim();
    if (keys.has(scenario.key)) throw new Error(`Duplicate scenario key: ${scenario.key}`);
    if (prompts.has(normalizedPrompt)) throw new Error(`Duplicate scenario prompt: ${scenario.prompt}`);
    keys.add(scenario.key);
    prompts.add(normalizedPrompt);
  }

  for (let leftIndex = 0; leftIndex < allV4Scenarios.length; leftIndex += 1) {
    const left = allV4Scenarios[leftIndex];
    const leftTokens = promptTokens(left.prompt);
    for (let rightIndex = leftIndex + 1; rightIndex < allV4Scenarios.length; rightIndex += 1) {
      const right = allV4Scenarios[rightIndex];
      const score = jaccard(leftTokens, promptTokens(right.prompt));
      if (score > maximumSimilarity.score) maximumSimilarity = { score, left: left.key, right: right.key };
    }
  }
  if (maximumSimilarity.score >= 0.86) {
    throw new Error(`Scenario prompts too similar: ${JSON.stringify(maximumSimilarity)}`);
  }
  return maximumSimilarity;
}

function validateSplits(scenarioSplits, brandSplits, rowSplits) {
  const promptSet = new Set();
  const idSet = new Set();
  const names = Object.keys(rowSplits);

  for (const [split, rows] of Object.entries(rowSplits)) {
    const uses = new Map();
    for (const row of rows) {
      const prompt = row.messages[1].content.toLowerCase().replace(/\s+/g, " ").trim();
      if (promptSet.has(prompt)) throw new Error("Duplicate full example prompt");
      if (idSet.has(row.metadata.expected.id)) throw new Error("Duplicate expected ID");
      promptSet.add(prompt);
      idSet.add(row.metadata.expected.id);
      uses.set(row.metadata.scenario, (uses.get(row.metadata.scenario) ?? 0) + 1);
      validateConcept(row.metadata.expected);
    }
    if ([...uses.values()].some((count) => count !== 10)) throw new Error(`${split} scenario does not expand exactly ten times`);
  }

  for (let leftIndex = 0; leftIndex < names.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < names.length; rightIndex += 1) {
      const left = names[leftIndex];
      const right = names[rightIndex];
      const leftScenarios = new Set(scenarioSplits[left].map((scenario) => scenario.key));
      const leftBrands = new Set(brandSplits[left].map((brand) => brand.businessName));
      if (scenarioSplits[right].some((scenario) => leftScenarios.has(scenario.key))) throw new Error("Scenario leakage");
      if (brandSplits[right].some((brand) => leftBrands.has(brand.businessName))) throw new Error("Brand leakage");
    }
  }
}

function countBy(values, getter) {
  const result = {};
  for (const value of values) {
    const key = getter(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => a[0].localeCompare(b[0])));
}

function buildScenarioSplits() {
  const result = { train: [], validation: [], test: [] };
  const moods = [...allowedMoods];

  for (const [moodIndex, mood] of moods.entries()) {
    const generation = seededShuffle(
      allV4Scenarios.filter((scenario) => scenario.mood === mood && scenario.task === "generation"),
      `v4-${mood}-generation`,
      (scenario) => scenario.key,
    );
    const refinement = seededShuffle(
      allV4Scenarios.filter((scenario) => scenario.mood === mood && scenario.task === "refinement"),
      `v4-${mood}-refinement`,
      (scenario) => scenario.key,
    );
    const validationGenerationCount = moodIndex % 2 === 0 ? 1 : 2;

    result.train.push(...generation.slice(0, 12), ...refinement.slice(0, 13));
    result.validation.push(
      ...generation.slice(12, 12 + validationGenerationCount),
      ...refinement.slice(13, 14),
    );
    result.test.push(
      ...generation.slice(12 + validationGenerationCount),
      ...refinement.slice(14, 15),
    );
  }

  return result;
}

async function writeJsonl(filePath, rows) {
  await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

const dataDir = path.resolve("training/data");
const brandSplits = JSON.parse(
  await readFile(path.join(dataDir, "card_design_v4_brand_pools.json"), "utf8"),
);
const maximumScenarioSimilarity = validateScenarioLibrary();
const scenarioSplits = buildScenarioSplits();
const rowSplits = {
  train: buildSplit(scenarioSplits.train, brandSplits.train, "train"),
  validation: buildSplit(scenarioSplits.validation, brandSplits.validation, "validation"),
  test: buildSplit(scenarioSplits.test, brandSplits.test, "test"),
};

validateSplits(scenarioSplits, brandSplits, rowSplits);
await mkdir(dataDir, { recursive: true });
await writeJsonl(path.join(dataDir, "card_design_v4_train.jsonl"), rowSplits.train);
await writeJsonl(path.join(dataDir, "card_design_v4_validation.jsonl"), rowSplits.validation);
await writeJsonl(path.join(dataDir, "card_design_v4_test.jsonl"), rowSplits.test);
await writeFile(path.join(dataDir, "card_design_v4_scenarios.json"), `${JSON.stringify(allV4Scenarios, null, 2)}\n`);
await writeFile(
  path.join(dataDir, "card_design_v4_report.json"),
  `${JSON.stringify({
    version: 4,
    generatedAt: new Date().toISOString(),
    totalExamples: Object.values(rowSplits).flat().length,
    totalDistinctScenarios: allV4Scenarios.length,
    examplesPerScenario: 10,
    maximumScenarioPromptJaccardSimilarity: {
      score: Number(maximumScenarioSimilarity.score.toFixed(3)),
      left: maximumScenarioSimilarity.left,
      right: maximumScenarioSimilarity.right,
    },
    splits: Object.fromEntries(Object.keys(rowSplits).map((split) => [split, {
      examples: rowSplits[split].length,
      scenarios: scenarioSplits[split].length,
      brands: brandSplits[split].length,
      tasks: countBy(scenarioSplits[split], (scenario) => scenario.task),
      moods: countBy(scenarioSplits[split], (scenario) => scenario.mood),
    }])),
    validation: {
      duplicateScenarioKeys: 0,
      duplicateScenarioPrompts: 0,
      duplicateExamplePrompts: 0,
      scenarioLeakageAcrossSplits: 0,
      brandLeakageAcrossSplits: 0,
      invalidConcepts: 0,
    },
  }, null, 2)}\n`,
);

console.log("Wrote v4 dataset: 300 distinct authored scenarios expanded exactly 10 times each.");
console.log("Splits: 2,500 train / 250 validation / 250 final test, with scenario and brand isolation.");
