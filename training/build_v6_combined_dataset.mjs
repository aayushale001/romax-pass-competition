import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sources = {
  "curated-v4": {
    filePrefix: "card_design_v4",
    scenarios: "card_design_v4_scenarios.json",
    report: "card_design_v4_report.json",
  },
  "scenario-v5": {
    filePrefix: "card_design_scenario_v5",
    scenarios: "card_design_scenario_v5_scenarios.json",
    report: "card_design_scenario_v5_report.json",
  },
};
const expectedCounts = { train: 5000, validation: 500, test: 500 };
const lockedFields = ["name", "memberId", "qrCode"];
const tokenBudget = 640;

function hashInt(value) {
  return Number.parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function deterministicShuffle(values, seed) {
  return [...values]
    .map((value) => ({
      value,
      order: hashInt(`${seed}:${value.messages[1].content}`),
    }))
    .sort((left, right) => left.order - right.order)
    .map(({ value }) => value);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  return (await readFile(filePath, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function normalizedPrompt(row) {
  return row.messages[1].content.toLowerCase().replace(/\s+/g, " ").trim();
}

function validateConcept(concept) {
  if (!concept?.id || !concept?.designTokens || !Array.isArray(concept.requiredFields)) {
    throw new Error("Combined dataset contains an invalid expected concept");
  }
  for (const field of lockedFields) {
    if (!concept.requiredFields.includes(field)) throw new Error(`Missing locked field ${field}`);
  }
  if (!concept.designTokens.usesQr) throw new Error("Expected concept does not use QR");
  if (concept.designTokens.usesPhoto !== concept.requiredFields.includes("photo")) {
    throw new Error("Photo flag mismatch");
  }
  if (concept.designTokens.usesDecorativeArt !== concept.requiredFields.includes("decorativeArt")) {
    throw new Error("Decorative-art flag mismatch");
  }
}

function promptTokens(text) {
  return new Set(text.toLowerCase().match(/[a-z0-9-]+/g) ?? []);
}

function jaccard(left, right) {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function maximumCrossSourceSimilarity(leftScenarios, rightScenarios) {
  let maximum = { score: 0, left: "", right: "" };
  const rightTokens = rightScenarios.map((scenario) => ({
    scenario,
    tokens: promptTokens(scenario.prompt),
  }));
  for (const left of leftScenarios) {
    const leftTokens = promptTokens(left.prompt);
    for (const right of rightTokens) {
      const score = jaccard(leftTokens, right.tokens);
      if (score > maximum.score) {
        maximum = {
          score,
          left: left.key,
          right: right.scenario.key,
        };
      }
    }
  }
  return maximum;
}

function countBy(values, getter) {
  const counts = {};
  for (const value of values) {
    const key = getter(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function validateSplits(splits) {
  const prompts = new Set();
  const ids = new Set();
  const brandSets = {};
  const scenarioSets = {};

  for (const [split, rows] of Object.entries(splits)) {
    if (rows.length !== expectedCounts[split]) {
      throw new Error(`${split} expected ${expectedCounts[split]} rows, found ${rows.length}`);
    }
    const sourceCounts = countBy(rows, (row) => row.metadata.source);
    if (Object.values(sourceCounts).some((count) => count !== expectedCounts[split] / 2)) {
      throw new Error(`${split} is not evenly balanced across sources`);
    }
    brandSets[split] = new Set(rows.map((row) => row.metadata.brand));
    scenarioSets[split] = new Set(rows.map((row) => row.metadata.combinedScenarioKey));
    for (const row of rows) {
      const prompt = normalizedPrompt(row);
      const id = row.metadata.expected.id;
      if (prompts.has(prompt)) throw new Error("Duplicate full prompt in combined dataset");
      if (ids.has(id)) throw new Error(`Duplicate expected ID in combined dataset: ${id}`);
      prompts.add(prompt);
      ids.add(id);
      validateConcept(row.metadata.expected);
    }
  }

  const splitNames = Object.keys(splits);
  for (let leftIndex = 0; leftIndex < splitNames.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < splitNames.length; rightIndex += 1) {
      const left = splitNames[leftIndex];
      const right = splitNames[rightIndex];
      if ([...brandSets[left]].some((brand) => brandSets[right].has(brand))) {
        throw new Error(`Brand leakage between ${left} and ${right}`);
      }
      if ([...scenarioSets[left]].some((scenario) => scenarioSets[right].has(scenario))) {
        throw new Error(`Scenario leakage between ${left} and ${right}`);
      }
    }
  }
}

const tokenCheckScript = `
import json, sys
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("HuggingFaceTB/SmolLM2-135M-Instruct", local_files_only=True)
report = {}
for path in sys.argv[1:]:
    lengths = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            prompt = tokenizer.apply_chat_template(
                row["messages"][:-1], tokenize=False, add_generation_prompt=True
            )
            completion = row["messages"][-1]["content"] + tokenizer.eos_token
            lengths.append(
                len(tokenizer(prompt, add_special_tokens=False).input_ids)
                + len(tokenizer(completion, add_special_tokens=False).input_ids)
            )
    report[path] = {
        "count": len(lengths),
        "max": max(lengths),
        "average": round(sum(lengths) / len(lengths), 1),
        "over640": sum(1 for length in lengths if length > 640),
    }
print(json.dumps(report))
`;

function measureTokenLengths(files) {
  const venvPython = path.resolve(".venv/bin/python");
  const result = spawnSync(existsSync(venvPython) ? venvPython : "python3", ["-", ...files], {
    input: tokenCheckScript,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Combined V6 token check failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

async function writeJsonl(filePath, rows) {
  await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

const dataDir = path.resolve("training/data");
const sourceArtifacts = {};
for (const [source, config] of Object.entries(sources)) {
  sourceArtifacts[source] = {
    scenarios: await readJson(path.join(dataDir, config.scenarios)),
    report: await readJson(path.join(dataDir, config.report)),
    rows: Object.fromEntries(
      await Promise.all(
        Object.keys(expectedCounts).map(async (split) => [
          split,
          await readJsonl(path.join(dataDir, `${config.filePrefix}_${split}.jsonl`)),
        ]),
      ),
    ),
  };
}

const splits = Object.fromEntries(
  Object.keys(expectedCounts).map((split) => [
    split,
    deterministicShuffle(
      Object.entries(sourceArtifacts).flatMap(([source, artifacts]) =>
        artifacts.rows[split].map((row) => ({
          ...row,
          metadata: {
            ...row.metadata,
            source,
            combinedScenarioKey: `${source}:${row.metadata.scenario}`,
          },
        })),
      ),
      `romax-combined-v6:${split}`,
    ),
  ]),
);
validateSplits(splits);

await mkdir(dataDir, { recursive: true });
const outputPaths = {};
for (const [split, rows] of Object.entries(splits)) {
  outputPaths[split] = path.join(dataDir, `card_design_v6_${split}.jsonl`);
  await writeJsonl(outputPaths[split], rows);
}
const rawTokenStats = measureTokenLengths(Object.values(outputPaths));
const tokenStats = Object.fromEntries(
  Object.entries(outputPaths).map(([split, filePath]) => [split, rawTokenStats[filePath]]),
);
if (Object.values(tokenStats).some((stats) => stats.over640 > 0)) {
  throw new Error(`Combined V6 contains examples over the ${tokenBudget}-token budget`);
}

const crossSourceSimilarity = maximumCrossSourceSimilarity(
  sourceArtifacts["curated-v4"].scenarios,
  sourceArtifacts["scenario-v5"].scenarios,
);
const report = {
  version: "combined-v6",
  generatedAt: new Date().toISOString(),
  sources: Object.fromEntries(
    Object.entries(sourceArtifacts).map(([source, artifacts]) => [
      source,
      {
        scenarios: artifacts.scenarios.length,
        examples: Object.values(artifacts.rows).flat().length,
      },
    ]),
  ),
  maximumCrossSourceScenarioPromptJaccardSimilarity: {
    score: Number(crossSourceSimilarity.score.toFixed(3)),
    left: crossSourceSimilarity.left,
    right: crossSourceSimilarity.right,
  },
  splits: Object.fromEntries(
    Object.entries(splits).map(([split, rows]) => [
      split,
      {
        examples: rows.length,
        brands: new Set(rows.map((row) => row.metadata.brand)).size,
        scenarios: new Set(rows.map((row) => row.metadata.combinedScenarioKey)).size,
        sources: countBy(rows, (row) => row.metadata.source),
        tasks: countBy(rows, (row) => row.metadata.task),
        moods: countBy(rows, (row) => row.metadata.expected.mood),
        tokenLengths: tokenStats[split],
      },
    ]),
  ),
  validation: {
    duplicateExamplePrompts: 0,
    duplicateExpectedIds: 0,
    brandLeakageAcrossSplits: 0,
    scenarioLeakageAcrossSplits: 0,
    invalidConcepts: 0,
    examplesOverTokenBudget: 0,
    tokenBudget,
  },
};
await writeFile(
  path.join(dataDir, "card_design_v6_report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log("Combined V6 dataset written.");
console.log("Splits: 5,000 train / 500 validation / 500 final test.");
console.log(
  `Maximum V4-to-V5 scenario prompt similarity: ${report.maximumCrossSourceScenarioPromptJaccardSimilarity.score}.`,
);
