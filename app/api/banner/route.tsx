import { ImageResponse } from "next/og";
import {
  getReadableTextColor,
  mixColors,
  normalizeHexColor,
} from "@/lib/colors";

export const runtime = "nodejs";

/**
 * Server-rendered brand banner used as the Google Wallet hero image (and
 * usable as an Apple strip image). Google fetches this URL once and caches it,
 * so it must be publicly reachable when a pass is created (e.g. via ngrok).
 *
 * GET /api/banner?title=Aayush%20Ale&subtitle=Membership&color=%23f1ead8
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "Membership").slice(0, 40);
  const subtitle = (searchParams.get("subtitle") ?? "Membership pass").slice(
    0,
    60,
  );
  const color = normalizeHexColor(
    searchParams.get("color") ?? undefined,
    "#1e3a5f",
  );
  const deep = mixColors(color, "#000000", 0.35);
  const ink = getReadableTextColor(color);
  const subtleInk = mixColors(ink, color, 0.35);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 72px",
          background: `linear-gradient(135deg, ${color} 0%, ${deep} 100%)`,
          color: ink,
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: subtleInk,
          }}
        >
          {subtitle}
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, marginTop: 12 }}>
          {title}
        </div>
      </div>
    ),
    { width: 1032, height: 336 },
  );
}
