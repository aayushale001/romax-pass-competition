"use client";

import { Building2, Palette } from "lucide-react";
import type { BrandProfile } from "@/types/card";
import { getInitials } from "@/components/templates/templateUtils";

type BrandSummaryProps = {
  brandProfile: BrandProfile;
};

export function BrandSummary({ brandProfile }: BrandSummaryProps) {
  const showLogoImage = brandProfile.logoMode === "image" && brandProfile.logoUrl;

  return (
    <div className="grid gap-5 border-y border-gray-200 py-5 lg:grid-cols-[1fr_220px]">
      <div className="min-w-0">
        <div className="mb-3 flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-gray-200 bg-white">
            {showLogoImage ? (
              <img
                src={brandProfile.logoUrl ?? ""}
                alt={`${brandProfile.businessName} logo`}
                className="h-full w-full object-contain p-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-sm font-bold text-gray-900">
                {getInitials(brandProfile.businessName)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-gray-950">
              {brandProfile.businessName}
            </h2>
            <p className="truncate text-sm text-gray-600">
              {brandProfile.industry}
            </p>
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-gray-700">
          {brandProfile.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {brandProfile.brandTone.map((tone) => (
            <span
              key={tone}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700"
            >
              {tone}
            </span>
          ))}
        </div>
      </div>
      <div className="grid content-start gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-950">
          <Palette size={16} />
          Brand colors
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[brandProfile.primaryColor, brandProfile.secondaryColor].map(
            (color) => (
              <div key={color} className="rounded-md border border-gray-200 p-2">
                <div
                  className="mb-2 h-8 rounded-md border border-black/10"
                  style={{ background: color }}
                />
                <div className="truncate text-xs font-semibold text-gray-700">
                  {color}
                </div>
              </div>
            ),
          )}
        </div>
        <div className="flex items-center gap-2 truncate text-xs text-gray-500">
          <Building2 size={14} />
          <span className="truncate">{brandProfile.websiteUrl}</span>
        </div>
      </div>
    </div>
  );
}
