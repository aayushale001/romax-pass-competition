import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  brandVisionRefinementSchema,
  type BrandVisionRefinement,
} from "@/lib/schemas";
import { brandVisionSystemPrompt, buildBrandVisionPrompt } from "@/lib/aiPrompts";
import type { BrandProfile, ScrapedAsset } from "@/types/card";
import {
  fetchPublicUrl,
  readResponseBufferWithLimit,
} from "@/lib/publicFetch";

const FETCH_TIMEOUT_MS = 6000;
const MAX_IMAGE_BYTES = 1_200_000;
const MAX_IMAGES = 2;
// OpenAI vision cannot read SVG; only raster formats are sent.
const ALLOWED_IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif)/i;

type VisionImage = {
  asset: ScrapedAsset;
  dataUrl: string;
};

function pickCandidateAssets(profile: BrandProfile): ScrapedAsset[] {
  const byConfidence = (a: ScrapedAsset, b: ScrapedAsset) =>
    b.confidence - a.confidence;
  const logos = profile.assets
    .filter((asset) => asset.role === "logoCandidate")
    .sort(byConfidence)
    .slice(0, 2);
  const visuals = profile.assets
    .filter(
      (asset) =>
        asset.role === "heroCandidate" || asset.role === "backgroundCandidate",
    )
    .sort(byConfidence)
    .slice(0, 1);

  const seen = new Set<string>();
  return [...logos, ...visuals].filter((asset) => {
    if (seen.has(asset.url)) return false;
    seen.add(asset.url);
    return true;
  });
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const { response } = await fetchPublicUrl(
      url,
      {},
      { timeoutMs: FETCH_TIMEOUT_MS, maxRedirects: 2 },
    );
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!ALLOWED_IMAGE_TYPES.test(contentType)) return null;

    const buffer = await readResponseBufferWithLimit(response, MAX_IMAGE_BYTES);
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const mime = contentType.split(";")[0].trim();
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function loadVisionImages(profile: BrandProfile): Promise<VisionImage[]> {
  const candidates = pickCandidateAssets(profile).slice(0, MAX_IMAGES);
  const loaded = await Promise.all(
    candidates.map(async (asset) => {
      const dataUrl = await fetchAsDataUrl(asset.url);
      return dataUrl ? { asset, dataUrl } : null;
    }),
  );
  return loaded.filter((item): item is VisionImage => item !== null);
}

function mergeRefinement(
  profile: BrandProfile,
  refinement: BrandVisionRefinement,
): BrandProfile {
  // Trust pixel-read colors only when the model is reasonably confident;
  // otherwise keep the heuristic colors but still benefit from the rest.
  const useColors = refinement.confidence >= 0.4;

  let logoUrl = profile.logoUrl;
  let logoMode = profile.logoMode;
  if (refinement.bestLogoAssetId) {
    const match = profile.assets.find(
      (asset) => asset.id === refinement.bestLogoAssetId,
    );
    if (match) {
      logoUrl = match.url;
      logoMode = "image";
    }
  }

  return {
    ...profile,
    primaryColor: useColors ? refinement.primaryColor : profile.primaryColor,
    secondaryColor: useColors
      ? refinement.secondaryColor
      : profile.secondaryColor,
    themeColor: useColors ? refinement.primaryColor : profile.themeColor,
    brandColorUsage: refinement.brandColorUsage,
    industry: refinement.industry || profile.industry,
    brandTone: refinement.brandTone.length
      ? refinement.brandTone
      : profile.brandTone,
    logoUrl,
    logoMode,
  };
}

/**
 * Best-effort vision pass over the scraped brand. Sends the real logo/hero
 * pixels to the vision model to derive an accurate palette, industry, tone,
 * and logo pick — replacing the first-hex/filename-guess heuristics.
 *
 * Never throws: on any failure (no key, no usable images, API/parse error) it
 * returns the original heuristic profile unchanged.
 */
export async function refineBrandProfileWithVision(
  profile: BrandProfile,
): Promise<BrandProfile> {
  if (!process.env.OPENAI_API_KEY) return profile;

  try {
    const images = await loadVisionImages(profile);
    if (images.length === 0) return profile;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30_000,
      maxRetries: 1,
    });

    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: "input_text",
        text: buildBrandVisionPrompt({
          businessName: profile.businessName,
          description: profile.description,
          headings: profile.headings,
          candidates: images.map(({ asset }) => ({
            id: asset.id,
            role: asset.role,
            url: asset.url,
          })),
        }),
      },
    ];
    for (const { asset, dataUrl } of images) {
      content.push({ type: "input_text", text: `Image for asset ${asset.id}:` });
      content.push({ type: "input_image", image_url: dataUrl, detail: "auto" });
    }

    const response = await client.responses.parse({
      model:
        process.env.OPENAI_VISION_MODEL ??
        process.env.OPENAI_MODEL ??
        "gpt-4.1-mini",
      input: [
        { role: "system", content: brandVisionSystemPrompt },
        { role: "user", content },
      ],
      text: {
        format: zodTextFormat(brandVisionRefinementSchema, "brand_vision"),
      },
      temperature: 0.2,
      max_output_tokens: 600,
    });

    if (!response.output_parsed) return profile;
    return mergeRefinement(profile, response.output_parsed);
  } catch (error) {
    console.error("Brand vision refinement failed; using heuristics.", error);
    return profile;
  }
}
