import type { MemberFieldKey } from "@/types/card";

/**
 * The card scene graph.
 *
 * Instead of the AI hand-writing a frozen HTML string, a card is now a
 * structured document: a fixed-size surface plus a list of typed, positioned,
 * styled nodes. This is what makes the card both *reliable* (a deterministic
 * engine lays the nodes out, so the QR is always square and nothing overlaps)
 * and *editable* (every element is a real object you can select and mutate, and
 * toggling a member field simply adds or removes a node).
 *
 * All node coordinates live in a fixed design space (CARD_W x CARD_H). The
 * renderer converts them to responsive percentages, so one document renders
 * crisply at any size — thumbnail, live preview, or 2x PNG export.
 */

// Landscape (credit-card) surface.
export const CARD_W = 560;
export const CARD_H = 353;

// Portrait surface — the tall Apple Wallet pass shape (~3:4).
export const PORTRAIT_W = 360;
export const PORTRAIT_H = 460;
export const CARD_BACKGROUND_OVERRIDE_ID = "__card-background";

export type CardOrientation = "landscape" | "portrait";

/** Design-space dimensions for a given orientation. */
export function surfaceSize(orientation: CardOrientation) {
  return orientation === "portrait"
    ? { width: PORTRAIT_W, height: PORTRAIT_H }
    : { width: CARD_W, height: CARD_H };
}

export type CardNodeType =
  | "panel" // a solid/rounded background block or accent shape
  | "text" // a free or brand text run (business name, member name, tagline)
  | "field" // a labelled member value (label on top, value below)
  | "logo" // brand logo image or initials block
  | "image" // member photo / decorative art (cover or contain)
  | "qr"; // the verification QR — always rendered as a fixed square

export type CardNode = {
  id: string;
  type: CardNodeType;
  /** Stable semantic role, used for data-role, editing, and field binding. */
  role: string;
  /** Frame in CARD_W x CARD_H design space. */
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  hidden?: boolean;

  // Text / field content
  text?: string;
  label?: string;
  /** Which member field this node displays (lets the editor re-resolve it). */
  binding?: MemberFieldKey | "businessName";

  // Text styling (font sizes are in design px and scale with the surface)
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  letterSpacing?: number;
  lineClamp?: number;

  // Box styling
  fill?: string;
  radius?: number;
  opacity?: number;
  borderColor?: string;

  // Image
  imageUrl?: string;
  imageFit?: "cover" | "contain";
  /** Initials/short text shown when an image is missing. */
  fallbackText?: string;
};

export type CardDocumentBackground = {
  type: "solid" | "gradient" | "image";
  color: string;
  color2?: string;
  angle?: number;
  imageUrl?: string;
  /** rgba/hex overlay drawn above an image background for legibility. */
  overlay?: string;
};

export type CardDocument = {
  conceptId: string;
  width: number;
  height: number;
  background: CardDocumentBackground;
  nodes: CardNode[];
  /** Convenience tokens carried for the editor / downstream consumers. */
  primaryColor: string;
  textColor: string;
};

/** A user edit applied on top of an engine-laid-out node, keyed by node id. */
export type CardNodeOverride = Partial<
  Pick<
    CardNode,
    | "text"
    | "fontSize"
    | "fontWeight"
    | "color"
    | "align"
    | "x"
    | "y"
    | "w"
    | "h"
    | "hidden"
  >
>;

/** node id -> override. Persisted per concept in builder state. */
export type CardNodeOverrides = Record<string, CardNodeOverride>;
