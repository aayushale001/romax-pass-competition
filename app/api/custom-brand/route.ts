import { NextResponse } from "next/server";
import { createCustomBrandProfile } from "@/lib/customBrandProfile";
import { customBrandProfileRequestSchema } from "@/lib/schemas";
import { readJsonWithLimit } from "@/lib/requestLimits";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_CUSTOM_BRAND_REQUEST_BYTES = 1_400_000;

export async function POST(request: Request) {
  try {
    const body = customBrandProfileRequestSchema.parse(
      await readJsonWithLimit(request, MAX_CUSTOM_BRAND_REQUEST_BYTES),
    );
    const brandProfile = await createCustomBrandProfile({
      prompt: body.prompt,
      imageDataUrl: body.imageDataUrl,
      sourceMode: body.sourceMode,
      referenceImageMode: body.referenceImageMode,
    });

    return NextResponse.json({ brandProfile });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create a custom brand profile.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
