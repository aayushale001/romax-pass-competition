"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FlowShell } from "@/components/FlowShell";
import { FieldSelector } from "@/components/FieldSelector";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import {
  getCardDetailFieldLimit,
  limitSelectedFieldsForConcept,
} from "@/lib/cardFieldPolicy";
import { useBuilderState } from "@/lib/useBuilderState";
import type { SelectedFields } from "@/types/card";

function sameFields(a: SelectedFields, b: SelectedFields) {
  return Object.keys(a).every(
    (key) => a[key as keyof SelectedFields] === b[key as keyof SelectedFields],
  );
}

export default function FieldsPage() {
  const { ready, state, selectedConcept, setState } =
    useBuilderState("concept");

  useEffect(() => {
    if (!ready || !state || !selectedConcept) return;

    const limitedFields = limitSelectedFieldsForConcept(
      selectedConcept,
      state.selectedFields,
    );

    if (!sameFields(limitedFields, state.selectedFields)) {
      setState((current) => ({
        ...current,
        selectedFields: limitedFields,
      }));
    }
  }, [ready, selectedConcept, setState, state]);

  if (!ready || !state || !selectedConcept) {
    return (
      <FlowShell currentStep={3}>
        <div className="border-t border-gray-200 pt-8 text-sm text-gray-600">
          Loading fields...
        </div>
      </FlowShell>
    );
  }

  const maxTextFields = getCardDetailFieldLimit(
    selectedConcept,
    state.selectedFields,
  );

  return (
    <FlowShell currentStep={3}>
      <div className="grid gap-8 border-t border-gray-200 pt-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid content-start gap-5">
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold text-gray-950">
              Select member fields
            </h2>
            <p className="text-sm leading-6 text-gray-600">
              Choose the information members must provide. Member ID and QR code
              stay locked for verification.
            </p>
          </div>
          <FieldSelector
            selectedFields={state.selectedFields}
            recommendedFields={selectedConcept.requiredFields}
            maxTextFields={maxTextFields}
            onChange={(selectedFields) =>
              setState((current) => ({
                ...current,
                selectedFields: limitSelectedFieldsForConcept(
                  selectedConcept,
                  selectedFields,
                ),
              }))
            }
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/concepts"
              className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-gray-950"
            >
              Back to concepts
            </Link>
            <Link
              href="/member"
              className="inline-flex h-11 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Continue to member details
            </Link>
          </div>
        </section>

        <aside className="h-fit xl:sticky xl:top-6">
          <LivePreviewPanel
            brandProfile={state.brandProfile}
            concept={selectedConcept}
            memberData={state.memberData}
            selectedFields={state.selectedFields}
          />
        </aside>
      </div>
    </FlowShell>
  );
}
