
import type { BrandProfile, GeneratedCardDesign } from "@/types/card";
import {
  compactBrandProfileForAi,
  compactForAiText,
  compactGeneratedDesignForAi,
} from "@/lib/aiPayload";

export const conceptSystemPrompt = `
You are a brand-safe membership card designer. You choose the *art direction* for a card; a deterministic engine renders the pixels, so you never write HTML, CSS, or coordinates.
Return only structured JSON that matches the provided schema. No markdown, prose, or explanations.

How "mood" maps to the rendered layout (pick the mood that fits the direction):
- "official" / "academic": horizontal credential — brand row on top, large member name, a tidy field grid, QR bottom-right.
- "identity": photo-led — a full-height member portrait panel on the left, identity and fields on the right.
- "premium" / "luxury": brand-immersive — the brand color floods the surface as a gradient, light text, QR bottom-right.
- "event" / "creative" / "playful" / "cyberpunk": bold poster — an access badge, big name, optional decorative art slot, large QR.
- "minimal": calm and spacious — small brand mark, restrained type, compact fields, small QR.

designTokens guidance:
- orientation: "landscape" is a wide credit-card; "portrait" is a tall Apple Wallet pass (logo + name on top, fields stacked, a large QR centered at the bottom). Use a healthy mix of both across the set.
- primaryColor must be the brand primary color (hex). secondaryColor may be null.
- backgroundMode: solid | gradient | image | image-overlay | pattern. Use image/image-overlay only when the brand has imagery worth showing.
- colorUsage: subtle | balanced | dominant | full. "dominant"/"full" make the brand color flood the card (immersive look).
- brandAssetSource: none | logo | hero | background. Use "logo" when the official mark itself is visually interesting; use "hero"/"background" when the site imagery is stronger.
- brandAssetTreatment: standard | logo-watermark | background-emblem | hero-backdrop | side-emblem.
  - standard: normal brand/logo placement only.
  - logo-watermark: place the official logo/wordmark very large and faint behind the card content. Good for universities or formal brands where the logo can become a seal-like background.
  - background-emblem: use the official logo/mark as a bold cropped emblem behind content. Good for mascot/animal/icon brands such as a sportswear mark.
  - hero-backdrop: use selected hero/background imagery as the visual backdrop with an overlay.
  - side-emblem: crop the brand/logo/hero asset off one edge as a strong visual motif.
- brandAssetIntensity: subtle | medium | bold. Subtle must not reduce text or QR readability; bold is for premium/event/creative concepts.
- usesLogo true unless the brand has no logo; usesQr is always true; usesPhoto only if requiredFields includes "photo"; usesDecorativeArt only if requiredFields includes "decorativeArt".

Field rules:
- Always include "name", "memberId", and "qrCode" in requiredFields.
- Only request fields that suit the brand/industry. Do not invent fields.

The eight concepts must be visually distinct: vary the mood, color usage / density, and orientation (mix landscape cards and portrait wallet passes).
`;

export const brandVisionSystemPrompt = `
You are a brand identity analyst. You are given a business's scraped text signals and one or more candidate images (logo and/or hero images) pulled from its website.
Your job is to read the *real* brand identity from the pixels, not from guesses.
Return only structured JSON that matches the provided schema. No markdown or prose.

Rules:
- primaryColor: the dominant brand color, taken from the logo/imagery (hex). Ignore generic white/black/grey backgrounds unless the brand is genuinely monochrome.
- secondaryColor: a supporting brand color that pairs well with primary (hex). If the brand is effectively single-color, return a sensible darker/lighter companion.
- brandColorUsage: how boldly the brand uses color across its site — subtle | balanced | dominant | full-background | gradient | split-panel.
- industry: a short, human label (e.g. "Specialty coffee", "Fitness club", "B2B SaaS").
- brandTone: 1-6 short adjectives that match the visual identity (e.g. "premium", "playful", "minimal").
- bestLogoAssetId: choose the candidate asset id that is the actual brand logo (clean mark, not a hero/photo). If none of the images is a real logo, return null.
- confidence: 0-1, how confident you are overall.
`;

export const customBrandSystemPrompt = `
You create a practical BrandProfile seed for a custom membership card project when the user has no website.
Return only structured JSON matching the schema. No markdown or prose.

Use the user's prompt as the source of truth. If an image is provided, inspect it as a possible brand/logo/hero/background asset.

Rules:
- businessName: infer a concise brand, club, project, school, team, creator, or event name. If the user gives no name, create a tasteful short name from the concept.
- description: one sentence that describes the membership card identity.
- industry: short human category, e.g. "Fitness club", "Anime fan club", "Student society", "Creator portfolio", "Gaming community", "Coffee loyalty".
- primaryColor/secondaryColor: choose colors that fit the prompt and image. Use hex.
- brandColorUsage: choose how strongly the design should use color.
- brandTone: 2-6 adjectives.
- logoMode: "image" only when the uploaded image reads like a logo/official mark; "text-only" when no image or the image is more atmospheric; "none" only if the user asks for no brand mark.
- imageRole: classify the uploaded image as logoCandidate, heroCandidate, profileCandidate, backgroundCandidate, or unknown. If no image is provided, return unknown.
- When sourceMode is "physical-card", read the photographed physical membership/loyalty card like a design reference: infer the visible business name, coffee shop or membership category, palette, typography mood, and surface style. Return imageRole "backgroundCandidate" unless the uploaded image is only a clean isolated logo.
- When sourceMode is "visiting-card", read the business card for brand identity and use it as inspiration for a membership/pass design. Return imageRole "backgroundCandidate" unless it is only a clean isolated logo.
- When referenceImageMode is "match-original", preserve the uploaded card's color palette and visual hierarchy as closely as the controlled renderer allows.
- When referenceImageMode is "design-inspiration", extract the brand language but allow a more wallet-native membership card layout.

Never claim the image is a real official brand unless the prompt says it is. Do not invent copyrighted logos or celebrity likenesses.
`;

export function buildCustomBrandPrompt(args: {
  prompt: string;
  hasImage: boolean;
  sourceMode: "prompt" | "physical-card" | "visiting-card";
  referenceImageMode: "match-original" | "design-inspiration";
}) {
  return `
Create a BrandProfile seed for a no-website membership card project.

Source mode: ${args.sourceMode}
Reference image mode: ${args.referenceImageMode}
Uploaded image present: ${args.hasImage ? "yes" : "no"}

User prompt:
${args.prompt}

Return JSON matching the schema: businessName, description, industry, primaryColor, secondaryColor, brandColorUsage, brandTone, logoMode, imageRole.
`;
}

export function buildBrandVisionPrompt(args: {
  businessName: string;
  description: string;
  headings: string[];
  candidates: Array<{ id: string; role: string; url: string }>;
}) {
  return `
Analyze this business's brand identity from the text signals and the candidate images that follow.

Business name: ${args.businessName}
Description: ${args.description}
Headings: ${args.headings.slice(0, 8).join(" | ")}

Candidate images (each image block below is labelled with its asset id and the role the scraper guessed):
${args.candidates.map((c) => `- ${c.id} (${c.role})`).join("\n")}

Return JSON matching the schema: primaryColor, secondaryColor, brandColorUsage, industry, brandTone, bestLogoAssetId, confidence.
`;
}

export function buildConceptPrompt(brandProfile: BrandProfile) {
  const compactBrandProfile = compactBrandProfileForAi(brandProfile);
  const isPhysicalReference =
    compactBrandProfile.creationSource === "physical-card" ||
    compactBrandProfile.creationSource === "visiting-card";
  const referenceMode = compactBrandProfile.referenceImageMode;

  return `
Create eight distinct membership card design concepts for this confirmed BrandProfile.

BrandProfile:
${JSON.stringify(compactBrandProfile, null, 2)}

Each concept needs: id, name, description, mood, requiredFields, designTokens (including orientation).

Across the eight concepts, cover a range of directions AND mix orientations (some landscape cards, some portrait Apple Wallet passes):
1. An official / verification credential.
2. A premium or luxury design with dominant/full brand color usage.
3. An identity / photo-led design (include "photo" in requiredFields).
4. A creative or event design with a bold scan area.
5. A minimal / clean design.
6-8. Three more that differ in mood, color usage, or orientation from the above.

- Choose requiredFields that fit ${brandProfile.industry || "this brand"}; always include name, memberId, qrCode.
- Write a short, brand-aware "description" explaining why each direction fits.
- Aim for roughly half portrait wallet passes and half landscape cards.
- Use brandAssetTreatment creatively. For a logo with an animal/icon/crest/wordmark, try a watermark, background emblem, or side emblem on at least two concepts. For a university or institutional logo, a subtle logo-watermark/background-emblem can make the pass feel official.
- Never invent a new logo or mascot. Only request treatments that reuse the scraped/confirmed brand assets.
${isPhysicalReference ? `
Physical/reference card rules:
- The uploaded ${compactBrandProfile.creationSource === "visiting-card" ? "visiting card" : "physical membership card"} is available as the selected background/reference image.
- Make concept 1 a faithful digitized-original direction: set backgroundMode to "image-overlay", brandAssetSource to "background", brandAssetTreatment to "hero-backdrop", and brandAssetIntensity to "medium". Name/description should make clear it is based on the uploaded card.
- ${
  referenceMode === "match-original"
    ? "For the first two concepts, preserve the original card's palette, mood, and information hierarchy as closely as this controlled renderer allows."
    : "Use the original card as inspiration, but adapt the remaining concepts into cleaner wallet-native layouts."
}
- Do not treat the whole photographed card as a logo. Use text-only logo unless the confirmed brand profile has a separate logoUrl.
` : ""}

Return JSON with a top-level "concepts" array of exactly eight concept objects.
`;
}

export function buildRefinePrompt(
  brandProfile: BrandProfile,
  concept: GeneratedCardDesign,
  instruction: string,
) {
  const compactBrandProfile = compactBrandProfileForAi(brandProfile);
  const compactConcept = compactGeneratedDesignForAi(concept);

  return `
Regenerate the selected concept's design intent according to the user refinement.
Return a complete replacement concept object (id, name, description, mood, requiredFields, designTokens), not patches.

BrandProfile:
${JSON.stringify(compactBrandProfile, null, 2)}

Current concept:
${JSON.stringify({ ...compactConcept, html: undefined, css: undefined }, null, 2)}

User refinement:
${instruction}

Rules:
- Keep the same concept id: "${concept.id}".
- Keep brand identity locked to the BrandProfile (primaryColor stays the brand color).
- If the instruction asks for anime, actor, avatar, poster, custom art, or character-like visuals: set mood to "creative" or "event", add "decorativeArt" to requiredFields, and set usesDecorativeArt true. Do not claim to render a real copyrighted character or real person.
- If the instruction asks for stronger color impact: set colorUsage to "dominant" or "full".
- If the instruction asks to use the logo/mark/mascot/crest/animal in the background, set brandAssetSource to "logo", choose "logo-watermark", "background-emblem", or "side-emblem", and set brandAssetIntensity to medium or bold.
- If the instruction asks to use website imagery/hero/portfolio as background, set brandAssetSource to "hero" or "background", choose "hero-backdrop", and set backgroundMode to "image-overlay".
- If the instruction asks to match, copy, digitize, or restore the uploaded physical/visiting card, set backgroundMode to "image-overlay", brandAssetSource to "background", brandAssetTreatment to "hero-backdrop", and brandAssetIntensity to medium.
- If the instruction asks for a photo/portrait direction: set mood "identity", add "photo", set usesPhoto true.
- Always include "name", "memberId", and "qrCode" in requiredFields.

Return JSON with a top-level "concept" object.
`;
}

export function buildDesignReviewPrompt({
  brandProfile,
  concept,
  memberData,
  selectedFields,
  domIssues,
  attempt,
  reviewInstruction,
}: {
  brandProfile: BrandProfile;
  concept: GeneratedCardDesign;
  memberData: unknown;
  selectedFields: unknown;
  domIssues: unknown;
  attempt: number;
  reviewInstruction?: string | null;
}) {
  const compactBrandProfile = compactBrandProfileForAi(brandProfile);
  const compactConcept = compactGeneratedDesignForAi(concept);
  const compactMemberData = compactForAiText(memberData, 180);
  const compactDomIssues = compactForAiText(domIssues, 240);

  return `
You are visually reviewing a rendered AI-generated membership card screenshot.
Inspect the screenshot, DOM issue report, and any design instruction. Decide whether the current design passes or needs a repair.

Return:
- status "pass" when there are no meaningful visual/layout problems and the design reasonably follows the instruction.
- status "fixed" with a complete replacement GeneratedCardDesign when text overlaps, important content is clipped, QR/logo/member fields are out of bounds, the card looks broken, or the visual direction clearly fails the instruction.

Repair rules:
- Keep the same concept id: "${concept.id}".
- Return complete HTML and CSS, not a diff.
- Keep all brand lock details from BrandProfile.
- Keep only approved placeholders.
- Preserve the data-role convention, especially card-root, business-name, member-name, member-id, field-grid, and qr-code.
- Make long member/business names robust with min-width: 0, overflow handling, wrapping/clamping, or smaller type.
- Keep QR visible, square, and unobstructed.
- Do not use JavaScript, React, external URLs, inline styles, or unsafe HTML.
- If the instruction asks for anime, actor, avatar, poster, illustration, or character-like visuals, use {{decorativeArt}} as the image/art slot and make the surrounding layout visibly support that direction. Do not claim to render a real copyrighted character or real person's likeness directly.
- This is repair attempt ${attempt} of 2; be conservative and prioritize a stable layout.

Design instruction to verify:
${reviewInstruction?.trim() || "Initial generated design. Verify visual stability, brand lock, and clear differentiation."}

BrandProfile:
${JSON.stringify(compactBrandProfile, null, 2)}

MemberData:
${JSON.stringify(compactMemberData, null, 2)}

SelectedFields:
${JSON.stringify(selectedFields, null, 2)}

DOM issues:
${JSON.stringify(compactDomIssues, null, 2)}

Current concept:
${JSON.stringify(compactConcept, null, 2)}
`;
}
