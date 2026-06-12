import { NextResponse } from "next/server";
import { refineConceptRequestSchema } from "@/lib/schemas";
import { readJsonWithLimit } from "@/lib/requestLimits";
import { refineConfiguredConcept } from "@/lib/aiProvider";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_REFINE_REQUEST_BYTES = 2_500_000;

export async function POST(request: Request) {
  try {
    const { brandProfile, concept, instruction } =
      refineConceptRequestSchema.parse(
        await readJsonWithLimit(request, MAX_REFINE_REQUEST_BYTES),
      );

    return NextResponse.json(
      await refineConfiguredConcept(brandProfile, concept, instruction),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to refine this concept.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
