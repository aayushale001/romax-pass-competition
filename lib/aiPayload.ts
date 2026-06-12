import type { BrandProfile, GeneratedCardDesign } from "@/types/card";

const dataUrlPattern = /data:([^;,]+)(?:;[^,]*)?,([a-z0-9+/=]+)/gi;

function estimatedBytesFromBase64(base64: string) {
  return Math.max(0, Math.round((base64.length * 3) / 4));
}

function formatKilobytes(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function describeDataUrl(match: string, mime = "image", base64 = "") {
  const bytes = estimatedBytesFromBase64(base64);
  return `[${mime} data omitted from text prompt; ${formatKilobytes(
    bytes || match.length,
  )}; image remains available in the app renderer]`;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`;
}

export function compactStringForAi(value: string, maxLength = 1200) {
  const withoutDataUrls = value.replace(dataUrlPattern, describeDataUrl);
  return truncate(withoutDataUrls, maxLength);
}

export function compactUrlForAi(value: string | null | undefined) {
  if (!value) {
    return value ?? null;
  }

  return compactStringForAi(value, 260);
}

export function compactForAiText<T>(value: T, maxStringLength = 1200): T {
  if (typeof value === "string") {
    return compactStringForAi(value, maxStringLength) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      compactForAiText(item, maxStringLength),
    ) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        compactForAiText(entry, maxStringLength),
      ]),
    ) as T;
  }

  return value;
}

export function compactBrandProfileForAi(
  brandProfile: BrandProfile,
): BrandProfile {
  return {
    ...brandProfile,
    description: compactStringForAi(brandProfile.description, 520),
    logoUrl: compactUrlForAi(brandProfile.logoUrl),
    faviconUrl: compactUrlForAi(brandProfile.faviconUrl) ?? undefined,
    headings: brandProfile.headings
      .slice(0, 8)
      .map((heading) => compactStringForAi(heading, 100)),
    images: brandProfile.images.slice(0, 8).map((url) => compactUrlForAi(url)!),
    assets: brandProfile.assets.slice(0, 16).map((asset) => ({
      ...asset,
      url: compactUrlForAi(asset.url) ?? "",
      reason: compactStringForAi(asset.reason, 120),
    })),
    selectedHeroImageUrl: compactUrlForAi(brandProfile.selectedHeroImageUrl),
    selectedBackgroundImageUrl: compactUrlForAi(
      brandProfile.selectedBackgroundImageUrl,
    ),
    selectedProfileImageUrl: compactUrlForAi(
      brandProfile.selectedProfileImageUrl,
    ),
    brandTone: brandProfile.brandTone
      .slice(0, 8)
      .map((tone) => compactStringForAi(tone, 36)),
    referenceImageUrl: compactUrlForAi(brandProfile.referenceImageUrl),
    designBrief: brandProfile.designBrief
      ? compactStringForAi(brandProfile.designBrief, 520)
      : undefined,
  };
}

export function compactGeneratedDesignForAi(
  concept: GeneratedCardDesign,
): GeneratedCardDesign {
  return {
    ...concept,
    description: compactStringForAi(concept.description, 260),
    html: concept.html ? compactStringForAi(concept.html, 7000) : concept.html,
    css: concept.css ? compactStringForAi(concept.css, 9000) : concept.css,
  };
}
