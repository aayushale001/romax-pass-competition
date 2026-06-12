import { readFile } from "node:fs/promises";

const baseUrl = (process.env.LOCAL_LLM_BASE_URL ?? "http://127.0.0.1:8080/v1").replace(
  /\/+$/,
  "",
);
const model = process.env.LOCAL_LLM_MODEL ?? "card-designer-local";
const jsonSchema = JSON.parse(
  await readFile(
    new URL("../config/local-concept.schema.json", import.meta.url),
    "utf8",
  ),
);

const prompt =
  "id=smoke-test; brand=Smoke Coffee; industry=Coffee loyalty; colors=#2563eb,#111827; tone=modern; assets=logo; direction=minimal official credential, clear QR.";

const startedAt = performance.now();
const response = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content:
          "Return one compact membership-card JSON object. Preserve primaryColor. Include name, memberId, qrCode. usesQr=true.",
      },
      { role: "user", content: prompt },
    ],
    json_schema: jsonSchema,
    max_tokens: Number.parseInt(process.env.LOCAL_LLM_MAX_TOKENS ?? "430", 10),
    temperature: 0.1,
    stream: false,
  }),
});

const elapsedSeconds = (performance.now() - startedAt) / 1000;
const payload = await response.json();

if (!response.ok) {
  throw new Error(`Local server returned ${response.status}: ${JSON.stringify(payload)}`);
}

const raw = payload.choices?.[0]?.message?.content;
if (typeof raw !== "string") {
  throw new Error("Local server response did not contain message.content.");
}

if (payload.choices?.[0]?.finish_reason === "length") {
  throw new Error(
    `Local model output was truncated at ${payload.usage?.total_tokens ?? "the context limit"} tokens. Increase llama-server --ctx-size or reduce LOCAL_LLM_MAX_TOKENS.`,
  );
}

const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start < 0 || end <= start) {
  throw new Error(
    `Local model did not produce a complete JSON object. finish_reason=${payload.choices?.[0]?.finish_reason ?? "unknown"}; output=${JSON.stringify(raw.slice(0, 240))}`,
  );
}

const concept = JSON.parse(raw.slice(start, end + 1));
const requiredKeys = ["id", "name", "mood", "requiredFields", "designTokens"];
for (const key of requiredKeys) {
  if (!(key in concept)) throw new Error(`Concept is missing ${key}.`);
}

if (!Array.isArray(concept.requiredFields)) {
  throw new Error("Concept requiredFields is not an array.");
}

// Production applies these brand-lock repairs before a local concept reaches the UI.
// Mirror that behavior here so the smoke test distinguishes recoverable tiny-model
// variation from an unusable response.
const lockedFields = ["name", "memberId", "qrCode"];
const missingLockedFields = lockedFields.filter(
  (field) => !concept.requiredFields.includes(field),
);
concept.requiredFields = [...new Set([...concept.requiredFields, ...lockedFields])];

const repairedPrimaryColor = concept.designTokens?.primaryColor !== "#2563eb";
const repairedQrLock = concept.designTokens?.usesQr !== true;
concept.designTokens = {
  ...concept.designTokens,
  primaryColor: "#2563eb",
  usesQr: true,
};

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      model,
      elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
      finishReason: payload.choices?.[0]?.finish_reason,
      usage: payload.usage,
      conceptName: concept.name,
      mood: concept.mood,
      requiredFields: [...new Set(concept.requiredFields)],
      repairsApplied: {
        missingLockedFields,
        primaryColor: repairedPrimaryColor,
        qrLock: repairedQrLock,
      },
    },
    null,
    2,
  ),
);
