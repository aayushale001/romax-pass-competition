import { NextResponse } from "next/server";
import { generateConceptsRequestSchema } from "@/lib/schemas";
import { readJsonWithLimit } from "@/lib/requestLimits";
import { generateConfiguredConcepts } from "@/lib/aiProvider";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_GENERATE_REQUEST_BYTES = 2_500_000;

export async function POST(request: Request) {
  try {
    const { brandProfile } = generateConceptsRequestSchema.parse(
      await readJsonWithLimit(request, MAX_GENERATE_REQUEST_BYTES),
    );

    return NextResponse.json(await generateConfiguredConcepts(brandProfile));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate card concepts.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
