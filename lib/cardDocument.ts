import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  MemberFieldKey,
  SelectedFields,
} from "@/types/card";
import { memberFieldLabels } from "@/types/card";
import {
  CARD_H,
  CARD_W,
  CARD_BACKGROUND_OVERRIDE_ID,
  PORTRAIT_H,
  PORTRAIT_W,
  surfaceSize,
  type CardDocument,
  type CardDocumentBackground,
  type CardNode,
  type CardNodeOverrides,
  type CardOrientation,
} from "@/types/cardDocument";
import {
  getDeepBackground,
  getMutedAccent,
  getReadableTextColor,
  getSoftBackground,
  mixColors,
  normalizeHexColor,
} from "@/lib/colors";
import {
  detailFieldOrder,
  getCardDetailFieldLimit,
} from "@/lib/cardFieldPolicy";

/**
 * Deterministic layout engine.
 *
 * Given an AI-authored concept (colors / mood / tokens) plus the live member
 * data and the user's selected fields, this produces a fully laid-out
 * CardDocument whose nodes are guaranteed to sit inside the surface, never
 * overlap, and keep the QR square. The AI decides the *art direction*; this
 * function owns the *pixels*. Because the field nodes are generated from
 * `selectedFields` on every build, toggling a field adds/removes a node live.
 */

const PAD = 28;

const FIELD_FALLBACKS: Partial<Record<MemberFieldKey, string>> = {
  email: "member@example.com",
  phone: "+44 7700 900321",
  tier: "Gold",
  expiryDate: "2027-06-01",
  dateJoined: "2026-06-01",
  studentId: "S-48291",
  course: "Design Systems",
  loyaltyPoints: "1,250",
};

type Archetype =
  | "official-horizontal"
  | "identity-photo"
  | "premium-immersive"
  | "event-poster"
  | "minimal-clean";

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "M") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function valueFor(key: MemberFieldKey, member: MemberData) {
  if (key === "name") return member.name || "Avery Morgan";
  if (key === "memberId") return member.memberId || "MEM-0001";
  return (
    member[key as keyof MemberData]?.toString() || FIELD_FALLBACKS[key] || ""
  );
}

function brandBackgroundImage(brandProfile: BrandProfile) {
  return (
    brandProfile.selectedBackgroundImageUrl ??
    brandProfile.selectedHeroImageUrl ??
    brandProfile.images[0] ??
    null
  );
}

function brandHeroImage(brandProfile: BrandProfile) {
  return (
    brandProfile.selectedHeroImageUrl ??
    brandProfile.selectedBackgroundImageUrl ??
    brandProfile.images[0] ??
    null
  );
}

function brandAssetUrl(
  brandProfile: BrandProfile,
  source: NonNullable<GeneratedCardDesign["designTokens"]["brandAssetSource"]>,
) {
  if (
    source === "logo" &&
    brandProfile.logoMode === "image" &&
    brandProfile.logoUrl
  ) {
    return brandProfile.logoUrl;
  }

  if (source === "hero") {
    return brandHeroImage(brandProfile);
  }

  if (source === "background") {
    return brandBackgroundImage(brandProfile);
  }

  return null;
}

function resolveArchetype(design: GeneratedCardDesign): Archetype {
  switch (design.mood) {
    case "identity":
      return "identity-photo";
    case "premium":
    case "luxury":
      return "premium-immersive";
    case "event":
    case "creative":
    case "playful":
    case "cyberpunk":
      return "event-poster";
    case "minimal":
      return "minimal-clean";
    case "official":
    case "academic":
    default:
      return "official-horizontal";
  }
}

function resolveOrientation(design: GeneratedCardDesign): CardOrientation {
  return design.designTokens.orientation === "portrait"
    ? "portrait"
    : "landscape";
}

type Palette = {
  background: CardDocumentBackground;
  /** Text drawn over the surface background. */
  ink: string;
  /** De-emphasised labels. */
  muted: string;
  accent: string;
  /** True when the surface is brand-immersed (dark/coloured) vs light. */
  immersive: boolean;
};

function buildPalette(
  design: GeneratedCardDesign,
  archetype: Archetype,
  brandProfile: BrandProfile,
): Palette {
  const primary = normalizeHexColor(
    design.designTokens.primaryColor,
    brandProfile.primaryColor,
  );
  const secondary = normalizeHexColor(
    design.designTokens.secondaryColor ?? undefined,
    getMutedAccent(primary),
  );
  const heroImage = brandBackgroundImage(brandProfile);
  const wantsImage =
    (design.designTokens.backgroundMode === "image" ||
      design.designTokens.backgroundMode === "image-overlay") &&
    Boolean(heroImage);

  // Immersive surfaces: brand colour dominates, light text on top.
  if (
    archetype === "premium-immersive" ||
    archetype === "event-poster" ||
    design.designTokens.colorUsage === "full" ||
    design.designTokens.colorUsage === "dominant"
  ) {
    const deep = getDeepBackground(primary);
    const onColor = getReadableTextColor(deep);
    return {
      background: wantsImage
        ? {
            type: "image",
            color: deep,
            imageUrl: heroImage ?? undefined,
            overlay: mixColors(deep, "#000000", 0.25),
          }
        : { type: "gradient", color: primary, color2: deep, angle: 145 },
      ink: onColor,
      muted: mixColors(onColor, primary, 0.42),
      accent: onColor === "#ffffff" ? secondary : primary,
      immersive: true,
    };
  }

  // Light surfaces: soft tinted paper, dark ink, brand accent.
  return {
    background: { type: "solid", color: getSoftBackground(primary) },
    ink: "#111827",
    muted: "#6b7280",
    accent: primary,
    immersive: false,
  };
}

/** Lay labelled fields into a rectangle as a wrapping grid; caps to fit. */
function placeFields(
  keys: MemberFieldKey[],
  member: MemberData,
  rect: { x: number; y: number; w: number; h: number },
  options: { columns: number; ink: string; muted: string; accent: string },
): CardNode[] {
  const { columns } = options;
  const rowH = 40;
  const colGap = 16;
  const maxRows = Math.max(1, Math.floor(rect.h / rowH));
  const visible = keys.slice(0, columns * maxRows);
  const cellW = (rect.w - colGap * (columns - 1)) / columns;

  return visible.map((key, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: `field-${key}`,
      type: "field",
      role: `field-${key}`,
      binding: key,
      x: rect.x + col * (cellW + colGap),
      y: rect.y + row * rowH,
      w: cellW,
      h: rowH - 6,
      label: memberFieldLabels[key],
      text: valueFor(key, member),
      color: options.ink,
      fontSize: 14,
      fontWeight: 600,
      align: "left",
    };
  });
}

function brandNodes(
  brandProfile: BrandProfile,
  palette: Palette,
  origin: { x: number; y: number },
  logoSize = 38,
  surfaceW = CARD_W,
  rightInset = PAD,
): CardNode[] {
  const nodes: CardNode[] = [];
  const showLogoImage =
    brandProfile.logoMode === "image" && Boolean(brandProfile.logoUrl);
  const showInitials = brandProfile.logoMode !== "none";

  if (showLogoImage || showInitials) {
    nodes.push({
      id: "logo",
      type: "logo",
      role: "logo",
      x: origin.x,
      y: origin.y,
      w: logoSize,
      h: logoSize,
      imageUrl: showLogoImage ? brandProfile.logoUrl ?? undefined : undefined,
      imageFit: "contain",
      fallbackText: getInitials(brandProfile.businessName),
      fill: palette.immersive ? mixColors(palette.ink, palette.accent, 0.7) : "#ffffff",
      color: palette.immersive ? palette.accent : palette.ink,
      radius: 9,
    });
  }

  const textX =
    showLogoImage || showInitials ? origin.x + logoSize + 12 : origin.x;
  nodes.push({
    id: "business-name",
    type: "text",
    role: "business-name",
    binding: "businessName",
    x: textX,
    y: origin.y + 2,
    w: surfaceW - textX - rightInset,
    h: logoSize,
    text: brandProfile.businessName,
    color: palette.ink,
    fontSize: 19,
    fontWeight: 800,
    align: "left",
    lineClamp: 2,
    letterSpacing: 0,
  });

  return nodes;
}

function qrNode(
  x: number,
  y: number,
  size: number,
  immersive: boolean,
): CardNode {
  return {
    id: "qr",
    type: "qr",
    role: "qr-code",
    x,
    y,
    w: size,
    h: size,
    fill: "#ffffff",
    radius: 12,
    borderColor: immersive ? "transparent" : "#e5e7eb",
  };
}

function treatmentOpacity(
  intensity: NonNullable<GeneratedCardDesign["designTokens"]["brandAssetIntensity"]>,
  base: "mark" | "image",
) {
  if (base === "image") {
    if (intensity === "bold") return 0.42;
    if (intensity === "medium") return 0.3;
    return 0.2;
  }

  if (intensity === "bold") return 0.22;
  if (intensity === "medium") return 0.14;
  return 0.08;
}

function brandAssetNodes(
  design: GeneratedCardDesign,
  brandProfile: BrandProfile,
  orientation: CardOrientation,
): CardNode[] {
  const source = design.designTokens.brandAssetSource ?? "none";
  const treatment = design.designTokens.brandAssetTreatment ?? "standard";
  const intensity = design.designTokens.brandAssetIntensity ?? "subtle";

  if (source === "none" || treatment === "standard") {
    return [];
  }

  const imageUrl = brandAssetUrl(brandProfile, source);
  if (!imageUrl) {
    return [];
  }

  const { width: W, height: H } = surfaceSize(orientation);
  const imageFit = source === "logo" ? "contain" : "cover";
  const imageBase: Pick<CardNode, "type" | "role" | "imageUrl" | "imageFit" | "z"> = {
    type: "image",
    role: "brand-asset",
    imageUrl,
    imageFit,
    z: 0,
  };

  if (treatment === "hero-backdrop") {
    return [
      {
        ...imageBase,
        id: "brand-hero-backdrop",
        x: 0,
        y: 0,
        w: W,
        h: H,
        opacity: treatmentOpacity(intensity, "image"),
      },
    ];
  }

  if (treatment === "side-emblem") {
    return [
      {
        ...imageBase,
        id: "brand-side-emblem",
        x: orientation === "portrait" ? W * 0.48 : W * 0.58,
        y: orientation === "portrait" ? H * 0.12 : H * 0.08,
        w: orientation === "portrait" ? W * 0.7 : W * 0.56,
        h: orientation === "portrait" ? H * 0.55 : H * 0.8,
        opacity: treatmentOpacity(intensity, source === "logo" ? "mark" : "image"),
      },
    ];
  }

  if (treatment === "background-emblem") {
    return [
      {
        ...imageBase,
        id: "brand-background-emblem",
        x: orientation === "portrait" ? W * 0.03 : W * 0.18,
        y: orientation === "portrait" ? H * 0.13 : H * 0.02,
        w: orientation === "portrait" ? W * 0.94 : W * 0.76,
        h: orientation === "portrait" ? H * 0.55 : H * 0.9,
        opacity: treatmentOpacity(intensity, source === "logo" ? "mark" : "image"),
      },
    ];
  }

  return [
    {
      ...imageBase,
      id: "brand-logo-watermark",
      x: orientation === "portrait" ? W * 0.06 : W * 0.28,
      y: orientation === "portrait" ? H * 0.18 : H * 0.14,
      w: orientation === "portrait" ? W * 0.88 : W * 0.66,
      h: orientation === "portrait" ? H * 0.42 : H * 0.62,
      opacity: treatmentOpacity(intensity, "mark"),
    },
  ];
}

function photoNode(
  brandProfile: BrandProfile,
  memberData: MemberData,
  selectedFields: SelectedFields,
  frame: { x: number; y: number; w: number; h: number },
  radius: number,
): CardNode {
  const hasPhoto = selectedFields.photo && Boolean(memberData.photoUrl);
  return {
    id: "member-photo",
    type: "image",
    role: "member-photo",
    binding: "photo",
    ...frame,
    imageUrl: hasPhoto ? memberData.photoUrl : undefined,
    imageFit: "cover",
    fallbackText: "PH",
    fill: mixColors(brandProfile.primaryColor, "#ffffff", 0.78),
    color: brandProfile.primaryColor,
    radius,
  };
}

function nameNode(
  memberData: MemberData,
  palette: Palette,
  frame: { x: number; y: number; w: number },
  fontSize = 38,
): CardNode {
  return {
    id: "member-name",
    type: "text",
    role: "member-name",
    binding: "name",
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: fontSize * 1.7,
    text: valueFor("name", memberData),
    color: palette.ink,
    fontSize,
    fontWeight: 800,
    align: "left",
    lineClamp: 2,
    letterSpacing: 0,
  };
}

function selectedDetailKeys(
  selectedFields: SelectedFields,
  limit: number,
): MemberFieldKey[] {
  return detailFieldOrder
    .filter((key) => selectedFields[key])
    .slice(0, limit);
}

function buildNodes(
  design: GeneratedCardDesign,
  brandProfile: BrandProfile,
  memberData: MemberData,
  selectedFields: SelectedFields,
  archetype: Archetype,
  palette: Palette,
): CardNode[] {
  const detailKeys = selectedDetailKeys(
    selectedFields,
    getCardDetailFieldLimit(design, selectedFields),
  );
  const showPhotoSlot = selectedFields.photo;
  const showDecorativeArt =
    selectedFields.decorativeArt && Boolean(memberData.decorativeArtUrl);

  if (archetype === "identity-photo") {
    const photoW = 188;
    const contentX = photoW + PAD;
    const qrSize = 96;
    // Reserve the bottom-right QR column so fields never collide with it.
    const fieldsRight = CARD_W - PAD - qrSize - 24;
    const nodes: CardNode[] = [
      photoNode(
        brandProfile,
        memberData,
        selectedFields,
        { x: 0, y: 0, w: photoW, h: CARD_H },
        0,
      ),
      ...brandNodes(brandProfile, palette, { x: contentX, y: 26 }),
      nameNode(
        memberData,
        palette,
        { x: contentX, y: 96, w: CARD_W - contentX - PAD },
        34,
      ),
      ...placeFields(
        detailKeys,
        memberData,
        { x: contentX, y: 168, w: fieldsRight - contentX, h: 120 },
        { columns: 1, ink: palette.ink, muted: palette.muted, accent: palette.accent },
      ),
      qrNode(CARD_W - PAD - qrSize, CARD_H - PAD - qrSize, qrSize, palette.immersive),
    ];
    return nodes;
  }

  if (archetype === "premium-immersive") {
    const qrSize = 104;
    const photoSize = showPhotoSlot ? 78 : 0;
    return [
      ...brandNodes(
        brandProfile,
        palette,
        { x: PAD, y: 30 },
        40,
        CARD_W,
        showPhotoSlot ? photoSize + PAD + 16 : PAD,
      ),
      showPhotoSlot
        ? photoNode(
            brandProfile,
            memberData,
            selectedFields,
            { x: CARD_W - PAD - photoSize, y: 28, w: photoSize, h: photoSize },
            16,
          )
        : null,
      {
        id: "tagline",
        type: "text",
        role: "tagline",
        x: PAD,
        y: 84,
        w: CARD_W - PAD * 2,
        h: 22,
        text: "Official membership",
        color: palette.muted,
        fontSize: 12,
        fontWeight: 600,
        uppercase: true,
        letterSpacing: 2,
      },
      nameNode(
        memberData,
        palette,
        { x: PAD, y: 150, w: CARD_W - PAD * 2 },
        40,
      ),
      ...placeFields(
        detailKeys,
        memberData,
        { x: PAD, y: 232, w: CARD_W - PAD * 2 - qrSize - 24, h: 84 },
        { columns: 2, ink: palette.ink, muted: palette.muted, accent: palette.accent },
      ),
      qrNode(CARD_W - PAD - qrSize, CARD_H - PAD - qrSize, qrSize, palette.immersive),
    ].filter(Boolean) as CardNode[];
  }

  if (archetype === "event-poster") {
    const qrSize = 112;
    const artW = showDecorativeArt ? 150 : showPhotoSlot ? 104 : 0;
    const nodes: CardNode[] = [
      ...brandNodes(
        brandProfile,
        palette,
        { x: PAD, y: 28 },
        40,
        CARD_W,
        artW ? artW + PAD + 14 : PAD,
      ),
      {
        id: "badge",
        type: "text",
        role: "badge",
        x: PAD,
        y: 86,
        w: CARD_W - PAD * 2 - artW,
        h: 20,
        text: "MEMBER ACCESS",
        color: palette.accent,
        fontSize: 11,
        fontWeight: 700,
        uppercase: true,
        letterSpacing: 3,
      },
      nameNode(
        memberData,
        palette,
        { x: PAD, y: 132, w: CARD_W - PAD * 2 - artW },
        42,
      ),
      ...placeFields(
        detailKeys,
        memberData,
        { x: PAD, y: 224, w: CARD_W - PAD * 2 - qrSize - 24, h: 84 },
        { columns: 2, ink: palette.ink, muted: palette.muted, accent: palette.accent },
      ),
      qrNode(CARD_W - PAD - qrSize, CARD_H - PAD - qrSize, qrSize, palette.immersive),
    ];
    if (showDecorativeArt) {
      nodes.splice(1, 0, {
        id: "decorative-art",
        type: "image",
        role: "decorative-art",
        binding: "decorativeArt",
        x: CARD_W - PAD - artW,
        y: 24,
        w: artW,
        h: 168,
        imageUrl: memberData.decorativeArtUrl,
        imageFit: "cover",
        radius: 14,
        fill: mixColors(palette.accent, "#000000", 0.2),
      });
    }
    if (showPhotoSlot) {
      nodes.splice(
        showDecorativeArt ? 2 : 1,
        0,
        photoNode(
          brandProfile,
          memberData,
          selectedFields,
          {
            x: CARD_W - PAD - (showDecorativeArt ? 68 : artW),
            y: showDecorativeArt ? 32 : 28,
            w: showDecorativeArt ? 68 : artW,
            h: showDecorativeArt ? 68 : 138,
          },
          showDecorativeArt ? 34 : 16,
        ),
      );
    }
    return nodes;
  }

  if (archetype === "minimal-clean") {
    const qrSize = 86;
    const photoSize = showPhotoSlot ? 64 : 0;
    return [
      ...brandNodes(
        brandProfile,
        palette,
        { x: PAD, y: 30 },
        34,
        CARD_W,
        showPhotoSlot ? photoSize + PAD + 16 : PAD,
      ),
      showPhotoSlot
        ? photoNode(
            brandProfile,
            memberData,
            selectedFields,
            { x: CARD_W - PAD - photoSize, y: 28, w: photoSize, h: photoSize },
            14,
          )
        : null,
      nameNode(
        memberData,
        palette,
        { x: PAD, y: 132, w: CARD_W - PAD * 2 },
        32,
      ),
      ...placeFields(
        detailKeys,
        memberData,
        { x: PAD, y: 206, w: CARD_W - PAD * 2 - qrSize - 24, h: 80 },
        { columns: 2, ink: palette.ink, muted: palette.muted, accent: palette.accent },
      ),
      qrNode(CARD_W - PAD - qrSize, CARD_H - PAD - qrSize, qrSize, palette.immersive),
    ].filter(Boolean) as CardNode[];
  }

  // official-horizontal (default)
  const qrSize = 110;
  const officialPhotoSize = showPhotoSlot ? 92 : 0;
  const nameX = showPhotoSlot ? PAD + officialPhotoSize + 18 : PAD;
  const nameY = showPhotoSlot ? 110 : 104;
  const fieldsY = showPhotoSlot ? 222 : 188;
  const fieldsH = CARD_H - PAD - fieldsY;
  return [
    {
      id: "brand-rule",
      type: "panel",
      role: "decoration",
      x: PAD,
      y: 80,
      w: CARD_W - PAD * 2,
      h: 2,
      fill: mixColors(palette.accent, palette.background.color, 0.4),
      radius: 2,
    },
    ...brandNodes(brandProfile, palette, { x: PAD, y: 28 }, 40),
    showPhotoSlot
      ? photoNode(
          brandProfile,
          memberData,
          selectedFields,
          {
            x: PAD,
            y: 104,
            w: officialPhotoSize,
            h: officialPhotoSize,
          },
          16,
        )
      : null,
    nameNode(
      memberData,
      palette,
      {
        x: nameX,
        y: nameY,
        w: CARD_W - nameX - PAD - qrSize - 24,
      },
      showPhotoSlot ? 32 : 36,
    ),
    ...placeFields(
      detailKeys,
      memberData,
      { x: PAD, y: fieldsY, w: CARD_W - PAD * 2 - qrSize - 24, h: fieldsH },
      { columns: 2, ink: palette.ink, muted: palette.muted, accent: palette.accent },
    ),
    qrNode(CARD_W - PAD - qrSize, CARD_H - PAD - qrSize, qrSize, palette.immersive),
  ].filter(Boolean) as CardNode[];
}

/**
 * Portrait (Apple Wallet pass) layouts. Tall surface, left-aligned header and
 * fields, and a large QR centered along the bottom — the wallet-pass anatomy.
 */
function buildPortraitNodes(
  brandProfile: BrandProfile,
  memberData: MemberData,
  selectedFields: SelectedFields,
  archetype: Archetype,
  palette: Palette,
): CardNode[] {
  const W = PORTRAIT_W;
  const H = PORTRAIT_H;
  const pad = 24;
  const detailKeys = selectedDetailKeys(selectedFields, 4);
  const fieldOpts = {
    ink: palette.ink,
    muted: palette.muted,
    accent: palette.accent,
  };

  // Barcode block: centered horizontally near the bottom, with a caption.
  const qrSize = 140;
  const qrX = (W - qrSize) / 2;
  const qrY = H - pad - qrSize - 22;
  const qrCaption: CardNode = {
    id: "qr-caption",
    type: "text",
    role: "tagline",
    x: pad,
    y: H - pad - 16,
    w: W - pad * 2,
    h: 16,
    text: "Scan to verify membership",
    color: palette.muted,
    fontSize: 10,
    fontWeight: 600,
    align: "center",
    uppercase: true,
    letterSpacing: 1.4,
  };
  const qr = qrNode(qrX, qrY, qrSize, palette.immersive);
  const showPhotoSlot = selectedFields.photo;
  const portraitPhotoSize = showPhotoSlot ? 62 : 0;

  if (archetype === "identity-photo") {
    const photo = 100;
    return [
      ...brandNodes(brandProfile, palette, { x: pad, y: 24 }, 32, W),
      photoNode(
        brandProfile,
        memberData,
        selectedFields,
        { x: pad, y: 84, w: photo, h: photo },
        16,
      ),
      nameNode(
        memberData,
        palette,
        { x: pad + photo + 14, y: 92, w: W - pad - (pad + photo + 14) },
        24,
      ),
      ...placeFields(
        detailKeys,
        memberData,
        { x: pad, y: 184, w: W - pad * 2, h: 84 },
        { columns: 2, ...fieldOpts },
      ),
      qr,
      qrCaption,
    ];
  }

  if (archetype === "premium-immersive" || archetype === "event-poster") {
    return [
      ...brandNodes(
        brandProfile,
        palette,
        { x: pad, y: 28 },
        38,
        W,
        showPhotoSlot ? portraitPhotoSize + pad + 12 : pad,
      ),
      showPhotoSlot
        ? photoNode(
            brandProfile,
            memberData,
            selectedFields,
            {
              x: W - pad - portraitPhotoSize,
              y: 26,
              w: portraitPhotoSize,
              h: portraitPhotoSize,
            },
            14,
          )
        : null,
      {
        id: "badge",
        type: "text",
        role: "badge",
        x: pad,
        y: 86,
        w: W - pad * 2,
        h: 18,
        text:
          archetype === "event-poster"
            ? "MEMBER ACCESS"
            : "OFFICIAL MEMBERSHIP",
        color: palette.accent,
        fontSize: 11,
        fontWeight: 700,
        uppercase: true,
        letterSpacing: 2.5,
      },
      nameNode(memberData, palette, { x: pad, y: 122, w: W - pad * 2 }, 34),
      ...placeFields(
        detailKeys,
        memberData,
        { x: pad, y: 188, w: W - pad * 2, h: 84 },
        { columns: 2, ...fieldOpts },
      ),
      qr,
      qrCaption,
    ].filter(Boolean) as CardNode[];
  }

  // official-horizontal / minimal-clean default → wallet standard
  return [
    {
      id: "brand-rule",
      type: "panel",
      role: "decoration",
      x: pad,
      y: 74,
      w: W - pad * 2,
      h: 2,
      fill: mixColors(palette.accent, palette.background.color, 0.4),
      radius: 2,
    },
    ...brandNodes(
      brandProfile,
      palette,
      { x: pad, y: 26 },
      36,
      W,
      showPhotoSlot ? portraitPhotoSize + pad + 12 : pad,
    ),
    showPhotoSlot
      ? photoNode(
          brandProfile,
          memberData,
          selectedFields,
          {
            x: W - pad - portraitPhotoSize,
            y: 24,
            w: portraitPhotoSize,
            h: portraitPhotoSize,
          },
          14,
        )
      : null,
    nameNode(memberData, palette, { x: pad, y: 92, w: W - pad * 2 }, 30),
    ...placeFields(
      detailKeys,
      memberData,
      { x: pad, y: 158, w: W - pad * 2, h: 96 },
      { columns: 2, ...fieldOpts },
    ),
    qr,
    qrCaption,
  ].filter(Boolean) as CardNode[];
}

/** Clamp an edited node so it can never be dragged off the surface. */
function clampNode(node: CardNode, surfaceW: number, surfaceH: number): CardNode {
  const w = Math.min(Math.max(node.w, 16), surfaceW);
  const h = Math.min(Math.max(node.h, 12), surfaceH);
  return {
    ...node,
    w,
    h,
    x: Math.min(Math.max(node.x, 0), surfaceW - w),
    y: Math.min(Math.max(node.y, 0), surfaceH - h),
  };
}

export function buildCardDocument({
  concept,
  brandProfile,
  memberData,
  selectedFields,
  overrides,
}: {
  concept: GeneratedCardDesign;
  brandProfile: BrandProfile;
  memberData: MemberData;
  selectedFields: SelectedFields;
  overrides?: CardNodeOverrides;
}): CardDocument {
  const orientation = resolveOrientation(concept);
  const { width, height } = surfaceSize(orientation);
  const archetype = resolveArchetype(concept);
  const palette = buildPalette(concept, archetype, brandProfile);
  const background =
    overrides?.[CARD_BACKGROUND_OVERRIDE_ID]?.hidden &&
    palette.background.type === "image"
      ? {
          type: "gradient" as const,
          color: palette.background.color,
          color2: mixColors(palette.background.color, "#000000", 0.22),
          angle: 145,
        }
      : palette.background;
  const assetNodes = brandAssetNodes(concept, brandProfile, orientation);
  const layoutNodes =
    orientation === "portrait"
      ? buildPortraitNodes(
          brandProfile,
          memberData,
          selectedFields,
          archetype,
          palette,
        )
      : buildNodes(
          concept,
          brandProfile,
          memberData,
          selectedFields,
          archetype,
          palette,
        );
  const rawNodes = [...assetNodes, ...layoutNodes];
  const nodes = rawNodes
    .map((node, index) => {
      const base = { z: index + 1, ...node };
      const override = overrides?.[node.id];
      return override ? clampNode({ ...base, ...override }, width, height) : base;
    })
    .filter((node) => !node.hidden);

  return {
    conceptId: concept.id,
    width,
    height,
    background,
    nodes,
    primaryColor: normalizeHexColor(
      concept.designTokens.primaryColor,
      brandProfile.primaryColor,
    ),
    textColor: palette.ink,
  };
}
