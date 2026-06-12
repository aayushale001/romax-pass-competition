import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { buildDesignReviewPrompt, conceptSystemPrompt } from "@/lib/aiPrompts";
import { normalizeGeneratedDesign } from "@/lib/generatedCardSafety";
import {
  reviewDesignRequestSchema,
  reviewDesignResponseSchema,
} from "@/lib/schemas";
import { readJsonWithLimit } from "@/lib/requestLimits";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_REVIEW_REQUEST_BYTES = 4_500_000;

function ensureCardRootRole(html: string) {
  if (/data-role\s*=\s*["']card-root["']/i.test(html)) {
    return html;
  }

  return html.replace(/<([a-z][a-z0-9-]*)(\s|>)/i, '<$1 data-role="card-root"$2');
}

function locallyRepairDesign(
  concept: ReturnType<typeof reviewDesignRequestSchema.parse>["concept"],
  brandProfile: ReturnType<typeof reviewDesignRequestSchema.parse>["brandProfile"],
) {
  return normalizeGeneratedDesign(
    {
      ...concept,
      html: ensureCardRootRole(concept.html),
      css: `${concept.css}

.card, [data-role="card-root"] {
  overflow: hidden;
}
[data-role="business-name"],
[data-role="member-name"],
[data-role="member-id"],
[data-role="tier"],
[data-role="field-grid"],
[data-role="field-grid"] * {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-role="business-name"] {
  white-space: nowrap;
}
[data-role="member-name"] {
  overflow-wrap: anywhere;
  line-height: .94;
  font-size: clamp(20px, 7vw, 42px);
}
[data-role="field-grid"] {
  gap: clamp(6px, 1.5vw, 12px);
}
[data-role="qr-code"] {
  min-width: 64px;
  min-height: 64px;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  overflow: hidden;
}
`,
    },
    brandProfile,
    concept,
  );
}

export async function POST(request: Request) {
  try {
    const payload = reviewDesignRequestSchema.parse(
      await readJsonWithLimit(request, MAX_REVIEW_REQUEST_BYTES),
    );
    const {
      brandProfile,
      concept,
      memberData,
      selectedFields,
      screenshotDataUrl,
      domIssues,
      attempt,
      reviewInstruction,
    } = payload;
    const hasBlockingIssues = domIssues.some(
      (issue) => issue.severity === "error",
    );

    if (!process.env.OPENAI_API_KEY) {
      if (!hasBlockingIssues) {
        return NextResponse.json({
          status: "pass",
          summary: "No blocking DOM layout issues were detected.",
          issues: domIssues.map((issue) => issue.message),
          concept: null,
          source: "fallback",
        });
      }

      return NextResponse.json({
        status: "fixed",
        summary:
          "OpenAI is not configured on the server, so only a local overflow repair was applied. Add OPENAI_API_KEY to .env.local and restart the dev server to enable AI visual review.",
        issues: domIssues.map((issue) => issue.message),
        concept: locallyRepairDesign(concept, brandProfile),
        source: "fallback",
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model:
        process.env.OPENAI_VISION_MODEL ??
        process.env.OPENAI_MODEL ??
        "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: conceptSystemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildDesignReviewPrompt({
                brandProfile,
                concept,
                memberData,
                selectedFields,
                domIssues,
                attempt,
                reviewInstruction,
              }),
            },
            {
              type: "input_image",
              image_url: screenshotDataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(reviewDesignResponseSchema, "design_review"),
      },
      temperature: 0.25,
      max_output_tokens: 5200,
    });

    if (!response.output_parsed) {
      throw new Error("AI did not return a valid design review.");
    }

    if (response.output_parsed.status === "pass") {
      return NextResponse.json({
        ...response.output_parsed,
        concept: null,
        source: "ai",
      });
    }

    if (!response.output_parsed.concept) {
      throw new Error("AI marked the design fixed but did not return a concept.");
    }

    return NextResponse.json({
      ...response.output_parsed,
      concept: normalizeGeneratedDesign(
        response.output_parsed.concept,
        brandProfile,
        concept,
      ),
      source: "ai",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to review this design.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
