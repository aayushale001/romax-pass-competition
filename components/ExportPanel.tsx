"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { Download, Loader2, Wallet } from "lucide-react";
import type { BrandProfile, MemberData, WalletReadyPass } from "@/types/card";

type ExportPanelProps = {
  walletReadyPass: WalletReadyPass;
  brandProfile: BrandProfile;
  memberData: MemberData;
  previewRef: RefObject<HTMLDivElement | null>;
};

export function ExportPanel({
  walletReadyPass,
  brandProfile,
  memberData,
  previewRef,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  const [walletError, setWalletError] = useState("");

  async function addToGoogleWallet() {
    setWalletPending(true);
    setWalletError("");
    try {
      const logoUrl =
        brandProfile.logoMode === "image" ? brandProfile.logoUrl ?? null : null;
      const heroUrl =
        brandProfile.selectedHeroImageUrl ??
        brandProfile.selectedBackgroundImageUrl ??
        null;
      const issuanceToken = process.env.NEXT_PUBLIC_WALLET_ISSUANCE_TOKEN;
      const response = await fetch("/api/wallet/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(issuanceToken
            ? { Authorization: `Bearer ${issuanceToken}` }
            : {}),
        },
        body: JSON.stringify({
          pass: walletReadyPass,
          objectSuffix: memberData.memberId || "member",
          logoUrl,
          heroUrl,
        }),
      });
      const payload = (await response.json()) as {
        saveUrl?: string;
        error?: string;
      };
      if (!response.ok || payload.error || !payload.saveUrl) {
        throw new Error(payload.error ?? "Unable to create the wallet pass.");
      }
      window.open(payload.saveUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : "Unable to add to wallet.",
      );
    } finally {
      setWalletPending(false);
    }
  }

  function addToAppleWallet() {
    setWalletError("Apple Wallet isn't available right now — coming soon.");
  }

  async function downloadPng() {
    if (!previewRef.current) {
      return;
    }

    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(previewRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = "membership-card-preview.png";
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addToGoogleWallet}
          disabled={walletPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {walletPending ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Wallet size={16} />
          )}
          Add to Google Wallet
        </button>
        <button
          type="button"
          onClick={addToAppleWallet}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          <Wallet size={16} />
          Add to Apple Wallet
        </button>
        <button
          type="button"
          onClick={downloadPng}
          disabled={exporting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:border-gray-950 disabled:opacity-60"
        >
          <Download size={16} />
          {exporting ? "Exporting" : "Download PNG"}
        </button>
      </div>
      {walletError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {walletError}
        </div>
      ) : null}
    </div>
  );
}
