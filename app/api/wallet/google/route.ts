import { NextResponse } from "next/server";
import { buildGoogleWalletSaveUrl } from "@/lib/googleWallet";
import { googleWalletRequestSchema } from "@/lib/schemas";
import {
  readJsonWithLimit,
  requireWalletIssuanceToken,
} from "@/lib/requestLimits";

export const runtime = "nodejs";
const MAX_WALLET_REQUEST_BYTES = 100_000;

export async function POST(request: Request) {
  try {
    requireWalletIssuanceToken(request);
    const body = googleWalletRequestSchema.parse(
      await readJsonWithLimit(request, MAX_WALLET_REQUEST_BYTES),
    );

    const saveUrl = buildGoogleWalletSaveUrl({
      pass: body.pass,
      objectSuffix: body.objectSuffix,
      logoUrl: body.logoUrl,
      heroUrl: body.heroUrl,
    });

    return NextResponse.json({ saveUrl });
  } catch (error) {
    console.error("Google Wallet save link failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to build the Google Wallet link.";
    // Configuration problems are the common case here; surface them clearly.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
