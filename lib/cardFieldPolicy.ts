import type {
  GeneratedCardDesign,
  MemberFieldKey,
  SelectedFields,
} from "@/types/card";
import { memberFieldKeys } from "@/types/card";

export const lockedMemberFields: MemberFieldKey[] = [
  "name",
  "memberId",
  "qrCode",
];

export const detailFieldOrder: MemberFieldKey[] = [
  "memberId",
  "tier",
  "expiryDate",
  "dateJoined",
  "email",
  "phone",
  "studentId",
  "course",
  "loyaltyPoints",
];

export const mediaFieldKeys: MemberFieldKey[] = ["photo", "decorativeArt"];

const detailFieldSet = new Set<MemberFieldKey>(detailFieldOrder);

function archetype(concept: GeneratedCardDesign) {
  switch (concept.mood) {
    case "identity":
      return "identity";
    case "premium":
    case "luxury":
      return "premium";
    case "event":
    case "creative":
    case "playful":
    case "cyberpunk":
      return "event";
    case "minimal":
      return "minimal";
    case "official":
    case "academic":
    default:
      return "official";
  }
}

export function isDetailField(key: MemberFieldKey) {
  return detailFieldSet.has(key);
}

export function selectedDetailFieldCount(fields: SelectedFields) {
  return detailFieldOrder.filter((key) => fields[key]).length;
}

export function getCardDetailFieldLimit(
  concept: GeneratedCardDesign,
  selectedFields?: SelectedFields,
) {
  const isPortrait = concept.designTokens.orientation === "portrait";
  const type = archetype(concept);

  if (isPortrait) {
    return 4;
  }

  if (type === "identity") {
    return 3;
  }

  if (type === "official") {
    return selectedFields?.photo ? 4 : 6;
  }

  return 4;
}

export function limitSelectedFieldsForConcept(
  concept: GeneratedCardDesign,
  fields: SelectedFields,
) {
  const next = memberFieldKeys.reduce((accumulator, key) => {
    accumulator[key] = Boolean(fields[key]);
    return accumulator;
  }, {} as SelectedFields);

  for (const key of lockedMemberFields) {
    next[key] = true;
  }

  for (const key of mediaFieldKeys) {
    next[key] = Boolean(fields[key]);
  }

  const limit = getCardDetailFieldLimit(concept, next);
  let visibleDetailCount = 0;

  for (const key of detailFieldOrder) {
    if (!next[key]) continue;
    visibleDetailCount += 1;
    if (visibleDetailCount > limit) {
      next[key] = false;
    }
  }

  return next;
}
