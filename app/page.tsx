"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusinessUrlStep } from "@/components/BusinessUrlStep";
import { FlowShell } from "@/components/FlowShell";
import {
  clearBuilderState,
  createBrandReviewState,
  readJson,
  saveBuilderState,
} from "@/lib/flowState";
import type { BrandProfile } from "@/types/card";

type CustomBrandPayload = {
  prompt: string;
  imageDataUrl?: string | null;
  sourceMode?: "prompt" | "physical-card" | "visiting-card";
  referenceImageMode?: "match-original" | "design-inspiration";
};

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function processBrand(url: string) {
    setLoading(true);
    setError("");
    setStatus("Scraping brand profile");
    clearBuilderState();

    try {
      const scrapeResponse = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const { brandProfile } = await readJson<{ brandProfile: BrandProfile }>(
        scrapeResponse,
      );

      saveBuilderState(createBrandReviewState(brandProfile));
      router.push("/brand");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong.",
      );
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function processCustomBrand(payload: CustomBrandPayload) {
    setLoading(true);
    setError("");
    setStatus("Creating custom brand profile");
    clearBuilderState();

    try {
      const customResponse = await fetch("/api/custom-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { brandProfile } = await readJson<{ brandProfile: BrandProfile }>(
        customResponse,
      );

      saveBuilderState(createBrandReviewState(brandProfile));
      router.push("/brand");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong.",
      );
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowShell currentStep={0} narrow>
      <section className="grid gap-6 border-t border-gray-200 pt-8">
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            AI-powered wallet card generator
          </p>
          <h2 className="text-2xl font-bold text-gray-950">
            Start with a website, idea, or card photo
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600">
            Use a business website, describe the card, or upload a physical
            membership/visiting card. The app creates a brand profile for review
            before generating controlled AI card concepts.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <BusinessUrlStep
            onSubmit={processBrand}
            onCustomSubmit={processCustomBrand}
            loading={loading}
            status={status}
          />
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
      </section>
    </FlowShell>
  );
}
