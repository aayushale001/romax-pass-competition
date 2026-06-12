import { NextResponse } from "next/server";
import { createApplePassInstallUrl } from "@/lib/applePass";
import { appleWalletRequestSchema } from "@/lib/schemas";
import {
  readJsonWithLimit,
  requireWalletIssuanceToken,
} from "@/lib/requestLimits";

export const runtime = "nodejs";
const MAX_WALLET_REQUEST_BYTES = 100_000;

export async function POST(request: Request) {
  try {
    requireWalletIssuanceToken(request);
    const body = appleWalletRequestSchema.parse(
      await readJsonWithLimit(request, MAX_WALLET_REQUEST_BYTES),
    );

    const { installUrl } = await createApplePassInstallUrl({ pass: body.pass });
    return NextResponse.json({ installUrl });
  } catch (error) {
    console.error("Apple Wallet pass creation failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create the Apple Wallet pass.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
