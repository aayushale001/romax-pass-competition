"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { BrandReviewForm } from "@/components/BrandReviewForm";
import { FlowShell } from "@/components/FlowShell";
import {
  createInitialState,
  readJson,
  saveBuilderState,
  type ConceptSource,
} from "@/lib/flowState";
import { useBuilderState } from "@/lib/useBuilderState";
import type { BrandProfile, GeneratedCardDesign } from "@/types/card";

export default function BrandReviewPage() {
  const router = useRouter();
  const { ready, state, setState } = useBuilderState("brand");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const draft = state?.brandProfile ?? null;

  function updateDraft(nextBrandProfile: BrandProfile) {
    setState((current) => ({
      ...current,
      brandProfile: nextBrandProfile,
    }));
  }

  async function confirmAndGenerate() {
    if (!draft) {
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const confirmedBrandProfile = { ...draft, confirmed: true };
      const conceptsResponse = await fetch("/api/generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandProfile: confirmedBrandProfile }),
      });
      const conceptsPayload = await readJson<{
        concepts: GeneratedCardDesign[];
        source: ConceptSource;
      }>(conceptsResponse);

      saveBuilderState(
        createInitialState(
          confirmedBrandProfile,
          conceptsPayload.concepts,
          conceptsPayload.source,
        ),
      );
      router.push("/concepts");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate card designs.",
      );
    } finally {
      setGenerating(false);
    }
  }

  if (!ready || !state || !draft) {
    return (
      <FlowShell currentStep={1}>
        <div className="border-t border-gray-200 pt-8 text-sm text-gray-600">
          Loading brand review...
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell currentStep={1}>
      <section className="grid gap-6 border-t border-gray-200 pt-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold text-gray-950">
              Review the scraped brand
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-gray-600">
              Confirm the locked identity and pick the images AI can use before
              it creates controlled card design directions.
            </p>
          </div>
          <button
            type="button"
            onClick={confirmAndGenerate}
            disabled={generating || !draft.businessName.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            Generate designs
          </button>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <BrandReviewForm brandProfile={draft} onChange={updateDraft} />
      </section>
    </FlowShell>
  );
}
