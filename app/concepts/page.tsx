"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { BrandSummary } from "@/components/BrandSummary";
import { ConceptGrid } from "@/components/ConceptGrid";
import { FlowShell } from "@/components/FlowShell";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import {
  createSelectedFields,
  readJson,
  type PassBuilderState,
} from "@/lib/flowState";
import { limitSelectedFieldsForConcept } from "@/lib/cardFieldPolicy";
import { useBuilderState } from "@/lib/useBuilderState";
import type { GeneratedCardDesign } from "@/types/card";

export default function ConceptsPage() {
  const { ready, state, selectedConcept, setState } =
    useBuilderState("concepts");
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState("");
  const sourceLabel =
    state?.conceptSource === "local"
      ? "Local edge model + fallback"
      : state?.conceptSource === "ai"
        ? "OpenAI"
        : "Built-in fallback";

  async function refineSelectedConcept() {
    if (!state || !selectedConcept || !refineInstruction.trim()) {
      return;
    }

    const instruction = refineInstruction.trim();
    setRefining(true);
    setError("");
    try {
      const response = await fetch("/api/refine-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandProfile: state.brandProfile,
          concept: selectedConcept,
          instruction,
        }),
      });
      const payload = await readJson<{ concept: GeneratedCardDesign }>(response);
      const refinedConcept = { ...payload.concept, id: selectedConcept.id };

      setState((current) => ({
        ...current,
        concepts: current.concepts.map((concept) =>
          concept.id === selectedConcept.id ? refinedConcept : concept,
        ),
        selectedFields: limitSelectedFieldsForConcept(
          refinedConcept,
          createSelectedFields(refinedConcept.requiredFields),
        ),
      }));
      setRefineInstruction("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to refine this concept.",
      );
    } finally {
      setRefining(false);
    }
  }

  function selectConcept(concept: GeneratedCardDesign) {
    setState((current: PassBuilderState) => ({
      ...current,
      selectedConceptId: concept.id,
      selectedFields: limitSelectedFieldsForConcept(
        concept,
        createSelectedFields(concept.requiredFields),
      ),
    }));
  }

  if (!ready || !state || !selectedConcept) {
    return (
      <FlowShell currentStep={2}>
        <div className="border-t border-gray-200 pt-8 text-sm text-gray-600">
          Loading concepts...
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell currentStep={2}>
      <div className="grid gap-8 border-t border-gray-200 pt-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-6">
          <section className="grid gap-5">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-950">
                  Choose a card concept
                </h2>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-600">
                  {sourceLabel}
                </span>
              </div>
              <p className="text-sm leading-6 text-gray-600">
                The brand stays locked. Pick a design direction, or refine the
                selected concept — the card is laid out by a deterministic engine,
                so every result is render-safe.
              </p>
            </div>
            <BrandSummary brandProfile={state.brandProfile} />
          </section>

          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={refineInstruction}
                onChange={(event) => setRefineInstruction(event.target.value)}
                placeholder="Refine selected concept (e.g. 'stronger brand color', 'add a photo')"
                className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
              />
              <button
                type="button"
                onClick={refineSelectedConcept}
                disabled={refining || !refineInstruction.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refining ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                Refine
              </button>
            </div>
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}
            <ConceptGrid
              brandProfile={state.brandProfile}
              concepts={state.concepts}
              selectedConceptId={state.selectedConceptId}
              previewMemberData={state.memberData}
              previewFields={state.selectedFields}
              onSelect={selectConcept}
            />
          </section>
        </div>

        <aside className="grid h-fit gap-5 xl:sticky xl:top-6">
          <LivePreviewPanel
            brandProfile={state.brandProfile}
            concept={selectedConcept}
            memberData={state.memberData}
            selectedFields={state.selectedFields}
          />
          <Link
            href="/fields"
            className="inline-flex h-11 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Continue to fields
          </Link>
        </aside>
      </div>
    </FlowShell>
  );
}
