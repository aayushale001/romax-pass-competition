"use client";

import type { MemberFieldKey, SelectedFields } from "@/types/card";
import { memberFieldKeys, memberFieldLabels } from "@/types/card";
import {
  detailFieldOrder,
  isDetailField,
  lockedMemberFields,
  selectedDetailFieldCount,
} from "@/lib/cardFieldPolicy";

type FieldSelectorProps = {
  selectedFields: SelectedFields;
  recommendedFields: MemberFieldKey[];
  maxTextFields: number;
  onChange: (fields: SelectedFields) => void;
};

export function FieldSelector({
  selectedFields,
  recommendedFields,
  maxTextFields,
  onChange,
}: FieldSelectorProps) {
  const lockedFields = new Set<MemberFieldKey>(lockedMemberFields);
  const recommended = new Set(recommendedFields);
  const selectedTextFields = selectedDetailFieldCount(selectedFields);

  function setField(key: MemberFieldKey, value: boolean) {
    if (
      value &&
      isDetailField(key) &&
      !selectedFields[key] &&
      selectedTextFields >= maxTextFields
    ) {
      return;
    }

    onChange({
      ...selectedFields,
      [key]: lockedFields.has(key) ? true : value,
    });
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600">
        This card can visibly fit{" "}
        <strong className="font-semibold text-gray-950">
          {maxTextFields} text fields
        </strong>{" "}
        on the card. Photo and art slots are separate image areas.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {memberFieldKeys.map((key) => {
          const detailField = isDetailField(key);
          const atLimit =
            detailField &&
            !selectedFields[key] &&
            selectedTextFields >= maxTextFields;
          const disabled = lockedFields.has(key) || atLimit;

          return (
            <label
              key={key}
              className={`flex min-h-12 items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm ${
                disabled && !lockedFields.has(key)
                  ? "border-gray-100 text-gray-400"
                  : "border-gray-200 text-gray-800"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedFields[key]}
                disabled={disabled}
                onChange={(event) => setField(key, event.target.checked)}
                className="h-4 w-4 accent-gray-950 disabled:cursor-not-allowed"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {memberFieldLabels[key]}
              </span>
              {lockedFields.has(key) ? (
                <span className="rounded-md bg-gray-950 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                  Locked
                </span>
              ) : recommended.has(key) ? (
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase text-gray-600">
                  AI
                </span>
              ) : atLimit ? (
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase text-gray-500">
                  Full
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-gray-500">
        Visible text fields: {selectedTextFields}/{maxTextFields}. Priority
        order:{" "}
        {detailFieldOrder
          .slice(0, maxTextFields)
          .map((key) => memberFieldLabels[key])
          .join(", ")}
        .
      </p>
    </div>
  );
}
