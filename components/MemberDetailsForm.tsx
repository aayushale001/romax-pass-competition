"use client";

import { ChangeEvent, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import type { MemberData, SelectedFields } from "@/types/card";
import { generateMemberId } from "@/lib/generateMemberId";
import { resizeImageFileToDataUrl } from "@/lib/imageDataUrl";

type MemberDetailsFormProps = {
  memberData: MemberData;
  selectedFields: SelectedFields;
  businessName: string;
  onChange: (memberData: MemberData) => void;
};

type TextField = {
  key: keyof MemberData;
  label: string;
  type?: string;
  placeholder?: string;
};

const fieldConfig: TextField[] = [
  { key: "name", label: "Name", placeholder: "Avery Morgan" },
  { key: "email", label: "Email", type: "email", placeholder: "avery@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+44 7700 900321" },
  { key: "memberId", label: "Member ID", placeholder: "MEM-0001" },
  { key: "expiryDate", label: "Expiry date", type: "date" },
  { key: "dateJoined", label: "Date joined", type: "date" },
  { key: "studentId", label: "Student ID", placeholder: "S-48291" },
  { key: "course", label: "Course", placeholder: "Design Systems" },
  { key: "loyaltyPoints", label: "Loyalty points", placeholder: "1250" },
];

async function readFile(
  event: ChangeEvent<HTMLInputElement>,
  onLoad: (dataUrl: string) => void,
  onError: (message: string) => void,
  maxDataUrlLength: number,
) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const dataUrl = await resizeImageFileToDataUrl(file, {
      maxDimension: 850,
      quality: 0.8,
      maxDataUrlLength,
      maxSourceBytes: 5_000_000,
    });
    onLoad(dataUrl);
    onError("");
  } catch (error) {
    onError(
      error instanceof Error ? error.message : "Unable to prepare this image.",
    );
  }
}

export function MemberDetailsForm({
  memberData,
  selectedFields,
  businessName,
  onChange,
}: MemberDetailsFormProps) {
  const [uploadError, setUploadError] = useState("");

  function update(key: keyof MemberData, value: string) {
    onChange({ ...memberData, [key]: value });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {fieldConfig
          .filter((field) => selectedFields[field.key as keyof SelectedFields])
          .map((field) => (
            <label key={field.key} className="grid gap-2 text-sm font-medium">
              <span className="text-gray-800">{field.label}</span>
              <div className="flex gap-2">
                <input
                  type={field.type ?? "text"}
                  value={memberData[field.key] ?? ""}
                  onChange={(event) => update(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
                  required={field.key === "name" || field.key === "memberId"}
                />
                {field.key === "memberId" ? (
                  <button
                    type="button"
                    onClick={() => update("memberId", generateMemberId(businessName))}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-gray-300 text-gray-700 transition hover:border-gray-950 hover:text-gray-950"
                    aria-label="Regenerate member ID"
                    title="Regenerate member ID"
                  >
                    <RefreshCw size={16} />
                  </button>
                ) : null}
              </div>
            </label>
          ))}

        {selectedFields.tier ? (
          <label className="grid gap-2 text-sm font-medium">
            <span className="text-gray-800">Tier</span>
            <select
              value={memberData.tier ?? ""}
              onChange={(event) => update("tier", event.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
            >
              <option value="">Select tier</option>
              <option value="Member">Member</option>
              <option value="Silver">Silver</option>
              <option value="Gold">Gold</option>
              <option value="VIP">VIP</option>
              <option value="Student">Student</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {selectedFields.photo ? (
          <label className="flex min-h-24 cursor-pointer items-center gap-3 rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm transition hover:border-gray-950">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gray-100 text-gray-700">
              <ImagePlus size={18} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900">Photo</span>
              <span className="block truncate text-gray-500">
                {memberData.photoUrl ? "Image selected" : "Upload image"}
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) =>
                readFile(
                  event,
                  (photoUrl) => onChange({ ...memberData, photoUrl }),
                  setUploadError,
                  360_000,
                )
              }
            />
          </label>
        ) : null}

        {selectedFields.decorativeArt ? (
          <label className="flex min-h-24 cursor-pointer items-center gap-3 rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm transition hover:border-gray-950">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gray-100 text-gray-700">
              <ImagePlus size={18} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900">
                Art/avatar slot
              </span>
              <span className="block truncate text-gray-500">
                {memberData.decorativeArtUrl
                  ? "Image selected"
                  : "Upload character, actor, avatar, or artwork"}
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) =>
                readFile(
                  event,
                  (decorativeArtUrl) =>
                    onChange({ ...memberData, decorativeArtUrl }),
                  setUploadError,
                  440_000,
                )
              }
            />
          </label>
        ) : null}
      </div>

      {uploadError ? (
        <p className="text-sm font-semibold text-red-700">{uploadError}</p>
      ) : null}
    </div>
  );
}
