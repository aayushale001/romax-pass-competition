import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberFieldKey,
} from "@/types/card";
import {
  conceptSystemPrompt,
  buildConceptPrompt,
  buildRefinePrompt,
} from "@/lib/aiPrompts";
import {
  conceptIntentSchema,
  conceptsResponseSchema,
  refineConceptResponseSchema,
} from "@/lib/schemas";
import {
  createFallbackDesigns,
  locallyRefineGeneratedDesign,
  normalizeGeneratedDesignList,
} from "@/lib/fallbackDesigns";
import { normalizeGeneratedDesign } from "@/lib/generatedCardSafety";
import localConceptJsonSchema from "@/config/local-concept.schema.json";

export type AiProviderSource = "ai" | "local" | "fallback";
type AiProviderMode = "auto" | "openai" | "local" | "fallback";

const LOCAL_DIRECTIONS = [
  {
    slug: "official",
    instruction:
      "Create an official verification credential with restrained branding and a very clear QR area.",
    requiredFields: ["tier", "expiryDate"],
    designTokens: {
      orientation: "landscape",
      backgroundMode: "solid",
      colorUsage: "balanced",
      usesPhoto: false,
      usesDecorativeArt: false,
    },
  },
  {
    slug: "premium",
    instruction:
      "Create a premium brand-immersive card with dominant color and an elevated visual hierarchy.",
    requiredFields: ["tier", "loyaltyPoints"],
    designTokens: {
      orientation: "portrait",
      backgroundMode: "gradient",
      colorUsage: "full",
      usesPhoto: false,
      usesDecorativeArt: false,
    },
  },
  {
    slug: "identity",
    instruction:
      "Create a photo-led identity card. Include photo in requiredFields and set usesPhoto true.",
    requiredFields: ["photo", "tier"],
    designTokens: {
      orientation: "portrait",
      backgroundMode: "solid",
      colorUsage: "balanced",
      usesPhoto: true,
      usesDecorativeArt: false,
    },
  },
  {
    slug: "creative",
    instruction:
      "Create a bold creative access card with decorative art and a large scan area.",
    requiredFields: ["decorativeArt", "tier"],
    designTokens: {
      orientation: "landscape",
      backgroundMode: "pattern",
      colorUsage: "dominant",
      usesPhoto: false,
      usesDecorativeArt: true,
    },
  },
] as const;

const LOCAL_SYSTEM_PROMPT =
  "Return one compact membership-card JSON object. Preserve primaryColor. Include name, memberId, qrCode. usesQr=true.";

const SURGICAL_VISUAL_REMOVAL_PATTERN =
  /(?:remove|delete|hide|without|no)\s+(?:the\s+)?(?:(?:member\s+)?(?:photo|portrait|picture|headshot|selfie)|(?:decorative\s+)?(?:art|artwork|illustration|avatar|character)|(?:background\s+image|background|backdrop))/gi;

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
}

function configuredProvider(): Exclude<AiProviderMode, "auto"> {
  const requested = (process.env.AI_PROVIDER ?? "auto").toLowerCase();

  if (requested === "openai" || requested === "local" || requested === "fallback") {
    return requested;
  }

  if (process.env.LOCAL_LLM_BASE_URL) return "local";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "fallback";
}

function localBaseUrl() {
  const value = (process.env.LOCAL_LLM_BASE_URL ?? "http://127.0.0.1:8080/v1").replace(
    /\/+$/,
    "",
  );
  return value.endsWith("/v1") ? value : `${value}/v1`;
}

function compactLocalBrandLine(brand: BrandProfile) {
  const tones = brand.brandTone.slice(0, 3).join(",");
  const assets = [
    brand.logoUrl ? "logo" : "",
    brand.selectedHeroImageUrl ? "hero" : "",
    brand.selectedBackgroundImageUrl ? "background" : "",
  ]
    .filter(Boolean)
    .join(",");

  return [
    `brand=${brand.businessName.slice(0, 60)}`,
    `industry=${brand.industry.slice(0, 50)}`,
    `colors=${brand.primaryColor},${brand.secondaryColor}`,
    `tone=${tones || "modern"}`,
    `assets=${assets || "none"}`,
  ].join("; ");
}

function buildLocalConceptPrompt(
  brand: BrandProfile,
  direction: (typeof LOCAL_DIRECTIONS)[number],
  index: number,
) {
  return [
    `id=local-${direction.slug}-${index + 1}`,
    compactLocalBrandLine(brand),
    `direction=${direction.instruction}`,
  ].join("; ");
}

function buildLocalRefinePrompt(
  brand: BrandProfile,
  concept: GeneratedCardDesign,
  instruction: string,
) {
  return [
    `id=${concept.id}`,
    compactLocalBrandLine(brand),
    `current=mood:${concept.mood},orientation:${concept.designTokens.orientation ?? "landscape"},background:${concept.designTokens.backgroundMode},colorUsage:${concept.designTokens.colorUsage},assetSource:${concept.designTokens.brandAssetSource ?? "none"},assetTreatment:${concept.designTokens.brandAssetTreatment ?? "standard"},assetIntensity:${concept.designTokens.brandAssetIntensity ?? "subtle"},photo:${concept.designTokens.usesPhoto},art:${concept.designTokens.usesDecorativeArt},fields:${concept.requiredFields.join(",")}`,
    "preserve=keep every current value unless the refine instruction explicitly changes it",
    `refine=${instruction.slice(0, 220)}`,
  ].join("; ");
}

function isSurgicalVisualRemoval(instruction: string) {
  const lower = instruction.toLowerCase();
  if (!SURGICAL_VISUAL_REMOVAL_PATTERN.test(lower)) return false;

  SURGICAL_VISUAL_REMOVAL_PATTERN.lastIndex = 0;
  const remainder = lower
    .replace(
      /\b(?:keep everything else(?: exactly)?(?: the same)?|do not change anything else|leave everything else(?: the same)?)\b/g,
      " ",
    )
    .replace(SURGICAL_VISUAL_REMOVAL_PATTERN, " ")
    .replace(
      /\b(?:please|just|only|can|could|would|you|i|want|to|from|on|this|the|card|design|layout|it|entirely|completely|and)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  SURGICAL_VISUAL_REMOVAL_PATTERN.lastIndex = 0;
  return remainder.length === 0;
}

function repairLocalDirection(
  design: GeneratedCardDesign,
  brand: BrandProfile,
  direction: (typeof LOCAL_DIRECTIONS)[number],
) {
  const requiredFields = Array.from(
    new Set<MemberFieldKey>([
      ...design.requiredFields,
      ...(direction.requiredFields as readonly MemberFieldKey[]),
      "name",
      "memberId",
      "qrCode",
    ]),
  );

  return normalizeGeneratedDesign(
    {
      ...design,
      mood: direction.slug,
      requiredFields,
      designTokens: {
        ...design.designTokens,
        ...direction.designTokens,
        primaryColor: brand.primaryColor,
        usesLogo: brand.logoMode !== "none",
        usesQr: true,
      },
    },
    brand,
    design,
  );
}

function messageContent(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

function parseJsonObject(raw: string): unknown {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Local model did not return a JSON object.");
  }

  return JSON.parse(clean.slice(start, end + 1));
}

function unwrapConcept(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const object = value as { concept?: unknown; concepts?: unknown[] };
  return object.concept ?? object.concepts?.[0] ?? value;
}

async function localChatJson(prompt: string, maxTokens: number) {
  const timeoutMs = integerEnv("LOCAL_LLM_TIMEOUT_MS", 180_000, 10_000, 600_000);
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.LOCAL_LLM_API_KEY) {
    headers.Authorization = `Bearer ${process.env.LOCAL_LLM_API_KEY}`;
  }

  const basePayload = {
    model: process.env.LOCAL_LLM_MODEL ?? "card-designer-local",
    messages: [
      { role: "system", content: LOCAL_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.15,
    max_tokens: maxTokens,
    stream: false,
  };

  let lastError = "Local model request failed.";
  const constraints = [
    { json_schema: localConceptJsonSchema },
    {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "card_concept",
          strict: true,
          schema: localConceptJsonSchema,
        },
      },
    },
    { response_format: { type: "json_object" } },
  ];

  for (const constraint of constraints) {
    const response = await fetch(`${localBaseUrl()}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...basePayload,
        ...constraint,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      lastError = `Local model returned ${response.status}: ${(await response.text()).slice(0, 300)}`;
      if (response.status === 400) continue;
      throw new Error(lastError);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: unknown };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const choice = payload.choices?.[0];
    if (choice?.finish_reason === "length") {
      const totalTokens = payload.usage?.total_tokens;
      throw new Error(
        `Local model output was truncated${totalTokens ? ` at ${totalTokens} total tokens` : ""}. Increase llama-server --ctx-size or reduce LOCAL_LLM_MAX_TOKENS/prompt size.`,
      );
    }

    const content = messageContent(choice?.message?.content);
    try {
      return parseJsonObject(content);
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Local model returned invalid JSON.";
    }
  }

  throw new Error(lastError);
}

async function generateWithLocalModel(brand: BrandProfile) {
  const count = integerEnv("LOCAL_LLM_CONCEPT_COUNT", 4, 1, LOCAL_DIRECTIONS.length);
  const maxTokens = integerEnv("LOCAL_LLM_MAX_TOKENS", 430, 220, 1000);
  const concepts: GeneratedCardDesign[] = [];
  const fallbacks = createFallbackDesigns(brand);

  for (const [index, direction] of LOCAL_DIRECTIONS.slice(0, count).entries()) {
    try {
      const result = unwrapConcept(
        await localChatJson(buildLocalConceptPrompt(brand, direction, index), maxTokens),
      );
      const parsed = conceptIntentSchema.parse(result);
      concepts.push(
        repairLocalDirection(
          normalizeGeneratedDesign(
            {
              ...parsed,
              id: `local-${direction.slug}-${index + 1}`,
              designTokens: {
                ...parsed.designTokens,
                primaryColor: brand.primaryColor,
                usesQr: true,
              },
            },
            brand,
            fallbacks[index],
          ),
          brand,
          direction,
        ),
      );
    } catch (error) {
      console.error(`Local concept ${direction.slug} failed`, error);
    }
  }

  if (!concepts.length) {
    throw new Error("The local model did not return any valid card concepts.");
  }

  return normalizeGeneratedDesignList(concepts, brand);
}

async function refineWithLocalModel(
  brand: BrandProfile,
  concept: GeneratedCardDesign,
  instruction: string,
) {
  const maxTokens = integerEnv("LOCAL_LLM_MAX_TOKENS", 430, 220, 1000);
  const result = unwrapConcept(
    await localChatJson(buildLocalRefinePrompt(brand, concept, instruction), maxTokens),
  );
  const parsed = conceptIntentSchema.parse(result);
  return locallyRefineGeneratedDesign(
    brand,
    normalizeGeneratedDesign(
      {
        ...parsed,
        id: concept.id,
        designTokens: {
          ...parsed.designTokens,
          primaryColor: brand.primaryColor,
          usesQr: true,
        },
      },
      brand,
      concept,
    ),
    instruction,
  );
}

async function generateWithOpenAi(brand: BrandProfile) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      { role: "system", content: conceptSystemPrompt },
      { role: "user", content: buildConceptPrompt(brand) },
    ],
    text: {
      format: zodTextFormat(conceptsResponseSchema, "card_concepts"),
    },
    temperature: 0.7,
    max_output_tokens: 2200,
  });

  if (!response.output_parsed) {
    throw new Error("AI did not return valid card concepts.");
  }

  return normalizeGeneratedDesignList(response.output_parsed.concepts, brand);
}

async function refineWithOpenAi(
  brand: BrandProfile,
  concept: GeneratedCardDesign,
  instruction: string,
) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      { role: "system", content: conceptSystemPrompt },
      { role: "user", content: buildRefinePrompt(brand, concept, instruction) },
    ],
    text: {
      format: zodTextFormat(refineConceptResponseSchema, "refined_concept"),
    },
    temperature: 0.65,
    max_output_tokens: 1500,
  });

  if (!response.output_parsed) {
    throw new Error("AI did not return a valid generated card design.");
  }

  return normalizeGeneratedDesign(response.output_parsed.concept, brand, concept);
}

export async function generateConfiguredConcepts(brand: BrandProfile): Promise<{
  concepts: GeneratedCardDesign[];
  source: AiProviderSource;
}> {
  const provider = configuredProvider();

  if (provider === "local") {
    try {
      return { concepts: await generateWithLocalModel(brand), source: "local" };
    } catch (error) {
      console.error("Local concept generation failed; using fallback designs", error);
      return { concepts: createFallbackDesigns(brand), source: "fallback" };
    }
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return { concepts: await generateWithOpenAi(brand), source: "ai" };
  }

  return { concepts: createFallbackDesigns(brand), source: "fallback" };
}

export async function refineConfiguredConcept(
  brand: BrandProfile,
  concept: GeneratedCardDesign,
  instruction: string,
): Promise<{ concept: GeneratedCardDesign; source: AiProviderSource }> {
  const provider = configuredProvider();

  // Deletion is a direct editing command, not a request for a new art
  // direction. Keep the existing concept intact and patch only the requested
  // visual slot so a tiny generative model cannot redesign the whole card.
  if (isSurgicalVisualRemoval(instruction)) {
    return {
      concept: locallyRefineGeneratedDesign(brand, concept, instruction),
      source: provider === "local" ? "local" : "fallback",
    };
  }

  if (provider === "local") {
    try {
      return {
        concept: await refineWithLocalModel(brand, concept, instruction),
        source: "local",
      };
    } catch (error) {
      console.error("Local concept refinement failed; using local rules", error);
      return {
        concept: locallyRefineGeneratedDesign(brand, concept, instruction),
        source: "fallback",
      };
    }
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return {
      concept: await refineWithOpenAi(brand, concept, instruction),
      source: "ai",
    };
  }

  return {
    concept: locallyRefineGeneratedDesign(brand, concept, instruction),
    source: "fallback",
  };
}
