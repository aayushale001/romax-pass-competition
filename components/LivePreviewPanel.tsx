"use client";

import type { RefObject } from "react";
import { TemplateRenderer } from "@/components/TemplateRenderer";
import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  SelectedFields,
} from "@/types/card";
import type { CardNodeOverrides } from "@/types/cardDocument";

type LivePreviewPanelProps = {
  brandProfile: BrandProfile;
  concept: GeneratedCardDesign;
  memberData: MemberData;
  selectedFields: SelectedFields;
  previewRef?: RefObject<HTMLDivElement | null>;
  nodeOverrides?: CardNodeOverrides;
};

export function LivePreviewPanel({
  brandProfile,
  concept,
  memberData,
  selectedFields,
  previewRef,
  nodeOverrides,
}: LivePreviewPanelProps) {
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-lg font-bold text-gray-950">Live preview</h2>
        <p className="text-sm text-gray-600">{concept.name}</p>
        <p className="mt-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs leading-5 text-gray-600">
          {concept.description}
        </p>
      </div>
      <div className="flex justify-center">
        <TemplateRenderer
          brandProfile={brandProfile}
          concept={concept}
          memberData={memberData}
          selectedFields={selectedFields}
          previewRef={previewRef}
          nodeOverrides={nodeOverrides}
        />
      </div>
    </div>
  );
}
