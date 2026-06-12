import crypto from "node:crypto";
import type { WalletReadyPass } from "@/types/card";
import { normalizeHexColor } from "@/lib/colors";

/**
 * Builds a real "Add to Google Wallet" save link from a WalletReadyPass.
 *
 * No paid account required: a free Google Wallet API *issuer* (demo mode) plus a
 * service-account key is enough. We sign a "save to wallet" JWT that carries the
 * Generic class + object inline, so Google creates them when the user saves.
 *
 * Required env (.env.local):
 *   GOOGLE_WALLET_ISSUER_ID          e.g. 3388000000022123456
 *   GOOGLE_WALLET_SA_EMAIL           the service account email
 *   GOOGLE_WALLET_SA_PRIVATE_KEY     the service account private key (PEM)
 */

export type GoogleWalletInput = {
  pass: WalletReadyPass;
  /** Stable unique suffix per member so re-saving updates the same object. */
  objectSuffix: string;
  logoUrl?: string | null;
  heroUrl?: string | null;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signJwtRs256(claims: Record<string, unknown>, privateKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    privateKey,
  );
  return `${signingInput}.${base64url(signature)}`;
}

/** Google object/class ids allow only alphanumerics, ".", "_" and "-". */
function sanitizeSuffix(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return cleaned || "member";
}

export function buildGoogleWalletSaveUrl(input: GoogleWalletInput): string {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const serviceAccountEmail = process.env.GOOGLE_WALLET_SA_EMAIL;
  const rawKey = process.env.GOOGLE_WALLET_SA_PRIVATE_KEY;

  if (!issuerId || !serviceAccountEmail || !rawKey) {
    throw new Error(
      "Google Wallet is not configured. Set GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, and GOOGLE_WALLET_SA_PRIVATE_KEY in .env.local.",
    );
  }

  // Private keys are usually stored with literal "\n" in env files.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const { pass } = input;

  const classId = `${issuerId}.romax_pass_generic`;
  const objectId = `${issuerId}.${sanitizeSuffix(input.objectSuffix)}`;
  const nameValue =
    pass.primaryFields.find((field) => field.key === "name")?.value ??
    pass.organizationName;
  const idValue = pass.primaryFields.find(
    (field) => field.key === "memberId",
  )?.value;

  const textModulesData = [...pass.secondaryFields, ...pass.auxiliaryFields].map(
    (field) => ({
      id: field.key,
      header: field.label,
      body: field.value,
    }),
  );

  // Hero banner: prefer our server-rendered brand banner (needs a public base
  // URL — a tunnel locally, or the Vercel domain in production), then any
  // scraped brand image, else none.
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "";
  const baseUrl = (process.env.PUBLIC_BASE_URL || vercelUrl).replace(/\/$/, "");
  const heroImageUri = baseUrl
    ? `${baseUrl}/api/banner?title=${encodeURIComponent(
        pass.organizationName,
      )}&subtitle=${encodeURIComponent("Membership")}&color=${encodeURIComponent(
        pass.backgroundColor,
      )}`
    : input.heroUrl ?? null;

  const genericClass = { id: classId };
  const genericObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    hexBackgroundColor: normalizeHexColor(pass.backgroundColor),
    ...(input.logoUrl
      ? {
          logo: {
            sourceUri: { uri: input.logoUrl },
            contentDescription: {
              defaultValue: { language: "en", value: `${pass.logoText} logo` },
            },
          },
        }
      : {}),
    cardTitle: {
      defaultValue: { language: "en", value: pass.organizationName },
    },
    header: { defaultValue: { language: "en", value: nameValue } },
    ...(idValue
      ? {
          subheader: {
            defaultValue: { language: "en", value: idValue },
          },
        }
      : {}),
    textModulesData,
    barcode: {
      type: "QR_CODE",
      value: pass.barcode.message,
      ...(idValue ? { alternateText: idValue } : {}),
    },
    ...(heroImageUri
      ? { heroImage: { sourceUri: { uri: heroImageUri } } }
      : {}),
  };

  const claims = {
    iss: serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: {
      genericClasses: [genericClass],
      genericObjects: [genericObject],
    },
  };

  const token = signJwtRs256(claims, privateKey);
  return `https://pay.google.com/gp/v/save/${token}`;
}
