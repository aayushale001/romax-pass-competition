import { NextResponse } from "next/server";
import { scrapeWebsite } from "@/lib/scrapeWebsite";
import { refineBrandProfileWithVision } from "@/lib/visionBrandRefine";
import { scrapeRequestSchema } from "@/lib/schemas";
import { readJsonWithLimit } from "@/lib/requestLimits";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_SCRAPE_REQUEST_BYTES = 10_000;

export async function POST(request: Request) {
  try {
    const body = scrapeRequestSchema.parse(
      await readJsonWithLimit(request, MAX_SCRAPE_REQUEST_BYTES),
    );
    const scraped = await scrapeWebsite(body.url);
    // Pixel-grounded refinement of palette / logo / industry / tone.
    // Falls back to the heuristic profile when OpenAI is unavailable.
    const brandProfile = await refineBrandProfileWithVision(scraped);

    return NextResponse.json({ brandProfile });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to scrape this website.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
