import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const dataPath = args.data ?? "training/data/card_design_v6_test.jsonl";
const limit = Number.parseInt(args.limit ?? "40", 10);
const task = args.task ?? "";
const baseUrl = (args["base-url"] ?? process.env.LOCAL_LLM_BASE_URL ?? "http://127.0.0.1:8080/v1").replace(/\/+$/, "");
const model = args.model ?? process.env.LOCAL_LLM_MODEL ?? "card-designer-local";
const outputPath = args.output ?? "";
const schema = JSON.parse(
  await readFile(new URL("../config/local-concept.schema.json", import.meta.url), "utf8"),
);
const rows = (await readFile(dataPath, "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((row) => !task || row.metadata?.task === task)
  .slice(0, limit);

const categoricalPaths = [
  "mood",
  "designTokens.orientation",
  "designTokens.backgroundMode",
  "designTokens.colorUsage",
  "designTokens.brandAssetSource",
  "designTokens.brandAssetTreatment",
  "designTokens.brandAssetIntensity",
  "designTokens.usesLogo",
  "designTokens.usesQr",
  "designTokens.usesPhoto",
  "designTokens.usesDecorativeArt",
];

function atPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], value);
}

function parseObject(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No complete JSON object");
  return JSON.parse(raw.slice(start, end + 1));
}

function scoreConcept(actual, expected) {
  const lockedFields = ["name", "memberId", "qrCode"];
  const expectedFields = new Set(expected.requiredFields);
  const actualFields = new Set(Array.isArray(actual.requiredFields) ? actual.requiredFields : []);
  const categoricalCorrect = categoricalPaths.filter(
    (key) => atPath(actual, key) === atPath(expected, key),
  ).length;
  const expectedFieldHits = [...expectedFields].filter((field) => actualFields.has(field)).length;
  const lockedFieldHits = lockedFields.filter((field) => actualFields.has(field)).length;
  const checks = {
    id: actual.id === expected.id,
    primaryColor: actual.designTokens?.primaryColor === expected.designTokens.primaryColor,
    lockedFields: lockedFieldHits === lockedFields.length,
    expectedFields: expectedFieldHits === expectedFields.size,
    categorical: categoricalCorrect / categoricalPaths.length,
  };
  const score =
    Number(checks.id) * 0.1 +
    Number(checks.primaryColor) * 0.2 +
    Number(checks.lockedFields) * 0.2 +
    Number(checks.expectedFields) * 0.15 +
    checks.categorical * 0.35;
  return { score, checks };
}

async function generate(row) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: row.messages.slice(0, 2),
      json_schema: schema,
      max_tokens: 430,
      temperature: 0,
      stream: false,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 200)}`);
  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Missing message.content");
  return {
    concept: parseObject(raw),
    seconds: (performance.now() - startedAt) / 1000,
  };
}

const results = [];
for (const [index, row] of rows.entries()) {
  const expected = row.metadata.expected;
  try {
    const { concept, seconds } = await generate(row);
    const scored = scoreConcept(concept, expected);
    results.push({
      index,
      task: row.metadata.task,
      prompt: row.messages[1].content,
      expected,
      actual: concept,
      seconds,
      ...scored,
    });
    console.log(`[${index + 1}/${rows.length}] ${row.metadata.task} ${(scored.score * 100).toFixed(0)}% ${seconds.toFixed(2)}s`);
  } catch (error) {
    results.push({
      index,
      task: row.metadata.task,
      prompt: row.messages[1].content,
      expected,
      error: error instanceof Error ? error.message : String(error),
      score: 0,
    });
    console.log(`[${index + 1}/${rows.length}] ERROR ${results.at(-1).error}`);
  }
}

const successful = results.filter((result) => !result.error);
const report = {
  model,
  baseUrl,
  dataPath,
  evaluated: results.length,
  requestSuccessRate: successful.length / results.length,
  averageScore: results.reduce((sum, result) => sum + result.score, 0) / results.length,
  averageSeconds: successful.reduce((sum, result) => sum + result.seconds, 0) / Math.max(1, successful.length),
  checks: Object.fromEntries(
    ["id", "primaryColor", "lockedFields", "expectedFields"].map((key) => [
      key,
      successful.filter((result) => result.checks?.[key] === true).length / Math.max(1, successful.length),
    ]),
  ),
  categoricalAccuracy:
    successful.reduce((sum, result) => sum + (result.checks?.categorical ?? 0), 0) /
    Math.max(1, successful.length),
  weakest: [...results]
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map(({ index, task, score, error, prompt, checks }) => ({ index, task, score, error, prompt, checks })),
};

console.log("\n" + JSON.stringify(report, null, 2));

if (outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ report, results }, null, 2));
  console.log(`Saved detailed report to ${outputPath}`);
}
