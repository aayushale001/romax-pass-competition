"use client";

import type { Ref } from "react";
import { useMemo } from "react";
import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  SelectedFields,
} from "@/types/card";
import { buildCardDocument } from "@/lib/cardDocument";
import { CardDocumentRenderer } from "@/components/CardDocumentRenderer";
import { createVerificationMessage } from "@/lib/walletExport";
import type { CardNodeOverrides } from "@/types/cardDocument";

type TemplateRendererProps = {
  brandProfile: BrandProfile;
  concept: GeneratedCardDesign;
  memberData: MemberData;
  selectedFields: SelectedFields;
  compact?: boolean;
  previewRef?: Ref<HTMLDivElement>;
  nodeOverrides?: CardNodeOverrides;
};

/**
 * Renders a concept by compiling it into a deterministic CardDocument scene
 * graph and drawing that, rather than injecting the AI's frozen HTML/CSS. The
 * scene graph keeps the QR square, prevents overlap/clipping, and — because the
 * field nodes are derived from `selectedFields` on every render — makes field
 * toggles add/remove elements live.
 */
export function TemplateRenderer({
  brandProfile,
  concept,
  memberData,
  selectedFields,
  compact,
  previewRef,
  nodeOverrides,
}: TemplateRendererProps) {
  const qrValue = useMemo(
    () => createVerificationMessage(brandProfile, memberData),
    [brandProfile, memberData],
  );
  const document = useMemo(
    () =>
      buildCardDocument({
        concept,
        brandProfile,
        memberData,
        selectedFields,
        overrides: nodeOverrides,
      }),
    [concept, brandProfile, memberData, selectedFields, nodeOverrides],
  );

  return (
    <CardDocumentRenderer
      document={document}
      qrValue={qrValue}
      compact={compact}
      previewRef={previewRef}
    />
  );
}
