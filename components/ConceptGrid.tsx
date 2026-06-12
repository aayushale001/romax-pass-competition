"use client";

import { Check, Wand2 } from "lucide-react";
import { TemplateRenderer } from "@/components/TemplateRenderer";
import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  SelectedFields,
} from "@/types/card";

type ConceptGridProps = {
  brandProfile: BrandProfile;
  concepts: GeneratedCardDesign[];
  selectedConceptId?: string;
  previewMemberData: MemberData;
  previewFields: SelectedFields;
  onSelect: (concept: GeneratedCardDesign) => void;
};

export function ConceptGrid({
  brandProfile,
  concepts,
  selectedConceptId,
  previewMemberData,
  previewFields,
  onSelect,
}: ConceptGridProps) {
  if (!concepts.length) {
    return null;
  }

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {concepts.map((concept) => {
        const selected = concept.id === selectedConceptId;

        return (
          <button
            key={concept.id}
            type="button"
            onClick={() => onSelect(concept)}
            className={`group grid gap-3 rounded-lg border bg-white p-3 text-left transition hover:border-gray-950 ${
              selected
                ? "border-gray-950 ring-2 ring-gray-950/10"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Wand2 size={15} className="text-gray-500" />
                  <h3 className="truncate text-sm font-bold text-gray-950">
                    {concept.name}
                  </h3>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                  {concept.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase text-gray-600">
                    {concept.mood}
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase text-gray-600">
                    {concept.designTokens.backgroundMode.replace("-", " ")}
                  </span>
                  {concept.designTokens.colorUsage ? (
                    <span className="rounded-md bg-gray-950 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                      {concept.designTokens.colorUsage}
                    </span>
                  ) : null}
                  {concept.designTokens.brandAssetTreatment &&
                  concept.designTokens.brandAssetTreatment !== "standard" ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                      {concept.designTokens.brandAssetTreatment.replace("-", " ")}
                    </span>
                  ) : null}
                </div>
              </div>
              {selected ? (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-500 text-white">
                  <Check size={14} />
                </span>
              ) : null}
            </div>
            <div className="flex h-[312px] items-center justify-center overflow-hidden rounded-md bg-gray-50 p-3">
              <TemplateRenderer
                brandProfile={brandProfile}
                concept={concept}
                memberData={previewMemberData}
                selectedFields={previewFields}
                compact
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
