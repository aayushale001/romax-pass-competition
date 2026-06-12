"use client";

import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  MemberFieldKey,
  SelectedFields,
} from "@/types/card";
import { memberFieldKeys } from "@/types/card";
import {
  createFallbackDesigns,
  normalizeGeneratedDesignList,
} from "@/lib/fallbackDesigns";
import { generateMemberId } from "@/lib/generateMemberId";
import type { VisualReviewFingerprints } from "@/lib/designReview";
import type { CardNodeOverrides } from "@/types/cardDocument";
import {
  limitSelectedFieldsForConcept,
  lockedMemberFields,
} from "@/lib/cardFieldPolicy";

const STORAGE_KEY = "romax-pass-ai-state";

export const flowSteps = [
  { label: "Website", href: "/" },
  { label: "Brand", href: "/brand" },
  { label: "Concept", href: "/concepts" },
  { label: "Fields", href: "/fields" },
  { label: "Member", href: "/member" },
  { label: "Export", href: "/export" },
] as const;

export type ConceptSource = "ai" | "local" | "fallback";

export type PassBuilderState = {
  brandProfile: BrandProfile;
  concepts: GeneratedCardDesign[];
  selectedConceptId?: string;
  selectedFields: SelectedFields;
  memberData: MemberData;
  conceptSource?: ConceptSource;
  visualReviewFingerprints?: VisualReviewFingerprints;
  /** Per-concept manual edits from the card editor, keyed by concept id. */
  nodeOverrides?: Record<string, CardNodeOverrides>;
};

export const defaultMemberData: MemberData = {
  name: "",
  memberId: "MEM-0001",
  tier: "Gold",
  email: "",
  phone: "",
  expiryDate: "",
  dateJoined: "",
  studentId: "",
  course: "",
  loyaltyPoints: "",
};

export function createSelectedFields(
  keys: MemberFieldKey[] = [],
): SelectedFields {
  const selected = memberFieldKeys.reduce((accumulator, key) => {
    accumulator[key] = keys.includes(key);
    return accumulator;
  }, {} as SelectedFields);

  for (const key of lockedMemberFields) {
    selected[key] = true;
  }

  return selected;
}

export function isoDateFromNow(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function createDefaultMemberData(brandProfile: BrandProfile): MemberData {
  return {
    ...defaultMemberData,
    memberId: generateMemberId(brandProfile.businessName),
    tier: "Gold",
    dateJoined: isoDateFromNow(0),
    expiryDate: isoDateFromNow(12),
  };
}

function createAssetsFromImages(images: string[] = []) {
  return images.slice(0, 20).map((url, index) => ({
    id: `legacy-asset-${index + 1}`,
    url,
    role: "unknown" as const,
    confidence: 0.2,
    reason: "Imported from an earlier scrape before asset classification.",
  }));
}

function migrateBrandProfile(brandProfile: BrandProfile): BrandProfile {
  const images = Array.isArray(brandProfile.images) ? brandProfile.images : [];
  const assets =
    Array.isArray(brandProfile.assets) && brandProfile.assets.length
      ? brandProfile.assets
      : createAssetsFromImages(images);
  const logoMode =
    brandProfile.logoMode ?? (brandProfile.logoUrl ? "image" : "text-only");

  return {
    ...brandProfile,
    logoUrl: brandProfile.logoUrl ?? null,
    logoMode,
    brandColorUsage: brandProfile.brandColorUsage ?? "balanced",
    images,
    assets,
    selectedHeroImageUrl: brandProfile.selectedHeroImageUrl ?? null,
    selectedBackgroundImageUrl:
      brandProfile.selectedBackgroundImageUrl ??
      assets.find((asset) => asset.role === "backgroundCandidate")?.url ??
      assets.find((asset) => asset.role === "heroCandidate")?.url ??
      null,
    selectedProfileImageUrl: brandProfile.selectedProfileImageUrl ?? null,
    brandTone: brandProfile.brandTone?.length
      ? brandProfile.brandTone
      : ["modern", "professional"],
    confirmed: Boolean(brandProfile.confirmed),
    creationSource: brandProfile.creationSource,
    referenceImageMode: brandProfile.referenceImageMode,
    referenceImageUrl: brandProfile.referenceImageUrl ?? null,
    designBrief: brandProfile.designBrief,
  };
}

function migrateBuilderState(state: PassBuilderState): PassBuilderState {
  const brandProfile = migrateBrandProfile(state.brandProfile);
  const storedConcepts = Array.isArray(state.concepts) ? state.concepts : [];
  const generatedConcepts = storedConcepts.filter(
    (concept) => concept?.designTokens && concept?.mood,
  );
  const concepts = generatedConcepts.length
    ? normalizeGeneratedDesignList(generatedConcepts, brandProfile)
    : storedConcepts.length
      ? createFallbackDesigns(brandProfile)
      : [];
  const selectedConceptId =
    state.selectedConceptId ?? concepts[0]?.id ?? undefined;
  const selectedConcept = concepts.find(
    (concept) => concept.id === selectedConceptId,
  );
  const selectedFields = state.selectedFields ?? createSelectedFields(
    selectedConcept?.requiredFields,
  );

  return {
    ...state,
    brandProfile,
    concepts,
    selectedConceptId,
    selectedFields: selectedConcept
      ? limitSelectedFieldsForConcept(selectedConcept, selectedFields)
      : selectedFields,
    memberData: {
      ...createDefaultMemberData(brandProfile),
      ...state.memberData,
    },
    visualReviewFingerprints: state.visualReviewFingerprints ?? {},
  };
}

export async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

export function createBrandReviewState(
  brandProfile: BrandProfile,
): PassBuilderState {
  const reviewedBrandProfile = migrateBrandProfile(brandProfile);

  return {
    brandProfile: reviewedBrandProfile,
    concepts: [],
    selectedConceptId: undefined,
    selectedFields: createSelectedFields(),
    memberData: createDefaultMemberData(reviewedBrandProfile),
    visualReviewFingerprints: {},
  };
}

export function createInitialState(
  brandProfile: BrandProfile,
  concepts: GeneratedCardDesign[],
  conceptSource: ConceptSource,
): PassBuilderState {
  const reviewedBrandProfile = {
    ...migrateBrandProfile(brandProfile),
    confirmed: true,
  };
  const normalizedConcepts = normalizeGeneratedDesignList(
    concepts,
    reviewedBrandProfile,
  );
  const firstConcept = normalizedConcepts[0];
  const selectedFields = createSelectedFields(firstConcept?.requiredFields);

  return {
    brandProfile: reviewedBrandProfile,
    concepts: normalizedConcepts,
    selectedConceptId: firstConcept?.id,
    selectedFields: firstConcept
      ? limitSelectedFieldsForConcept(firstConcept, selectedFields)
      : selectedFields,
    memberData: createDefaultMemberData(reviewedBrandProfile),
    conceptSource,
    visualReviewFingerprints: {},
  };
}

export function loadBuilderState(): PassBuilderState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? migrateBuilderState(JSON.parse(raw) as PassBuilderState) : null;
  } catch {
    return null;
  }
}

function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

function compactBrandProfileForStorage(
  brandProfile: BrandProfile,
): BrandProfile {
  return {
    ...brandProfile,
    images: brandProfile.images.filter((url) => !isDataUrl(url)),
  };
}

function compactBuilderStateForStorage(
  state: PassBuilderState,
): PassBuilderState {
  return {
    ...state,
    brandProfile: compactBrandProfileForStorage(state.brandProfile),
  };
}

function isStorageQuotaError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function saveBuilderState(state: PassBuilderState) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(compactBuilderStateForStorage(state)),
    );
  } catch (error) {
    if (isStorageQuotaError(error)) {
      throw new Error(
        "Browser storage is full. Remove oversized uploaded images or start a new card, then upload compressed images again.",
      );
    }

    throw error;
  }
}

export function clearBuilderState() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getSelectedConcept(state: PassBuilderState | null) {
  if (!state) {
    return undefined;
  }

  return state.concepts.find(
    (concept) => concept.id === state.selectedConceptId,
  );
}
