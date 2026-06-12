"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { ExportPanel } from "@/components/ExportPanel";
import { FlowShell } from "@/components/FlowShell";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import { createWalletReadyPass } from "@/lib/walletExport";
import { useBuilderState } from "@/lib/useBuilderState";

export default function ExportPage() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { ready, state, selectedConcept } = useBuilderState("concept");
  const walletReadyPass = useMemo(() => {
    if (!state || !selectedConcept) {
      return null;
    }

    return createWalletReadyPass(
      state.brandProfile,
      selectedConcept,
      state.selectedFields,
      state.memberData,
    );
  }, [state, selectedConcept]);

  if (!ready || !state || !selectedConcept || !walletReadyPass) {
    return (
      <FlowShell currentStep={5}>
        <div className="border-t border-gray-200 pt-8 text-sm text-gray-600">
          Loading export...
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell currentStep={5}>
      <div className="grid gap-8 border-t border-gray-200 pt-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="grid h-fit gap-5 xl:sticky xl:top-6">
          <LivePreviewPanel
            brandProfile={state.brandProfile}
            concept={selectedConcept}
            memberData={state.memberData}
            selectedFields={state.selectedFields}
            previewRef={previewRef}
            nodeOverrides={state.nodeOverrides?.[selectedConcept.id] ?? {}}
          />
          <Link
            href="/member"
            className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-gray-950"
          >
            Back to member details
          </Link>
        </section>

        <section className="grid content-start gap-5">
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold text-gray-950">
              Add your pass to a wallet
            </h2>
            <p className="text-sm leading-6 text-gray-600">
              Add the membership pass straight to Google Wallet, or download a
              high-resolution PNG of the card design.
            </p>
          </div>
          <ExportPanel
            walletReadyPass={walletReadyPass}
            brandProfile={state.brandProfile}
            memberData={state.memberData}
            previewRef={previewRef}
          />
        </section>
      </div>
    </FlowShell>
  );
}
