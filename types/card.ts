export type ScrapedAsset = {
  id: string;
  url: string;
  role:
    | "logoCandidate"
    | "heroCandidate"
    | "profileCandidate"
    | "backgroundCandidate"
    | "unknown";
  confidence: number;
  reason: string;
};

export type BrandColorUsage =
  | "subtle"
  | "balanced"
  | "dominant"
  | "full-background"
  | "gradient"
  | "split-panel";

export type BrandCreationSource =
  | "website"
  | "prompt"
  | "reference-image"
  | "physical-card"
  | "visiting-card";

export type ReferenceImageMode = "match-original" | "design-inspiration";

export type BrandProfile = {
  websiteUrl: string;
  businessName: string;
  description: string;
  industry: string;
  logoUrl?: string | null;
  logoMode: "image" | "text-only" | "none";
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  themeColor?: string;
  brandColorUsage: BrandColorUsage;
  headings: string[];
  images: string[];
  assets: ScrapedAsset[];
  selectedHeroImageUrl?: string | null;
  selectedBackgroundImageUrl?: string | null;
  selectedProfileImageUrl?: string | null;
  brandTone: string[];
  confirmed: boolean;
  creationSource?: BrandCreationSource;
  referenceImageMode?: ReferenceImageMode;
  referenceImageUrl?: string | null;
  designBrief?: string;
};

export const memberFieldKeys = [
  "name",
  "photo",
  "email",
  "phone",
  "memberId",
  "tier",
  "expiryDate",
  "dateJoined",
  "studentId",
  "course",
  "loyaltyPoints",
  "qrCode",
  "decorativeArt",
] as const;

export type MemberFieldKey = (typeof memberFieldKeys)[number];

export const memberFieldLabels: Record<MemberFieldKey, string> = {
  name: "Name",
  photo: "Photo",
  email: "Email",
  phone: "Phone",
  memberId: "Member ID",
  tier: "Tier",
  expiryDate: "Expiry date",
  dateJoined: "Date joined",
  studentId: "Student ID",
  course: "Course",
  loyaltyPoints: "Loyalty points",
  qrCode: "QR code",
  decorativeArt: "Art slot",
};

export type SelectedFields = Record<MemberFieldKey, boolean>;

export type GeneratedCardDesign = {
  id: string;
  name: string;
  description: string;
  mood:
    | "official"
    | "minimal"
    | "premium"
    | "playful"
    | "creative"
    | "cyberpunk"
    | "academic"
    | "luxury"
    | "event"
    | "identity";
  requiredFields: MemberFieldKey[];
  /**
   * Legacy free-form layout. No longer produced by the AI or used at render
   * time — the deterministic scene graph (lib/cardDocument.ts) owns layout now.
   * Kept optional so older saved states still parse.
   */
  html?: string;
  css?: string;
  designTokens: {
    primaryColor: string;
    secondaryColor?: string | null;
    textColor: string;
    /** Card shape: landscape credit-card or tall Apple Wallet pass. */
    orientation?: "landscape" | "portrait";
    backgroundMode:
      | "solid"
      | "gradient"
      | "image"
      | "image-overlay"
      | "pattern";
    colorUsage: "subtle" | "balanced" | "dominant" | "full";
    brandAssetSource?: "none" | "logo" | "hero" | "background";
    brandAssetTreatment?:
      | "standard"
      | "logo-watermark"
      | "background-emblem"
      | "hero-backdrop"
      | "side-emblem";
    brandAssetIntensity?: "subtle" | "medium" | "bold";
    usesLogo: boolean;
    usesQr: boolean;
    usesPhoto: boolean;
    usesDecorativeArt: boolean;
  };
};

export type DesignReviewResult = {
  status: "pass" | "fixed";
  summary: string;
  issues: string[];
  concept: GeneratedCardDesign | null;
};

export type MemberData = {
  name: string;
  photoUrl?: string;
  decorativeArtUrl?: string;
  email?: string;
  phone?: string;
  memberId: string;
  tier?: string;
  expiryDate?: string;
  dateJoined?: string;
  studentId?: string;
  course?: string;
  loyaltyPoints?: string;
};

export type WalletReadyPass = {
  passType: "storeCard" | "generic";
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  barcode: {
    format: "PKBarcodeFormatQR";
    message: string;
  };
  primaryFields: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  secondaryFields: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  auxiliaryFields: Array<{
    key: string;
    label: string;
    value: string;
  }>;
};
