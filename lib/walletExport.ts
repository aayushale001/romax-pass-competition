import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  MemberFieldKey,
  SelectedFields,
  WalletReadyPass,
} from "@/types/card";
import { memberFieldLabels } from "@/types/card";

const secondaryFieldKeys: MemberFieldKey[] = [
  "tier",
  "expiryDate",
  "studentId",
  "course",
];

const auxiliaryFieldKeys: MemberFieldKey[] = [
  "email",
  "phone",
  "dateJoined",
  "loyaltyPoints",
];

function fieldValue(key: MemberFieldKey, memberData: MemberData) {
  if (key === "name") {
    return memberData.name || "Member Name";
  }

  if (key === "memberId") {
    return memberData.memberId || "MEM-0001";
  }

  return memberData[key as keyof MemberData]?.toString() ?? "";
}

function passTypeForIndustry(industry: string): WalletReadyPass["passType"] {
  const value = industry.toLowerCase();
  return value.includes("retail") ||
    value.includes("fitness") ||
    value.includes("restaurant") ||
    value.includes("hospitality")
    ? "storeCard"
    : "generic";
}

export function createVerificationMessage(
  brandProfile: BrandProfile,
  memberData: MemberData,
) {
  return JSON.stringify({
    type: "membership-verification",
    business: brandProfile.businessName,
    memberId: memberData.memberId || "MEM-0001",
    website: brandProfile.websiteUrl,
  });
}

function toWalletField(key: MemberFieldKey, memberData: MemberData) {
  return {
    key,
    label: memberFieldLabels[key],
    value: fieldValue(key, memberData),
  };
}

export function createWalletReadyPass(
  brandProfile: BrandProfile,
  concept: GeneratedCardDesign,
  selectedFields: SelectedFields,
  memberData: MemberData,
): WalletReadyPass {
  const primaryFields = [
    toWalletField("name", memberData),
    toWalletField("memberId", memberData),
  ].filter((field) => selectedFields[field.key as MemberFieldKey]);

  const secondaryFields = secondaryFieldKeys
    .filter((key) => selectedFields[key])
    .map((key) => toWalletField(key, memberData));

  const auxiliaryFields = auxiliaryFieldKeys
    .filter((key) => selectedFields[key])
    .map((key) => toWalletField(key, memberData));

  return {
    passType: passTypeForIndustry(brandProfile.industry),
    organizationName: brandProfile.businessName,
    description: brandProfile.description || `${brandProfile.businessName} pass`,
    logoText: brandProfile.businessName,
    foregroundColor: concept.designTokens.textColor,
    backgroundColor: concept.designTokens.primaryColor,
    labelColor: concept.designTokens.secondaryColor ?? concept.designTokens.primaryColor,
    barcode: {
      format: "PKBarcodeFormatQR",
      message: createVerificationMessage(brandProfile, memberData),
    },
    primaryFields,
    secondaryFields,
    auxiliaryFields,
  };
}
