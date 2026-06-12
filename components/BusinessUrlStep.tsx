"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import {
  CreditCard,
  Globe2,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { resizeImageFileToDataUrl } from "@/lib/imageDataUrl";

type CustomBrandSourceMode = "prompt" | "physical-card" | "visiting-card";
type ReferenceImageMode = "match-original" | "design-inspiration";

type CustomBrandPayload = {
  prompt: string;
  imageDataUrl?: string | null;
  sourceMode?: CustomBrandSourceMode;
  referenceImageMode?: ReferenceImageMode;
};

type BusinessUrlStepProps = {
  onSubmit: (url: string) => Promise<void>;
  onCustomSubmit: (payload: CustomBrandPayload) => Promise<void>;
  loading: boolean;
  status: string;
};

type Mode = "website" | "custom" | "card-photo";

const maxImageBytes = 5_000_000;

async function readImageFile(
  event: ChangeEvent<HTMLInputElement>,
  onLoad: (dataUrl: string) => void,
  onError: (message: string) => void,
) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    onError("Upload an image file.");
    return;
  }

  if (file.size > maxImageBytes) {
    onError("Image must be smaller than 5MB.");
    return;
  }

  try {
    const dataUrl = await resizeImageFileToDataUrl(file, {
      maxDimension: 1000,
      quality: 0.78,
      maxDataUrlLength: 520_000,
    });
    onLoad(dataUrl);
  } catch (error) {
    onError(
      error instanceof Error ? error.message : "Unable to prepare this image.",
    );
  }
}

export function BusinessUrlStep({
  onSubmit,
  onCustomSubmit,
  loading,
  status,
}: BusinessUrlStepProps) {
  const [mode, setMode] = useState<Mode>("website");
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [cardSourceMode, setCardSourceMode] =
    useState<Exclude<CustomBrandSourceMode, "prompt">>("physical-card");
  const [referenceImageMode, setReferenceImageMode] =
    useState<ReferenceImageMode>("match-original");
  const [localError, setLocalError] = useState("");

  async function handleWebsiteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(url);
  }

  async function handleCustomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    await onCustomSubmit({
      prompt,
      imageDataUrl,
      sourceMode: "prompt",
      referenceImageMode: "design-inspiration",
    });
  }

  async function handleCardPhotoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");

    if (!imageDataUrl) {
      setLocalError("Upload a card photo first.");
      return;
    }

    const defaultPrompt =
      cardSourceMode === "physical-card"
        ? "Create a digital membership card from this uploaded physical card photo."
        : "Create a digital membership card inspired by this uploaded visiting card photo.";

    await onCustomSubmit({
      prompt: prompt.trim() || defaultPrompt,
      imageDataUrl,
      sourceMode: cardSourceMode,
      referenceImageMode,
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2 rounded-md bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setMode("website")}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${
            mode === "website"
              ? "bg-white text-gray-950 shadow-sm"
              : "text-gray-600 hover:text-gray-950"
          }`}
        >
          <Globe2 size={15} />
          Website
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${
            mode === "custom"
              ? "bg-white text-gray-950 shadow-sm"
              : "text-gray-600 hover:text-gray-950"
          }`}
        >
          <Wand2 size={15} />
          Prompt
        </button>
        <button
          type="button"
          onClick={() => setMode("card-photo")}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${
            mode === "card-photo"
              ? "bg-white text-gray-950 shadow-sm"
              : "text-gray-600 hover:text-gray-950"
          }`}
        >
          <CreditCard size={15} />
          Card photo
        </button>
      </div>

      {mode === "website" ? (
        <form onSubmit={handleWebsiteSubmit} className="space-y-4">
          <label
            className="block text-sm font-semibold text-gray-950"
            htmlFor="url"
          >
            Business website
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Globe2
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                id="url"
                type="text"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                className="h-11 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              Process brand
            </button>
          </div>
        </form>
      ) : mode === "custom" ? (
        <form onSubmit={handleCustomSubmit} className="grid gap-4">
          <label
            className="grid gap-2 text-sm font-semibold text-gray-950"
            htmlFor="custom-prompt"
          >
            Card idea
            <textarea
              id="custom-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A premium black and gold gym membership for Apex Strength Club, bold and athletic, with photo and QR verification."
              rows={5}
              className="min-h-28 resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex min-h-24 cursor-pointer items-center gap-3 rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm transition hover:border-gray-950">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-gray-100 text-gray-700">
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus size={18} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900">
                  Optional image
                </span>
                <span className="block truncate text-gray-500">
                  {imageDataUrl
                    ? "Image selected"
                    : "Logo, moodboard, background, or reference"}
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  readImageFile(
                    event,
                    (dataUrl) => {
                      setImageDataUrl(dataUrl);
                      setLocalError("");
                    },
                    setLocalError,
                  )
                }
              />
            </label>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              Create profile
            </button>
          </div>

          {imageDataUrl ? (
            <button
              type="button"
              onClick={() => setImageDataUrl(null)}
              className="w-fit text-xs font-semibold text-gray-500 transition hover:text-gray-950"
            >
              Remove image
            </button>
          ) : null}
        </form>
      ) : (
        <form onSubmit={handleCardPhotoSubmit} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <span className="text-sm font-semibold text-gray-950">
                Source
              </span>
              <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-100 p-1">
                {[
                  ["physical-card", "Membership"] as const,
                  ["visiting-card", "Visiting"] as const,
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCardSourceMode(value)}
                    className={`h-9 rounded-md text-sm font-semibold transition ${
                      cardSourceMode === value
                        ? "bg-white text-gray-950 shadow-sm"
                        : "text-gray-600 hover:text-gray-950"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-semibold text-gray-950">
                Direction
              </span>
              <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-100 p-1">
                {[
                  ["match-original", "Match original"] as const,
                  ["design-inspiration", "Inspiration"] as const,
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReferenceImageMode(value)}
                    className={`h-9 rounded-md text-sm font-semibold transition ${
                      referenceImageMode === value
                        ? "bg-white text-gray-950 shadow-sm"
                        : "text-gray-600 hover:text-gray-950"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex min-h-24 cursor-pointer items-center gap-3 rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm transition hover:border-gray-950">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-gray-100 text-gray-700">
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus size={18} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900">
                  Card image
                </span>
                <span className="block truncate text-gray-500">
                  {imageDataUrl ? "Image selected" : "Upload front card photo"}
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  readImageFile(
                    event,
                    (dataUrl) => {
                      setImageDataUrl(dataUrl);
                      setLocalError("");
                    },
                    setLocalError,
                  )
                }
              />
            </label>

            <button
              type="submit"
              disabled={loading || !imageDataUrl}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              Create profile
            </button>
          </div>

          <label
            className="grid gap-2 text-sm font-semibold text-gray-950"
            htmlFor="card-photo-notes"
          >
            Notes
            <textarea
              id="card-photo-notes"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Coffee loyalty card, keep the stamp-card feel, make it wallet-ready."
              rows={3}
              className="min-h-20 resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-950 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10"
            />
          </label>

          {imageDataUrl ? (
            <button
              type="button"
              onClick={() => setImageDataUrl(null)}
              className="w-fit text-xs font-semibold text-gray-500 transition hover:text-gray-950"
            >
              Remove image
            </button>
          ) : null}
        </form>
      )}

      {localError ? (
        <p className="text-sm font-semibold text-red-700">{localError}</p>
      ) : null}
      {status ? <p className="text-sm text-gray-600">{status}</p> : null}
    </div>
  );
}
