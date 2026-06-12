import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  MemberFieldKey,
  SelectedFields,
} from "@/types/card";
import { memberFieldKeys } from "@/types/card";
import { getMutedAccent, getReadableTextColor, normalizeHexColor } from "@/lib/colors";

export const allowedCardPlaceholders = [
  "businessName",
  "logo",
  "memberName",
  "memberPhoto",
  "memberId",
  "tier",
  "email",
  "phone",
  "studentId",
  "course",
  "expiryDate",
  "dateJoined",
  "loyaltyPoints",
  "qrCode",
  "decorativeArt",
  "backgroundImage",
] as const;

const allowedPlaceholderSet = new Set<string>(allowedCardPlaceholders);
const memberFieldKeySet = new Set<string>(memberFieldKeys);

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (parts[0]?.[0] ?? "M") + (parts[1]?.[0] ?? "");
}

function selectedImage(brandProfile: BrandProfile) {
  return (
    brandProfile.selectedBackgroundImageUrl ??
    brandProfile.selectedHeroImageUrl ??
    brandProfile.images[0] ??
    ""
  );
}

function fieldValue(key: MemberFieldKey, memberData: MemberData) {
  if (key === "name") {
    return memberData.name || "Avery Morgan";
  }

  if (key === "memberId") {
    return memberData.memberId || "MEM-0001";
  }

  const fallbackValues: Partial<Record<MemberFieldKey, string>> = {
    email: "avery@example.com",
    phone: "+44 7700 900321",
    tier: "Gold",
    expiryDate: "2027-06-01",
    dateJoined: "2026-06-01",
    studentId: "S-48291",
    course: "Design Systems",
    loyaltyPoints: "1,250",
  };

  return (
    memberData[key as keyof MemberData]?.toString() ||
    fallbackValues[key] ||
    ""
  );
}

function safeImageMarkup(url: string | undefined, className: string, alt: string) {
  if (!url) {
    return "";
  }

  return `<img class="${className}" src="${escapeAttribute(url)}" alt="${escapeAttribute(
    alt,
  )}" referrerpolicy="no-referrer" />`;
}

export function sanitizeGeneratedHtml(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|link|iframe|object|embed|form|input|button|textarea|select|option|meta|base)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|link|iframe|object|embed|form|input|button|textarea|select|option|meta|base)\b[^>]*\/?>/gi, "")
    .replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src|srcset|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/{{\s*([^}]+)\s*}}/g, (match, name: string) =>
      allowedPlaceholderSet.has(name.trim()) ? `{{${name.trim()}}}` : "",
    );
}

function sanitizeCssBody(body: string) {
  return body
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/behavior\s*:/gi, "")
    .replace(/position\s*:\s*fixed\s*;?/gi, "")
    .replace(/url\s*\((?!\s*var\()[^)]+\)/gi, "none");
}

export function sanitizeAndScopeCss(css: string, scopeClass: string) {
  const scope = `.${scopeClass}`;
  const withoutUnsafeAtRules = css
    .replace(/@import[^;]+;/gi, "")
    .replace(/@font-face\s*{[\s\S]*?}/gi, "")
    .replace(/@keyframes\s+[^{]+{[\s\S]*?}\s*}/gi, "");

  const blocks = withoutUnsafeAtRules.match(/[^{}]+{[^{}]*}/g) ?? [];

  return blocks
    .map((block) => {
      const index = block.indexOf("{");
      const selectorText = block.slice(0, index).trim();
      const body = sanitizeCssBody(block.slice(index + 1, -1).trim());

      if (!selectorText || selectorText.startsWith("@")) {
        return "";
      }

      const selectors = selectorText
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean)
        .map((selector) => {
          if (selector === ":host" || selector === ".card-root") {
            return scope;
          }

          if (selector.startsWith(scope)) {
            return selector;
          }

          return `${scope} ${selector}`;
        });

      return selectors.length ? `${selectors.join(", ")} { ${body} }` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function normalizeGeneratedDesign(
  design: GeneratedCardDesign,
  brandProfile: BrandProfile,
  fallback?: GeneratedCardDesign,
): GeneratedCardDesign {
  const primary = normalizeHexColor(
    design.designTokens.primaryColor,
    brandProfile.primaryColor,
  );
  const textColor = normalizeHexColor(
    design.designTokens.textColor,
    getReadableTextColor(primary),
  );
  const requiredFields = Array.from(
    new Set(
      [
        ...(design.requiredFields ?? []),
        "name",
        "memberId",
        "qrCode",
      ].filter((field): field is MemberFieldKey =>
        memberFieldKeySet.has(String(field)),
      ),
    ),
  );

  return {
    id: design.id || fallback?.id || "generated-card",
    name: design.name || fallback?.name || "Generated Card",
    description:
      design.description ||
      fallback?.description ||
      "AI-generated membership card design.",
    mood: design.mood || fallback?.mood || "identity",
    requiredFields,
    designTokens: {
      primaryColor: primary,
      secondaryColor: design.designTokens.secondaryColor
        ? normalizeHexColor(
            design.designTokens.secondaryColor,
            brandProfile.secondaryColor,
          )
        : (fallback?.designTokens.secondaryColor ??
          getMutedAccent(primary)),
      textColor,
      orientation:
        design.designTokens.orientation === "portrait"
          ? "portrait"
          : design.designTokens.orientation === "landscape"
            ? "landscape"
            : (fallback?.designTokens.orientation ?? "landscape"),
      backgroundMode:
        design.designTokens.backgroundMode ||
        fallback?.designTokens.backgroundMode ||
        "gradient",
      colorUsage:
        design.designTokens.colorUsage ||
        fallback?.designTokens.colorUsage ||
        "balanced",
      brandAssetSource:
        design.designTokens.brandAssetSource ??
        fallback?.designTokens.brandAssetSource ??
        "none",
      brandAssetTreatment:
        design.designTokens.brandAssetTreatment ??
        fallback?.designTokens.brandAssetTreatment ??
        "standard",
      brandAssetIntensity:
        design.designTokens.brandAssetIntensity ??
        fallback?.designTokens.brandAssetIntensity ??
        "subtle",
      usesLogo: Boolean(design.designTokens.usesLogo),
      usesQr: true,
      usesPhoto: Boolean(design.designTokens.usesPhoto),
      usesDecorativeArt: Boolean(design.designTokens.usesDecorativeArt),
    },
  };
}

export function renderDesignHtml({
  design,
  brandProfile,
  memberData,
  selectedFields,
  qrMarkup,
}: {
  design: GeneratedCardDesign;
  brandProfile: BrandProfile;
  memberData: MemberData;
  selectedFields: SelectedFields;
  qrMarkup: string;
}) {
  const backgroundUrl = selectedImage(brandProfile);
  const placeholders: Record<string, string> = {
    businessName: escapeHtml(brandProfile.businessName),
    logo:
      brandProfile.logoMode === "image" && brandProfile.logoUrl
        ? safeImageMarkup(
            brandProfile.logoUrl,
            "gcd-logo-image",
            `${brandProfile.businessName} logo`,
          )
        : brandProfile.logoMode === "none"
          ? ""
          : `<span class="gcd-logo-text">${escapeHtml(
              getInitials(brandProfile.businessName),
            )}</span>`,
    memberName: escapeHtml(fieldValue("name", memberData)),
    memberPhoto:
      selectedFields.photo && memberData.photoUrl
        ? safeImageMarkup(memberData.photoUrl, "gcd-member-photo", "Member photo")
        : `<span class="gcd-photo-fallback">${escapeHtml(
            getInitials(fieldValue("name", memberData)),
          )}</span>`,
    memberId: escapeHtml(fieldValue("memberId", memberData)),
    tier: escapeHtml(fieldValue("tier", memberData)),
    email: selectedFields.email ? escapeHtml(fieldValue("email", memberData)) : "",
    phone: selectedFields.phone ? escapeHtml(fieldValue("phone", memberData)) : "",
    studentId: selectedFields.studentId
      ? escapeHtml(fieldValue("studentId", memberData))
      : "",
    course: selectedFields.course ? escapeHtml(fieldValue("course", memberData)) : "",
    expiryDate: selectedFields.expiryDate
      ? escapeHtml(fieldValue("expiryDate", memberData))
      : "",
    dateJoined: selectedFields.dateJoined
      ? escapeHtml(fieldValue("dateJoined", memberData))
      : "",
    loyaltyPoints: selectedFields.loyaltyPoints
      ? escapeHtml(fieldValue("loyaltyPoints", memberData))
      : "",
    qrCode: selectedFields.qrCode ? qrMarkup : "",
    decorativeArt:
      selectedFields.decorativeArt && memberData.decorativeArtUrl
        ? safeImageMarkup(
            memberData.decorativeArtUrl,
            "gcd-decorative-art",
            "Decorative member art",
          )
        : "",
    backgroundImage: backgroundUrl
      ? safeImageMarkup(backgroundUrl, "gcd-background-image", "")
      : "",
  };

  return sanitizeGeneratedHtml(design.html ?? "").replace(
    /{{\s*([^}]+)\s*}}/g,
    (_, name: string) => placeholders[name.trim()] ?? "",
  );
}
