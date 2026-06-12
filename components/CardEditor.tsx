"use client";

import type { RefObject } from "react";
import { useMemo, useState } from "react";
import { RotateCcw, MousePointerClick, Trash2 } from "lucide-react";
import type {
  BrandProfile,
  GeneratedCardDesign,
  MemberData,
  SelectedFields,
} from "@/types/card";
import type {
  CardNode,
  CardNodeOverride,
  CardNodeOverrides,
} from "@/types/cardDocument";
import { CARD_BACKGROUND_OVERRIDE_ID } from "@/types/cardDocument";
import { buildCardDocument } from "@/lib/cardDocument";
import { CardDocumentRenderer } from "@/components/CardDocumentRenderer";
import { createVerificationMessage } from "@/lib/walletExport";

type CardEditorProps = {
  brandProfile: BrandProfile;
  concept: GeneratedCardDesign;
  memberData: MemberData;
  selectedFields: SelectedFields;
  overrides: CardNodeOverrides;
  onChange: (overrides: CardNodeOverrides) => void;
  previewRef?: RefObject<HTMLDivElement | null>;
};

const WEIGHTS = [400, 600, 700, 800, 900];
const ALIGNMENTS: Array<CardNode["align"]> = ["left", "center", "right"];

function roleLabel(role: string) {
  return role
    .replace(/^field-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function idLabel(id: string) {
  if (id === CARD_BACKGROUND_OVERRIDE_ID) {
    return "Background image";
  }

  return roleLabel(id);
}

function isDeletableNode(node: CardNode) {
  return (
    node.role === "brand-asset" ||
    node.role === "decorative-art" ||
    node.role === "decoration" ||
    node.id.startsWith("brand-")
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 2,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {label}
      <input
        type="number"
        value={Math.round(value)}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-950"
      />
    </label>
  );
}

export function CardEditor({
  brandProfile,
  concept,
  memberData,
  selectedFields,
  overrides,
  onChange,
  previewRef,
}: CardEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
        overrides,
      }),
    [concept, brandProfile, memberData, selectedFields, overrides],
  );

  const selectedNode = document.nodes.find((node) => node.id === selectedNodeId);

  function patchNode(patch: CardNodeOverride) {
    if (!selectedNode) return;
    onChange({
      ...overrides,
      [selectedNode.id]: { ...overrides[selectedNode.id], ...patch },
    });
  }

  function resetNode() {
    if (!selectedNode) return;
    const next = { ...overrides };
    delete next[selectedNode.id];
    onChange(next);
  }

  function deleteSelectedNode() {
    if (!selectedNode || !isDeletableNode(selectedNode)) return;
    onChange({
      ...overrides,
      [selectedNode.id]: {
        ...overrides[selectedNode.id],
        hidden: true,
      },
    });
    setSelectedNodeId(null);
  }

  function removeBackgroundImage() {
    onChange({
      ...overrides,
      [CARD_BACKGROUND_OVERRIDE_ID]: {
        ...overrides[CARD_BACKGROUND_OVERRIDE_ID],
        hidden: true,
      },
    });
  }

  function restoreOverride(id: string) {
    const next = { ...overrides };
    delete next[id];
    onChange(next);
  }

  const isText = selectedNode?.type === "text";
  const hasType = selectedNode?.type;
  const supportsTypography = hasType === "text" || hasType === "field";
  const hiddenOverrides = Object.entries(overrides).filter(
    ([id, override]) => id !== CARD_BACKGROUND_OVERRIDE_ID && override.hidden,
  );
  const canRemoveBackgroundImage = document.background.type === "image";
  const backgroundImageRemoved =
    Boolean(overrides[CARD_BACKGROUND_OVERRIDE_ID]?.hidden) &&
    !canRemoveBackgroundImage;
  const canDeleteSelectedNode = selectedNode
    ? isDeletableNode(selectedNode)
    : false;

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-lg font-bold text-gray-950">Edit card</h2>
        <p className="text-xs leading-5 text-gray-600">
          Click any element on the card to select it, then adjust its text,
          type, color, or position.
        </p>
      </div>

      <div className="flex justify-center rounded-md bg-gray-50 p-3">
        <CardDocumentRenderer
          document={document}
          qrValue={qrValue}
          previewRef={previewRef}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      </div>

      {canRemoveBackgroundImage || backgroundImageRemoved ? (
        <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-950">
                Background image
              </p>
              <p className="text-xs leading-5 text-gray-500">
                Remove only the decorative image layer. The official brand name,
                logo, and QR stay locked.
              </p>
            </div>
            {canRemoveBackgroundImage ? (
              <button
                type="button"
                onClick={removeBackgroundImage}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 transition hover:border-red-300"
              >
                <Trash2 size={12} />
                Delete
              </button>
            ) : (
              <button
                type="button"
                onClick={() => restoreOverride(CARD_BACKGROUND_OVERRIDE_ID)}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
              >
                <RotateCcw size={12} />
                Restore
              </button>
            )}
          </div>
        </div>
      ) : null}

      {hiddenOverrides.length ? (
        <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm font-bold text-gray-950">Deleted elements</p>
          {hiddenOverrides.map(([id]) => (
            <div key={id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-xs font-medium text-gray-600">
                {idLabel(id)}
              </span>
              <button
                type="button"
                onClick={() => restoreOverride(id)}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
              >
                <RotateCcw size={12} />
                Restore
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {selectedNode ? (
        <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-gray-950">
              {roleLabel(selectedNode.role)}
            </span>
            <button
              type="button"
              onClick={resetNode}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>

          {canDeleteSelectedNode ? (
            <button
              type="button"
              onClick={deleteSelectedNode}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:border-red-300"
            >
              <Trash2 size={13} />
              Delete this decorative element
            </button>
          ) : null}

          {isText ? (
            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Text
              <input
                type="text"
                value={selectedNode.text ?? ""}
                onChange={(event) => patchNode({ text: event.target.value })}
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-950"
              />
            </label>
          ) : null}

          {supportsTypography ? (
            <>
              <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Font size · {Math.round(selectedNode.fontSize ?? 14)}px
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={Math.round(selectedNode.fontSize ?? 14)}
                  onChange={(event) =>
                    patchNode({ fontSize: Number(event.target.value) })
                  }
                  className="accent-gray-950"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Weight
                  <select
                    value={selectedNode.fontWeight ?? 600}
                    onChange={(event) =>
                      patchNode({ fontWeight: Number(event.target.value) })
                    }
                    className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-950"
                  >
                    {WEIGHTS.map((weight) => (
                      <option key={weight} value={weight}>
                        {weight}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Color
                  <input
                    type="color"
                    value={selectedNode.color ?? "#111827"}
                    onChange={(event) => patchNode({ color: event.target.value })}
                    className="h-8 w-full rounded-md border border-gray-300 bg-white p-1"
                  />
                </label>
              </div>
              {isText ? (
                <div className="grid gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Align
                  </span>
                  <div className="flex gap-1">
                    {ALIGNMENTS.map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => patchNode({ align })}
                        className={`h-8 flex-1 rounded-md border px-2 text-xs font-semibold capitalize transition ${
                          (selectedNode.align ?? "left") === align
                            ? "border-gray-950 bg-gray-950 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-950"
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="X"
              value={selectedNode.x}
              onChange={(value) => patchNode({ x: value })}
            />
            <NumberField
              label="Y"
              value={selectedNode.y}
              onChange={(value) => patchNode({ y: value })}
            />
            <NumberField
              label="Width"
              value={selectedNode.w}
              onChange={(value) => patchNode({ w: value })}
            />
            <NumberField
              label="Height"
              value={selectedNode.h}
              onChange={(value) => patchNode({ h: value })}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-xs text-gray-500">
          <MousePointerClick size={15} />
          Select an element on the card to edit it.
        </div>
      )}
    </div>
  );
}
