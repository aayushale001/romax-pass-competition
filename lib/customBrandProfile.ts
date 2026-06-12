import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { buildCustomBrandPrompt, customBrandSystemPrompt } from "@/lib/aiPrompts";
import {
  customBrandProfileIntentSchema,
  type CustomBrandProfileIntent,
} from "@/lib/schemas";
import { getMutedAccent, normalizeHexColor } from "@/lib/colors";
import type {
  BrandColorUsage,
  BrandCreationSource,
  BrandProfile,
  ReferenceImageMode,
  ScrapedAsset,
} from "@/types/card";

type CreateCustomBrandProfileArgs = {
  prompt: string;
  imageDataUrl?: string | null;
  sourceMode?: "prompt" | "physical-card" | "visiting-card";
  referenceImageMode?: ReferenceImageMode;
};

const fallbackColors = [
  "#2563eb",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#16a34a",
  "#ea580c",
];

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function fallbackName(prompt: string) {
  const named = prompt.match(
    /(?:called|named|for|brand|club|team|business|project)\s+["']?([a-z0-9& .'_-]{2,60})/i,
  )?.[1];

  return titleCase(named ?? prompt) || "Custom Membership";
}

function fallbackIntent({
  prompt,
  imageDataUrl,
  sourceMode,
}: Pick<
  CreateCustomBrandProfileArgs,
  "prompt" | "imageDataUrl" | "sourceMode"
>) {
  const lower = prompt.toLowerCase();
  const isCardReference =
    sourceMode === "physical-card" || sourceMode === "visiting-card";
  const primary =
    fallbackColors[
      Math.abs(
        Array.from(prompt).reduce(
          (total, character) => total + character.charCodeAt(0),
          0,
        ),
      ) % fallbackColors.length
    ];

  const industry =
    lower.includes("coffee") || lower.includes("cafe")
      ? "Coffee loyalty"
      : sourceMode === "visiting-card"
        ? "Professional services"
        : isCardReference
          ? "Membership card"
          : lower.includes("student") || lower.includes("university")
            ? "Student society"
            : lower.includes("anime") || lower.includes("fan")
              ? "Fan community"
              : lower.includes("gym") || lower.includes("fitness")
                ? "Fitness club"
                : lower.includes("restaurant")
                  ? "Loyalty membership"
                  : lower.includes("portfolio") || lower.includes("creator")
                    ? "Creator portfolio"
                    : "Custom membership";

  const brandColorUsage: BrandColorUsage =
    lower.includes("luxury") || lower.includes("premium")
      ? "dominant"
      : lower.includes("minimal") || lower.includes("clean")
        ? "subtle"
        : "balanced";

  return {
    businessName: fallbackName(prompt),
    description: prompt.slice(0, 240),
    industry,
    primaryColor: primary,
    secondaryColor: getMutedAccent(primary),
    brandColorUsage,
    brandTone: [
      lower.includes("playful") || lower.includes("anime") ? "playful" : "modern",
      lower.includes("premium") || lower.includes("luxury")
        ? "premium"
        : "professional",
    ],
    logoMode: isCardReference
      ? ("text-only" as const)
      : imageDataUrl
        ? ("image" as const)
        : ("text-only" as const),
    imageRole: imageDataUrl
      ? ("backgroundCandidate" as const)
      : ("unknown" as const),
  };
}

function assetFromImage(
  imageDataUrl: string | null | undefined,
  intent: Pick<CustomBrandProfileIntent, "imageRole">,
  sourceMode: CreateCustomBrandProfileArgs["sourceMode"],
): ScrapedAsset[] {
  if (!imageDataUrl) {
    return [];
  }

  const isCardReference =
    sourceMode === "physical-card" || sourceMode === "visiting-card";

  return [
    {
      id: "custom-upload-1",
      url: imageDataUrl,
      role: isCardReference ? "backgroundCandidate" : intent.imageRole,
      confidence: isCardReference
        ? 0.94
        : intent.imageRole === "unknown"
          ? 0.35
          : 0.86,
      reason:
        sourceMode === "physical-card"
          ? "Uploaded physical membership card used as a digitization reference."
          : sourceMode === "visiting-card"
            ? "Uploaded visiting card used as design inspiration for a membership card."
            : "Uploaded by the user for custom brand creation.",
    },
  ];
}

function profileFromIntent({
  prompt,
  imageDataUrl,
  intent,
  sourceMode: rawSourceMode,
  referenceImageMode: rawReferenceImageMode,
}: CreateCustomBrandProfileArgs & { intent: CustomBrandProfileIntent }) {
  const sourceMode = rawSourceMode ?? "prompt";
  const referenceImageMode = rawReferenceImageMode ?? "design-inspiration";
  const isCardReference =
    sourceMode === "physical-card" || sourceMode === "visiting-card";
  const creationSource: BrandCreationSource =
    sourceMode === "prompt" && imageDataUrl
      ? "reference-image"
      : sourceMode;
  const primaryColor = normalizeHexColor(intent.primaryColor, "#2563eb");
  const secondaryColor = normalizeHexColor(
    intent.secondaryColor,
    getMutedAccent(primaryColor),
  );
  const assets = assetFromImage(imageDataUrl, intent, sourceMode);
  const uploadedAsset = assets[0];
  const logoUrl =
    uploadedAsset && intent.logoMode === "image" && !isCardReference
      ? uploadedAsset.url
      : null;
  const logoMode = logoUrl
    ? "image"
    : intent.logoMode === "none"
      ? "none"
      : "text-only";

  return {
    websiteUrl: `https://custom-brand.local/${slug(intent.businessName) || "membership"}`,
    businessName: intent.businessName,
    description: intent.description || prompt.slice(0, 240),
    industry: intent.industry,
    logoUrl,
    logoMode,
    faviconUrl: undefined,
    primaryColor,
    secondaryColor,
    themeColor: primaryColor,
    brandColorUsage: intent.brandColorUsage,
    headings: [
      sourceMode === "physical-card"
        ? "Physical card reference"
        : sourceMode === "visiting-card"
          ? "Visiting card reference"
          : "Custom prompt",
      intent.industry,
    ],
    images: [],
    assets,
    selectedHeroImageUrl:
      uploadedAsset?.role === "heroCandidate" ? uploadedAsset.url : null,
    selectedBackgroundImageUrl:
      uploadedAsset &&
      (isCardReference ||
        uploadedAsset.role === "backgroundCandidate" ||
        uploadedAsset.role === "heroCandidate" ||
        uploadedAsset.role === "unknown")
        ? uploadedAsset.url
        : null,
    selectedProfileImageUrl:
      uploadedAsset?.role === "profileCandidate" ? uploadedAsset.url : null,
    brandTone: intent.brandTone,
    confirmed: false,
    creationSource,
    referenceImageMode: uploadedAsset ? referenceImageMode : undefined,
    referenceImageUrl: uploadedAsset?.url ?? null,
    designBrief: prompt,
  } satisfies BrandProfile;
}

export async function createCustomBrandProfile({
  prompt,
  imageDataUrl,
  sourceMode,
  referenceImageMode,
}: CreateCustomBrandProfileArgs) {
  if (!process.env.OPENAI_API_KEY) {
    return profileFromIntent({
      prompt,
      imageDataUrl,
      sourceMode,
      referenceImageMode,
      intent: fallbackIntent({ prompt, imageDataUrl, sourceMode }),
    });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30_000,
    maxRetries: 1,
  });
  const content: OpenAI.Responses.ResponseInputContent[] = [
    {
      type: "input_text",
      text: buildCustomBrandPrompt({
        prompt,
        hasImage: Boolean(imageDataUrl),
        sourceMode: sourceMode ?? "prompt",
        referenceImageMode: referenceImageMode ?? "design-inspiration",
      }),
    },
  ];

  if (imageDataUrl) {
    content.push({
      type: "input_image",
      image_url: imageDataUrl,
      detail: "high",
    });
  }

  const response = await client.responses.parse({
    model:
      process.env.OPENAI_VISION_MODEL ??
      process.env.OPENAI_MODEL ??
      "gpt-4.1-mini",
    input: [
      { role: "system", content: customBrandSystemPrompt },
      { role: "user", content },
    ],
    text: {
      format: zodTextFormat(
        customBrandProfileIntentSchema,
        "custom_brand_profile",
      ),
    },
    temperature: 0.45,
    max_output_tokens: 900,
  });

  if (!response.output_parsed) {
    throw new Error("AI did not return a valid custom brand profile.");
  }

  return profileFromIntent({
    prompt,
    imageDataUrl,
    sourceMode,
    referenceImageMode,
    intent: response.output_parsed,
  });
}
