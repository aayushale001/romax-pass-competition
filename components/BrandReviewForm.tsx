"use client";

import { Check, ImageIcon, Palette, Type, X } from "lucide-react";
import type {
  BrandColorUsage,
  BrandProfile,
  ScrapedAsset,
} from "@/types/card";
import { getInitials } from "@/components/templates/templateUtils";
import { getMutedAccent } from "@/lib/colors";

type BrandReviewFormProps = {
  brandProfile: BrandProfile;
  onChange: (brandProfile: BrandProfile) => void;
};

const colorUsageOptions: BrandColorUsage[] = [
  "balanced",
  "dominant",
  "gradient",
  "split-panel",
  "full-background",
  "subtle",
];

const roleLabels: Record<ScrapedAsset["role"], string> = {
  logoCandidate: "Logo",
  heroCandidate: "Hero",
  profileCandidate: "Profile",
  backgroundCandidate: "Background",
  unknown: "Unknown",
};

function assetMatches(asset: ScrapedAsset, roles: ScrapedAsset["role"][]) {
  return roles.includes(asset.role);
}

function AssetButton({
  asset,
  selected,
  onClick,
}: {
  asset: ScrapedAsset;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group grid min-w-0 gap-2 rounded-lg border bg-white p-2 text-left transition hover:border-gray-950 ${
        selected
          ? "border-gray-950 ring-2 ring-gray-950/10"
          : "border-gray-200"
      }`}
    >
      <div className="relative aspect-[1.6/1] overflow-hidden rounded-md bg-gray-100">
        <img
          src={asset.url}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
        {selected ? (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-emerald-500 text-white">
            <Check size={14} />
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs font-bold text-gray-900">
          {roleLabels[asset.role]}
        </span>
        <span className="text-[10px] font-semibold text-gray-500">
          {Math.round(asset.confidence * 100)}%
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-4 text-gray-500">
        {asset.reason}
      </p>
    </button>
  );
}

function AssetPicker({
  title,
  assets,
  selectedUrl,
  roles,
  onSelect,
  onClear,
}: {
  title: string;
  assets: ScrapedAsset[];
  selectedUrl?: string | null;
  roles: ScrapedAsset["role"][];
  onSelect: (url: string) => void;
  onClear: () => void;
}) {
  const candidates = assets
    .filter((asset) => assetMatches(asset, roles))
    .slice(0, 10);

  return (
    <section className="grid gap-3 border-t border-gray-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-950">{title}</h3>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
        >
          <X size={13} />
          Clear
        </button>
      </div>
      {candidates.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((asset) => (
            <AssetButton
              key={asset.id}
              asset={asset}
              selected={asset.url === selectedUrl}
              onClick={() => onSelect(asset.url)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
          No image candidates found.
        </div>
      )}
    </section>
  );
}

function HeroBackgroundPicker({
  assets,
  selectedHeroImageUrl,
  selectedBackgroundImageUrl,
  onHeroSelect,
  onBackgroundSelect,
  onHeroClear,
  onBackgroundClear,
}: {
  assets: ScrapedAsset[];
  selectedHeroImageUrl?: string | null;
  selectedBackgroundImageUrl?: string | null;
  onHeroSelect: (url: string) => void;
  onBackgroundSelect: (url: string) => void;
  onHeroClear: () => void;
  onBackgroundClear: () => void;
}) {
  const candidates = assets
    .filter((asset) =>
      assetMatches(asset, ["heroCandidate", "backgroundCandidate"]),
    )
    .slice(0, 12);

  return (
    <section className="grid gap-3 border-t border-gray-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-950">
          Hero/background candidates
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onHeroClear}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
          >
            <X size={13} />
            Clear hero
          </button>
          <button
            type="button"
            onClick={onBackgroundClear}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
          >
            <X size={13} />
            Clear background
          </button>
        </div>
      </div>
      {candidates.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((asset) => {
            const selectedAsHero = asset.url === selectedHeroImageUrl;
            const selectedAsBackground = asset.url === selectedBackgroundImageUrl;

            return (
              <div
                key={asset.id}
                className={`grid min-w-0 gap-2 rounded-lg border bg-white p-2 ${
                  selectedAsHero || selectedAsBackground
                    ? "border-gray-950 ring-2 ring-gray-950/10"
                    : "border-gray-200"
                }`}
              >
                <div className="relative aspect-[1.6/1] overflow-hidden rounded-md bg-gray-100">
                  <img
                    src={asset.url}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
                    {selectedAsHero ? (
                      <span className="rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-bold uppercase text-white">
                        Hero
                      </span>
                    ) : null}
                    {selectedAsBackground ? (
                      <span className="rounded-md bg-gray-950 px-2 py-1 text-[10px] font-bold uppercase text-white">
                        BG
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-gray-900">
                    {roleLabels[asset.role]}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500">
                    {Math.round(asset.confidence * 100)}%
                  </span>
                </div>
                <p className="line-clamp-2 text-[11px] leading-4 text-gray-500">
                  {asset.reason}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onHeroSelect(asset.url)}
                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
                  >
                    Use as hero
                  </button>
                  <button
                    type="button"
                    onClick={() => onBackgroundSelect(asset.url)}
                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
                  >
                    Use as BG
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
          No hero or background candidates found.
        </div>
      )}
    </section>
  );
}

function UnknownAssetGrid({ assets }: { assets: ScrapedAsset[] }) {
  const candidates = assets
    .filter((asset) => asset.role === "unknown")
    .slice(0, 12);

  return (
    <section className="grid gap-3 border-t border-gray-200 pt-5">
      <h3 className="text-sm font-bold text-gray-950">Unknown images</h3>
      {candidates.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((asset) => (
            <div
              key={asset.id}
              className="grid min-w-0 gap-2 rounded-lg border border-gray-200 bg-white p-2"
            >
              <div className="relative aspect-[1.6/1] overflow-hidden rounded-md bg-gray-100">
                <img
                  src={asset.url}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="truncate text-xs font-bold text-gray-900">
                {roleLabels[asset.role]}
              </div>
              <p className="line-clamp-2 text-[11px] leading-4 text-gray-500">
                {asset.reason}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
          No unknown images found.
        </div>
      )}
    </section>
  );
}

export function BrandReviewForm({
  brandProfile,
  onChange,
}: BrandReviewFormProps) {
  function update(patch: Partial<BrandProfile>) {
    onChange({ ...brandProfile, ...patch });
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-gray-950">
              Business name
            </span>
            <input
              type="text"
              value={brandProfile.businessName}
              onChange={(event) => update({ businessName: event.target.value })}
              className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-gray-950">
              Main color
            </span>
            <div className="flex gap-2">
              <input
                type="color"
                value={brandProfile.primaryColor}
                onChange={(event) =>
                  update({
                    primaryColor: event.target.value,
                    secondaryColor: getMutedAccent(event.target.value),
                    themeColor: event.target.value,
                  })
                }
                className="h-11 w-14 rounded-md border border-gray-300 bg-white p-1"
              />
              <input
                type="text"
                value={brandProfile.primaryColor}
                onChange={(event) =>
                  update({
                    primaryColor: event.target.value,
                    secondaryColor: getMutedAccent(event.target.value),
                    themeColor: event.target.value,
                  })
                }
                className="h-11 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-gray-950">
              Brand color usage
            </span>
            <select
              value={brandProfile.brandColorUsage}
              onChange={(event) =>
                update({
                  brandColorUsage: event.target.value as BrandColorUsage,
                })
              }
              className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
            >
              {colorUsageOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace("-", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid content-start gap-3">
          <div
            className="grid aspect-[1.586/1] place-items-center overflow-hidden rounded-lg border border-gray-200 bg-white p-4"
            style={{ borderColor: `${brandProfile.primaryColor}55` }}
          >
            {brandProfile.logoMode === "image" && brandProfile.logoUrl ? (
              <img
                src={brandProfile.logoUrl ?? ""}
                alt={`${brandProfile.businessName} logo`}
                className="max-h-full max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : brandProfile.logoMode === "none" ? (
              <ImageIcon size={34} className="text-gray-300" />
            ) : (
              <div
                className="grid h-20 w-20 place-items-center rounded-md text-2xl font-black text-white"
                style={{ background: brandProfile.primaryColor }}
              >
                {getInitials(brandProfile.businessName)}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update({ logoMode: "text-only", logoUrl: null })}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
            >
              <Type size={13} />
              Text only
            </button>
            <button
              type="button"
              onClick={() => update({ logoMode: "none", logoUrl: null })}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 transition hover:border-gray-950"
            >
              <X size={13} />
              No logo
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Palette size={13} />
            <span>{brandProfile.primaryColor}</span>
          </div>
        </div>
      </section>

      <AssetPicker
        title="Logo candidates"
        assets={brandProfile.assets}
        selectedUrl={brandProfile.logoUrl}
        roles={["logoCandidate"]}
        onSelect={(url) => update({ logoUrl: url, logoMode: "image" })}
        onClear={() => update({ logoUrl: null, logoMode: "text-only" })}
      />
      <HeroBackgroundPicker
        assets={brandProfile.assets}
        selectedHeroImageUrl={brandProfile.selectedHeroImageUrl}
        selectedBackgroundImageUrl={brandProfile.selectedBackgroundImageUrl}
        onHeroSelect={(url) => update({ selectedHeroImageUrl: url })}
        onBackgroundSelect={(url) =>
          update({ selectedBackgroundImageUrl: url })
        }
        onHeroClear={() => update({ selectedHeroImageUrl: null })}
        onBackgroundClear={() =>
          update({ selectedBackgroundImageUrl: null })
        }
      />
      <AssetPicker
        title="People/profile candidates"
        assets={brandProfile.assets}
        selectedUrl={brandProfile.selectedProfileImageUrl}
        roles={["profileCandidate"]}
        onSelect={(url) => update({ selectedProfileImageUrl: url })}
        onClear={() => update({ selectedProfileImageUrl: null })}
      />
      <UnknownAssetGrid assets={brandProfile.assets} />
    </div>
  );
}
