import { z } from "zod";
import { memberFieldKeys } from "@/types/card";

const hexColorSchema = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

export const memberFieldKeySchema = z.enum(memberFieldKeys);

export const brandColorUsageSchema = z.enum([
  "subtle",
  "balanced",
  "dominant",
  "full-background",
  "gradient",
  "split-panel",
]);

export const brandCreationSourceSchema = z.enum([
  "website",
  "prompt",
  "reference-image",
  "physical-card",
  "visiting-card",
]);

export const referenceImageModeSchema = z.enum([
  "match-original",
  "design-inspiration",
]);

export const scrapedAssetSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  role: z.enum([
    "logoCandidate",
    "heroCandidate",
    "profileCandidate",
    "backgroundCandidate",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(180),
});

export const brandProfileSchema = z.object({
  websiteUrl: z.string().url(),
  businessName: z.string().min(1),
  description: z.string(),
  industry: z.string().min(1),
  logoUrl: z.string().nullable().optional(),
  logoMode: z.enum(["image", "text-only", "none"]),
  faviconUrl: z.string().optional(),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  themeColor: hexColorSchema.optional(),
  brandColorUsage: brandColorUsageSchema,
  headings: z.array(z.string()).max(12),
  images: z.array(z.string()).max(20),
  assets: z.array(scrapedAssetSchema).max(30),
  selectedHeroImageUrl: z.string().nullable().optional(),
  selectedBackgroundImageUrl: z.string().nullable().optional(),
  selectedProfileImageUrl: z.string().nullable().optional(),
  brandTone: z.array(z.string()).min(1).max(8),
  confirmed: z.boolean(),
  creationSource: brandCreationSourceSchema.optional(),
  referenceImageMode: referenceImageModeSchema.optional(),
  referenceImageUrl: z.string().nullable().optional(),
  designBrief: z.string().max(1200).optional(),
});

export const scrapeRequestSchema = z.object({
  url: z.string().min(3),
});

export const customBrandProfileRequestSchema = z.object({
  prompt: z.string().min(8).max(1800),
  sourceMode: z.enum(["prompt", "physical-card", "visiting-card"]).optional(),
  referenceImageMode: referenceImageModeSchema.optional(),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i)
    .max(1_200_000)
    .nullable()
    .optional(),
});

export const customBrandProfileIntentSchema = z.object({
  businessName: z.string().min(1).max(80),
  description: z.string().min(1).max(260),
  industry: z.string().min(1).max(70),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  brandColorUsage: brandColorUsageSchema,
  brandTone: z.array(z.string().min(1).max(24)).min(1).max(6),
  logoMode: z.enum(["image", "text-only", "none"]),
  imageRole: z.enum([
    "logoCandidate",
    "heroCandidate",
    "profileCandidate",
    "backgroundCandidate",
    "unknown",
  ]),
});

export type CustomBrandProfileIntent = z.infer<
  typeof customBrandProfileIntentSchema
>;

/**
 * What the vision model returns when it inspects the scraped logo/hero images.
 * Used to replace the brittle first-hex / filename-guess heuristics with a
 * pixel-grounded read of the real brand identity.
 */
export const brandVisionRefinementSchema = z.object({
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  brandColorUsage: brandColorUsageSchema,
  industry: z.string().min(1).max(60),
  brandTone: z.array(z.string().min(1).max(24)).min(1).max(6),
  // The id of the candidate asset that is actually the logo, or null if none
  // of the provided images is a usable logo.
  bestLogoAssetId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type BrandVisionRefinement = z.infer<typeof brandVisionRefinementSchema>;

const generatedCardMoodSchema = z.enum([
  "official",
  "minimal",
  "premium",
  "playful",
  "creative",
  "cyberpunk",
  "academic",
  "luxury",
  "event",
  "identity",
]);

const cardOrientationSchema = z.enum(["landscape", "portrait"]);
const brandAssetSourceSchema = z.enum(["none", "logo", "hero", "background"]);
const brandAssetTreatmentSchema = z.enum([
  "standard",
  "logo-watermark",
  "background-emblem",
  "hero-backdrop",
  "side-emblem",
]);
const brandAssetIntensitySchema = z.enum(["subtle", "medium", "bold"]);

const generatedDesignTokensSchema = z.object({
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema.nullable().optional(),
  textColor: hexColorSchema,
  orientation: cardOrientationSchema.optional(),
  backgroundMode: z.enum([
    "solid",
    "gradient",
    "image",
    "image-overlay",
    "pattern",
  ]),
  colorUsage: z.enum(["subtle", "balanced", "dominant", "full"]),
  brandAssetSource: brandAssetSourceSchema.optional(),
  brandAssetTreatment: brandAssetTreatmentSchema.optional(),
  brandAssetIntensity: brandAssetIntensitySchema.optional(),
  usesLogo: z.boolean(),
  usesQr: z.boolean(),
  usesPhoto: z.boolean(),
  usesDecorativeArt: z.boolean(),
});

const structuredGeneratedDesignTokensSchema = z.object({
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema.nullable(),
  textColor: hexColorSchema,
  orientation: cardOrientationSchema,
  backgroundMode: z.enum([
    "solid",
    "gradient",
    "image",
    "image-overlay",
    "pattern",
  ]),
  colorUsage: z.enum(["subtle", "balanced", "dominant", "full"]),
  brandAssetSource: brandAssetSourceSchema,
  brandAssetTreatment: brandAssetTreatmentSchema,
  brandAssetIntensity: brandAssetIntensitySchema,
  usesLogo: z.boolean(),
  usesQr: z.boolean(),
  usesPhoto: z.boolean(),
  usesDecorativeArt: z.boolean(),
});

export const generatedCardDesignSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(70),
  description: z.string().min(1).max(240),
  mood: generatedCardMoodSchema,
  requiredFields: z.array(memberFieldKeySchema).min(3).max(13),
  html: z.string().min(40).max(7000),
  css: z.string().min(80).max(9000),
  designTokens: generatedDesignTokensSchema,
});

const structuredGeneratedCardDesignSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(70),
  description: z.string().min(1).max(240),
  mood: generatedCardMoodSchema,
  requiredFields: z.array(memberFieldKeySchema).min(3).max(13),
  html: z.string().min(40).max(7000),
  css: z.string().min(80).max(9000),
  designTokens: structuredGeneratedDesignTokensSchema,
});

/**
 * Compact design intent — what the AI now returns. Layout HTML/CSS is gone;
 * the deterministic scene graph renders these tokens. Smaller output = cheaper,
 * faster, and far less likely to hit token limits.
 */
export const conceptIntentSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(70),
  description: z.string().min(1).max(240),
  mood: generatedCardMoodSchema,
  requiredFields: z.array(memberFieldKeySchema).min(3).max(13),
  designTokens: structuredGeneratedDesignTokensSchema,
});

/** A stored concept may still carry legacy html/css from an older save. */
export const storedConceptSchema = conceptIntentSchema.extend({
  html: z.string().optional(),
  css: z.string().optional(),
});

export const conceptsResponseSchema = z.object({
  concepts: z.array(conceptIntentSchema).length(8),
});

export const generateConceptsRequestSchema = z.object({
  brandProfile: brandProfileSchema,
});

export const refineConceptRequestSchema = z.object({
  brandProfile: brandProfileSchema,
  concept: storedConceptSchema,
  instruction: z.string().min(2).max(700),
});

export const refineConceptResponseSchema = z.object({
  concept: conceptIntentSchema,
});

export const memberDataSchema = z.object({
  name: z.string(),
  photoUrl: z.string().optional(),
  decorativeArtUrl: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  memberId: z.string(),
  tier: z.string().optional(),
  expiryDate: z.string().optional(),
  dateJoined: z.string().optional(),
  studentId: z.string().optional(),
  course: z.string().optional(),
  loyaltyPoints: z.string().optional(),
});

const walletFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  value: z.string().max(300),
});

export const walletReadyPassSchema = z.object({
  passType: z.enum(["storeCard", "generic"]),
  organizationName: z.string().min(1).max(120),
  description: z.string().max(300),
  logoText: z.string().max(120),
  foregroundColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  labelColor: hexColorSchema,
  barcode: z.object({
    format: z.literal("PKBarcodeFormatQR"),
    message: z.string().min(1).max(1200),
  }),
  primaryFields: z.array(walletFieldSchema).max(4),
  secondaryFields: z.array(walletFieldSchema).max(8),
  auxiliaryFields: z.array(walletFieldSchema).max(8),
});

export const googleWalletRequestSchema = z.object({
  pass: walletReadyPassSchema,
  objectSuffix: z.string().min(1).max(80),
  logoUrl: z.string().url().nullable().optional(),
  heroUrl: z.string().url().nullable().optional(),
});

export const appleWalletRequestSchema = z.object({
  pass: walletReadyPassSchema,
});

export const selectedFieldsSchema = z.object(
  Object.fromEntries(memberFieldKeys.map((key) => [key, z.boolean()])) as Record<
    (typeof memberFieldKeys)[number],
    z.ZodBoolean
  >,
);

export const layoutIssueSchema = z.object({
  role: z.string().min(1).max(80),
  severity: z.enum(["warning", "error"]),
  message: z.string().min(1).max(240),
  bounds: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

export const reviewDesignRequestSchema = z.object({
  brandProfile: brandProfileSchema,
  concept: generatedCardDesignSchema,
  memberData: memberDataSchema,
  selectedFields: selectedFieldsSchema,
  screenshotDataUrl: z
    .string()
    .startsWith("data:image/png;base64,")
    .max(4_000_000),
  domIssues: z.array(layoutIssueSchema).max(80),
  attempt: z.number().int().min(1).max(2),
  reviewInstruction: z.string().max(900).nullable().optional(),
});

export const reviewDesignResponseSchema = z.object({
  status: z.enum(["pass", "fixed"]),
  summary: z.string().min(1).max(240),
  issues: z.array(z.string().max(180)).max(20),
  concept: structuredGeneratedCardDesignSchema.nullable(),
});
