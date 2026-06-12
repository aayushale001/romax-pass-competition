import type { GeneratedCardDesign } from "@/types/card";

export type VisualReviewFingerprints = Record<string, string>;

export function createDesignFingerprint(concept: GeneratedCardDesign) {
  const value = JSON.stringify({
    id: concept.id,
    html: concept.html,
    css: concept.css,
    requiredFields: concept.requiredFields,
    designTokens: concept.designTokens,
  });
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

export function hasReviewedFingerprint(
  concept: GeneratedCardDesign,
  fingerprints: VisualReviewFingerprints | undefined,
) {
  return fingerprints?.[concept.id] === createDesignFingerprint(concept);
}

export function markReviewedFingerprints(
  concepts: GeneratedCardDesign[],
  fingerprints: VisualReviewFingerprints | undefined = {},
) {
  return concepts.reduce<VisualReviewFingerprints>(
    (nextFingerprints, concept) => ({
      ...nextFingerprints,
      [concept.id]: createDesignFingerprint(concept),
    }),
    { ...fingerprints },
  );
}
