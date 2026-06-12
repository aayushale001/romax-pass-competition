import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberFieldKey,
} from "@/types/card";
import {
  getDeepBackground,
  getMutedAccent,
  getReadableTextColor,
  normalizeHexColor,
} from "@/lib/colors";
import { normalizeGeneratedDesign } from "@/lib/generatedCardSafety";

const coreFields: MemberFieldKey[] = [
  "name",
  "photo",
  "memberId",
  "tier",
  "expiryDate",
  "qrCode",
];

function fieldsForIndustry(industry: string): MemberFieldKey[] {
  const value = industry.toLowerCase();

  if (value.includes("education") || value.includes("university")) {
    return [...coreFields, "studentId", "course", "email"];
  }

  if (value.includes("fitness") || value.includes("club")) {
    return [...coreFields, "dateJoined", "phone", "loyaltyPoints"];
  }

  if (value.includes("retail") || value.includes("hospitality")) {
    return [...coreFields, "loyaltyPoints", "email", "decorativeArt"];
  }

  return [...coreFields, "email", "phone", "dateJoined"];
}

function baseDesignTokens(
  brand: BrandProfile,
  overrides: Partial<GeneratedCardDesign["designTokens"]> = {},
): GeneratedCardDesign["designTokens"] {
  const primary = normalizeHexColor(brand.primaryColor);

  return {
    primaryColor: primary,
    secondaryColor: normalizeHexColor(brand.secondaryColor, getMutedAccent(primary)),
    textColor: "#111827",
    backgroundMode: "gradient",
    colorUsage: "balanced",
    brandAssetSource: "none",
    brandAssetTreatment: "standard",
    brandAssetIntensity: "subtle",
    usesLogo: brand.logoMode !== "none",
    usesQr: true,
    usesPhoto: false,
    usesDecorativeArt: false,
    ...overrides,
  };
}

export function createFallbackDesigns(
  brand: BrandProfile,
): GeneratedCardDesign[] {
  const primary = normalizeHexColor(brand.primaryColor);
  const deep = getDeepBackground(primary);
  const deepText = getReadableTextColor(deep);
  const fields = fieldsForIndustry(brand.industry);
  const hasReferenceCard =
    brand.creationSource === "physical-card" ||
    brand.creationSource === "visiting-card" ||
    Boolean(brand.referenceImageUrl);

  const designs: GeneratedCardDesign[] = [
    {
      id: "generated-official",
      name: hasReferenceCard ? "Digitized Original" : "Official Signal",
      description: hasReferenceCard
        ? "A faithful digital pass direction that uses the uploaded card image as the visual source."
        : "A structured brand credential with a strong verification block and crisp official hierarchy.",
      mood: hasReferenceCard ? "premium" : "official",
      requiredFields: fields,
      designTokens: baseDesignTokens(brand, {
        orientation: "landscape",
        backgroundMode: hasReferenceCard ? "image-overlay" : "gradient",
        colorUsage: hasReferenceCard ? "dominant" : "balanced",
        brandAssetSource: hasReferenceCard
          ? "background"
          : brand.logoUrl
            ? "logo"
            : "none",
        brandAssetTreatment: hasReferenceCard
          ? "hero-backdrop"
          : brand.logoUrl
            ? "logo-watermark"
            : "standard",
        brandAssetIntensity: hasReferenceCard ? "medium" : "subtle",
        usesPhoto: true,
      }),
    },
    {
      id: "generated-premium-pass",
      name: "Premium Wallet Pass",
      description:
        "A tall Apple Wallet-style pass that floods the brand color and centers the scan code.",
      mood: "premium",
      requiredFields: [...fields, "decorativeArt"],
      designTokens: baseDesignTokens(brand, {
        orientation: "portrait",
        textColor: deepText,
        backgroundMode: "gradient",
        colorUsage: "full",
        brandAssetSource: brand.logoUrl ? "logo" : "none",
        brandAssetTreatment: brand.logoUrl ? "background-emblem" : "standard",
        brandAssetIntensity: "medium",
        usesDecorativeArt: true,
      }),
    },
    {
      id: "generated-identity-pass",
      name: "Identity Wallet Pass",
      description:
        "A portrait member pass with a photo, name headline, and bottom scan code.",
      mood: "identity",
      requiredFields: fields,
      designTokens: baseDesignTokens(brand, {
        orientation: "portrait",
        backgroundMode: "solid",
        colorUsage: "balanced",
        brandAssetSource: "background",
        brandAssetTreatment: "side-emblem",
        brandAssetIntensity: "subtle",
        usesPhoto: true,
      }),
    },
    {
      id: "generated-event",
      name: "Scan Gate",
      description:
        "A QR-forward event/access card with compact data and a bold scan area.",
      mood: "event",
      requiredFields: fields,
      designTokens: baseDesignTokens(brand, {
        orientation: "landscape",
        backgroundMode: "pattern",
        colorUsage: "dominant",
        brandAssetSource: brand.logoUrl ? "logo" : "hero",
        brandAssetTreatment: "side-emblem",
        brandAssetIntensity: "bold",
      }),
    },
    {
      id: "generated-minimal-pass",
      name: "Minimal Wallet Pass",
      description:
        "A calm portrait pass that prioritizes scannability and clean, restrained fields.",
      mood: "minimal",
      requiredFields: fields,
      designTokens: baseDesignTokens(brand, {
        orientation: "portrait",
        backgroundMode: "solid",
        colorUsage: "subtle",
        brandAssetSource: brand.logoUrl ? "logo" : "none",
        brandAssetTreatment: brand.logoUrl ? "logo-watermark" : "standard",
        brandAssetIntensity: "subtle",
      }),
    },
    {
      id: "generated-luxury",
      name: "Luxe Brand Card",
      description:
        "A landscape premium card with deep brand color and an elevated, immersive feel.",
      mood: "luxury",
      requiredFields: [...fields, "decorativeArt"],
      designTokens: baseDesignTokens(brand, {
        orientation: "landscape",
        textColor: deepText,
        backgroundMode: "gradient",
        colorUsage: "dominant",
        brandAssetSource: brand.logoUrl ? "logo" : "background",
        brandAssetTreatment: "background-emblem",
        brandAssetIntensity: "bold",
        usesDecorativeArt: true,
      }),
    },
    {
      id: "generated-academic-pass",
      name: "Academic Wallet Pass",
      description:
        "A portrait institutional pass with a tidy field stack and official verification.",
      mood: "academic",
      requiredFields: fields,
      designTokens: baseDesignTokens(brand, {
        orientation: "portrait",
        backgroundMode: "gradient",
        colorUsage: "balanced",
        brandAssetSource: brand.logoUrl ? "logo" : "none",
        brandAssetTreatment: brand.logoUrl ? "logo-watermark" : "standard",
        brandAssetIntensity: "medium",
        usesPhoto: true,
      }),
    },
    {
      id: "generated-creative",
      name: "Creative Poster",
      description:
        "A landscape poster-style card with a bold badge, big name, and large scan area.",
      mood: "creative",
      requiredFields: [...fields, "decorativeArt"],
      designTokens: baseDesignTokens(brand, {
        orientation: "landscape",
        backgroundMode: "pattern",
        colorUsage: "dominant",
        brandAssetSource: brand.logoUrl ? "logo" : "hero",
        brandAssetTreatment: "side-emblem",
        brandAssetIntensity: "bold",
        usesDecorativeArt: true,
      }),
    },
  ];

  return designs.map((design) => normalizeGeneratedDesign(design, brand));
}

export function normalizeGeneratedDesignList(
  designs: GeneratedCardDesign[],
  brand: BrandProfile,
) {
  const fallbacks = createFallbackDesigns(brand);
  const normalized = designs
    .filter((design) => design?.designTokens && design?.mood)
    .slice(0, 8)
    .map((design, index) =>
      normalizeGeneratedDesign(design, brand, fallbacks[index] ?? fallbacks[0]),
    );

  while (normalized.length < 8) {
    normalized.push(fallbacks[normalized.length]);
  }

  return normalized;
}

export function locallyRefineGeneratedDesign(
  brand: BrandProfile,
  concept: GeneratedCardDesign,
  instruction: string,
) {
  const lower = instruction.toLowerCase();
  const primary = normalizeHexColor(brand.primaryColor);
  const deep = getDeepBackground(primary);
  const text = getReadableTextColor(deep);
  const asksForArt =
    /anime|manga|actor|avatar|character|poster|art|illustration|mascot/.test(
      lower,
    );
  const removesPhoto =
    /(?:remove|delete|hide|without|no)\s+(?:the\s+)?(?:member\s+)?(?:photo|portrait|picture|headshot|selfie)/.test(
      lower,
    );
  const removesArt =
    /(?:remove|delete|hide|without|no)\s+(?:the\s+)?(?:decorative\s+)?(?:art|artwork|illustration|avatar|character)/.test(
      lower,
    );
  const removesBackground =
    /(?:remove|delete|hide|without|no)\s+(?:the\s+)?(?:background|backdrop|background image)/.test(
      lower,
    );
  const asksForPhoto =
    !removesPhoto && /photo|portrait|picture|headshot|selfie/.test(lower);
  const keepsArt = asksForArt && !removesArt;
  const asksForStrongColor =
    /bold|strong|dominant|more color|brand color|full|gradient|impact|vibrant/.test(
      lower,
    );
  const asksForMinimal = /minimal|clean|simple|calm|less|whitespace/.test(lower);

  const mood: GeneratedCardDesign["mood"] = keepsArt
    ? "creative"
    : asksForPhoto
      ? "identity"
      : asksForMinimal
        ? "minimal"
        : concept.mood;

  const requiredFields = Array.from(
    new Set<MemberFieldKey>([
      ...concept.requiredFields.filter(
        (field) =>
          !(removesPhoto && field === "photo") &&
          !(removesArt && field === "decorativeArt"),
      ),
      ...(keepsArt ? (["decorativeArt"] as MemberFieldKey[]) : []),
      ...(asksForPhoto ? (["photo"] as MemberFieldKey[]) : []),
      "name",
      "memberId",
      "qrCode",
    ]),
  );

  const refined: GeneratedCardDesign = {
    ...concept,
    name: keepsArt ? "Custom Art Layout" : `${concept.name} Refined`,
    description: `${concept.description} Refined for: ${instruction.slice(0, 140)}`,
    mood,
    requiredFields,
    designTokens: {
      ...concept.designTokens,
      primaryColor: primary,
      secondaryColor: concept.designTokens.secondaryColor ?? getMutedAccent(primary),
      textColor:
        keepsArt || asksForStrongColor ? text : concept.designTokens.textColor,
      backgroundMode: keepsArt
        ? "image-overlay"
        : removesBackground
          ? "solid"
          : concept.designTokens.backgroundMode,
      colorUsage:
        keepsArt || asksForStrongColor
          ? "full"
          : asksForMinimal
            ? "subtle"
            : concept.designTokens.colorUsage,
      brandAssetSource: keepsArt
        ? concept.designTokens.brandAssetSource ?? "background"
        : removesBackground
          ? "none"
        : concept.designTokens.brandAssetSource ?? "none",
      brandAssetTreatment: keepsArt
        ? "hero-backdrop"
        : removesBackground
          ? "standard"
        : asksForStrongColor
          ? "background-emblem"
          : concept.designTokens.brandAssetTreatment ?? "standard",
      brandAssetIntensity:
        keepsArt || asksForStrongColor
          ? "bold"
          : concept.designTokens.brandAssetIntensity ?? "subtle",
      usesPhoto: removesPhoto
        ? false
        : concept.designTokens.usesPhoto || asksForPhoto,
      usesDecorativeArt: removesArt
        ? false
        : concept.designTokens.usesDecorativeArt || keepsArt,
      usesLogo: brand.logoMode !== "none",
      usesQr: true,
    },
  };

  return normalizeGeneratedDesign(refined, brand, concept);
}
