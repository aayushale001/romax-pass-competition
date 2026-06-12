"use client";

import Link from "next/link";
import { FlowShell } from "@/components/FlowShell";
import { CardEditor } from "@/components/CardEditor";
import { MemberDetailsForm } from "@/components/MemberDetailsForm";
import { useBuilderState } from "@/lib/useBuilderState";

export default function MemberPage() {
  const { ready, state, selectedConcept, setState } =
    useBuilderState("concept");

  if (!ready || !state || !selectedConcept) {
    return (
      <FlowShell currentStep={4}>
        <div className="border-t border-gray-200 pt-8 text-sm text-gray-600">
          Loading member details...
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell currentStep={4}>
      <div className="grid gap-8 border-t border-gray-200 pt-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid content-start gap-5">
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold text-gray-950">
              Add member details
            </h2>
            <p className="text-sm leading-6 text-gray-600">
              Fill the selected fields and watch the official card update
              without changing the locked brand identity.
            </p>
          </div>
          <MemberDetailsForm
            memberData={state.memberData}
            selectedFields={state.selectedFields}
            businessName={state.brandProfile.businessName}
            onChange={(memberData) =>
              setState((current) => ({ ...current, memberData }))
            }
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/fields"
              className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-gray-950"
            >
              Back to fields
            </Link>
            <Link
              href="/export"
              className="inline-flex h-11 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Continue to export
            </Link>
          </div>
        </section>

        <aside className="h-fit xl:sticky xl:top-6">
          <CardEditor
            brandProfile={state.brandProfile}
            concept={selectedConcept}
            memberData={state.memberData}
            selectedFields={state.selectedFields}
            overrides={state.nodeOverrides?.[selectedConcept.id] ?? {}}
            onChange={(overrides) =>
              setState((current) => ({
                ...current,
                nodeOverrides: {
                  ...current.nodeOverrides,
                  [selectedConcept.id]: overrides,
                },
              }))
            }
          />
        </aside>
      </div>
    </FlowShell>
  );
}
