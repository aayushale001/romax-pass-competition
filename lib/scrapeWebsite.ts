import * as cheerio from "cheerio";
import type { BrandProfile, ScrapedAsset } from "@/types/card";
import { getMutedAccent, normalizeHexColor } from "@/lib/colors";
import {
  hostnameAsBusinessName,
  normalizeWebsiteUrl,
  sanitizeText,
  toAbsoluteUrl,
  uniqueValues,
} from "@/lib/url";
import {
  fetchPublicUrl,
  readResponseTextWithLimit,
} from "@/lib/publicFetch";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const DEFAULT_PRIMARY = "#2563eb";
const BLOCKED_PRIMARY = "#111827";
const MAX_HTML_BYTES = 2_000_000;

function browserHeaders(baseUrl: string) {
  return {
    "User-Agent": USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: new URL(baseUrl).origin,
  };
}

function blockedBrandProfile(websiteUrl: string, status: number): BrandProfile {
  const businessName = hostnameAsBusinessName(websiteUrl);

  return {
    websiteUrl,
    businessName,
    description: `${businessName} blocks automated server-side scraping (${status}). Review and correct the brand details manually.`,
    industry: "General membership",
    logoUrl: null,
    logoMode: "text-only",
    faviconUrl: undefined,
    primaryColor: BLOCKED_PRIMARY,
    secondaryColor: getMutedAccent(BLOCKED_PRIMARY),
    themeColor: BLOCKED_PRIMARY,
    brandColorUsage: "balanced",
    headings: ["Manual brand review required"],
    images: [],
    assets: [],
    selectedHeroImageUrl: null,
    selectedBackgroundImageUrl: null,
    selectedProfileImageUrl: null,
    brandTone: ["modern", "professional"],
    confirmed: false,
  };
}

function metaContent(
  $: cheerio.CheerioAPI,
  selectors: string[],
  fallback = "",
) {
  for (const selector of selectors) {
    const value = sanitizeText($(selector).attr("content"));
    if (value) {
      return value;
    }
  }

  return fallback;
}

function linkHref($: cheerio.CheerioAPI, selectors: string[], baseUrl: string) {
  for (const selector of selectors) {
    const href = toAbsoluteUrl($(selector).attr("href"), baseUrl);
    if (href) {
      return href;
    }
  }

  return "";
}

function isBadBusinessName(name: string | undefined | null): boolean {
  if (!name) return true;
  const clean = name.trim().toLowerCase();
  return ["home", "homepage", "welcome", "index", "untitled", ""].includes(
    clean,
  );
}

type RawAsset = {
  url: string;
  alt: string;
  className: string;
  id: string;
  source: string;
  width?: number;
  height?: number;
};

function firstSrcsetUrl(value?: string) {
  return value?.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}

function numberAttr(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function collectRawAssets($: cheerio.CheerioAPI, baseUrl: string): RawAsset[] {
  const metaAssets: RawAsset[] = [
    {
      url: toAbsoluteUrl(metaContent($, ['meta[property="og:logo"]']), baseUrl),
      alt: "Open Graph logo",
      className: "",
      id: "",
      source: "og:logo",
    },
    {
      url: toAbsoluteUrl(metaContent($, ['meta[property="og:image"]']), baseUrl),
      alt: "Open Graph image",
      className: "",
      id: "",
      source: "og:image",
    },
    {
      url: toAbsoluteUrl(metaContent($, ['meta[name="twitter:image"]']), baseUrl),
      alt: "Twitter image",
      className: "",
      id: "",
      source: "twitter:image",
    },
  ].filter((asset) => asset.url);

  const pageAssets = $("img, source")
    .toArray()
    .map((element) => {
      const image = $(element);
      const src =
        image.attr("src") ??
        image.attr("data-src") ??
        image.attr("data-lazy-src") ??
        image.attr("data-original") ??
        firstSrcsetUrl(image.attr("srcset"));

      return {
        url: toAbsoluteUrl(src, baseUrl),
        alt: sanitizeText(image.attr("alt")),
        className: sanitizeText(image.attr("class")),
        id: sanitizeText(image.attr("id")),
        source: element.tagName,
        width: numberAttr(image.attr("width")),
        height: numberAttr(image.attr("height")),
      };
    })
    .filter((asset) => asset.url);

  const seen = new Set<string>();
  return [...metaAssets, ...pageAssets].filter((asset) => {
    if (seen.has(asset.url)) {
      return false;
    }
    seen.add(asset.url);
    return true;
  });
}

function classifyAsset(asset: RawAsset, index: number): ScrapedAsset {
  const haystack = [
    asset.url,
    asset.alt,
    asset.className,
    asset.id,
    asset.source,
  ]
    .join(" ")
    .toLowerCase();
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const isSmall = Boolean(width && height && width <= 320 && height <= 220);
  const isWide = Boolean(width && height && width / Math.max(height, 1) >= 1.6);
  const isLarge = Boolean(width >= 640 || height >= 420);

  const logoScore =
    (asset.source === "og:logo" ? 0.95 : 0) +
    (/\blogo\b|brandmark|logotype|site-logo|navbar-brand/.test(haystack)
      ? 0.62
      : 0) +
    (isSmall ? 0.14 : 0);
  const heroScore =
    (asset.source === "og:image" || asset.source === "twitter:image" ? 0.55 : 0) +
    (/hero|banner|cover|header|masthead|featured|main-image/.test(haystack)
      ? 0.44
      : 0) +
    (isLarge || isWide ? 0.2 : 0);
  const profileScore =
    (/avatar|profile|portrait|person|founder|team|headshot|speaker/.test(haystack)
      ? 0.72
      : 0) + (!isWide && isLarge ? 0.08 : 0);
  const backgroundScore =
    (/background|bg-|texture|pattern|wallpaper|scene|gallery/.test(haystack)
      ? 0.7
      : 0) +
    (isWide && isLarge ? 0.18 : 0);

  const scores = [
    {
      role: "logoCandidate" as const,
      score: logoScore,
      reason: "Logo-like filename, alt text, class, or small brand mark sizing.",
    },
    {
      role: "heroCandidate" as const,
      score: heroScore,
      reason: "Large social, hero, banner, cover, or header-style image.",
    },
    {
      role: "profileCandidate" as const,
      score: profileScore,
      reason: "Portrait, avatar, profile, founder, or team-style image.",
    },
    {
      role: "backgroundCandidate" as const,
      score: backgroundScore,
      reason: "Wide visual, background, pattern, gallery, or scene asset.",
    },
  ].sort((a, b) => b.score - a.score);

  const winner = scores[0];

  if (!winner || winner.score < 0.28) {
    return {
      id: `asset-${index + 1}`,
      url: asset.url,
      role: "unknown",
      confidence: 0.2,
      reason: "Image was found, but the role was not clear from page metadata.",
    };
  }

  return {
    id: `asset-${index + 1}`,
    url: asset.url,
    role: winner.role,
    confidence: Math.min(Number(winner.score.toFixed(2)), 0.98),
    reason: winner.reason,
  };
}

function extractAssets($: cheerio.CheerioAPI, baseUrl: string) {
  return collectRawAssets($, baseUrl)
    .slice(0, 30)
    .map((asset, index) => classifyAsset(asset, index));
}

function extractBrandName($: cheerio.CheerioAPI, websiteUrl: string) {
  const title = sanitizeText($("title").first().text());
  const firstHeading = sanitizeText($("h1").first().text());
  const titleParts = title
    .split(/\s[-|–—:]\s/)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidates = [
    metaContent($, ['meta[property="og:site_name"]']),
    metaContent($, ['meta[name="application-name"]']),
    metaContent($, ['meta[name="apple-mobile-web-app-title"]']),
    ...titleParts,
    title,
    firstHeading,
    sanitizeText($("h2").first().text()),
    hostnameAsBusinessName(websiteUrl),
  ];

  return (
    candidates.find((candidate) => !isBadBusinessName(candidate)) ??
    hostnameAsBusinessName(websiteUrl)
  );
}

function extractPrimaryColor($: cheerio.CheerioAPI) {
  const themeColor = metaContent($, [
    'meta[name="theme-color"]',
    'meta[name="msapplication-TileColor"]',
  ]);

  if (themeColor) {
    return normalizeHexColor(themeColor, DEFAULT_PRIMARY);
  }

  const styleText = $("style")
    .toArray()
    .map((element) => $(element).text())
    .join("\n")
    .slice(0, 10000);
  const firstHex = styleText.match(/#[0-9a-f]{6}\b/i)?.[0];

  return normalizeHexColor(firstHex, DEFAULT_PRIMARY);
}

function guessIndustry(text: string) {
  const value = text.toLowerCase();
  const matches: Array<[string, string[]]> = [
    ["Education", ["university", "student", "course", "school", "campus"]],
    ["Fitness club", ["gym", "fitness", "trainer", "wellness", "membership"]],
    ["Retail", ["shop", "store", "cart", "collection", "products"]],
    ["Hospitality", ["restaurant", "hotel", "cafe", "booking", "menu"]],
    ["Technology", ["software", "platform", "api", "data", "automation"]],
    ["Creative services", ["studio", "creative", "design", "brand", "agency"]],
    ["Community", ["community", "events", "members", "club", "network"]],
  ];

  return (
    matches.find(([, keywords]) =>
      keywords.some((keyword) => value.includes(keyword)),
    )?.[0] ?? "General membership"
  );
}

function guessTone(text: string) {
  const value = text.toLowerCase();
  const tones = new Set<string>();

  if (/(premium|exclusive|luxury|elevated|bespoke)/.test(value)) {
    tones.add("premium");
  }
  if (/(simple|clear|minimal|focused|clean)/.test(value)) {
    tones.add("clean");
  }
  if (/(fun|play|creative|bold|vibrant)/.test(value)) {
    tones.add("playful");
  }
  if (/(trusted|secure|official|professional|certified)/.test(value)) {
    tones.add("professional");
  }
  if (/(community|together|local|people|members)/.test(value)) {
    tones.add("community-led");
  }

  if (!tones.size) {
    tones.add("modern");
    tones.add("professional");
  }

  return Array.from(tones).slice(0, 5);
}

export async function scrapeWebsite(inputUrl: string): Promise<BrandProfile> {
  const websiteUrl = normalizeWebsiteUrl(inputUrl);
  const { response, finalUrl } = await fetchPublicUrl(
    websiteUrl,
    {
      headers: browserHeaders(websiteUrl),
    },
    { timeoutMs: 12000, maxRedirects: 3 },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return blockedBrandProfile(finalUrl, response.status);
    }

    throw new Error(`Website returned ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("Website did not return an HTML page.");
  }

  const html = await readResponseTextWithLimit(response, MAX_HTML_BYTES);
  const $ = cheerio.load(html);
  const headings = uniqueValues(
    $("h1, h2")
      .toArray()
      .map((element) => sanitizeText($(element).text()))
      .filter((value) => value.length > 1),
    8,
  );

  const description =
    metaContent($, [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) ||
    sanitizeText($("p").first().text()).slice(0, 220) ||
    `${hostnameAsBusinessName(websiteUrl)} membership pass`;

  const primaryColor = extractPrimaryColor($);
  const assets = extractAssets($, websiteUrl);
  const logoAsset = assets
    .filter((asset) => asset.role === "logoCandidate")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const heroAsset = assets
    .filter((asset) => asset.role === "heroCandidate")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const backgroundAsset = assets
    .filter((asset) => asset.role === "backgroundCandidate")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const profileAsset = assets
    .filter((asset) => asset.role === "profileCandidate")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const businessName = extractBrandName($, websiteUrl);
  const pageText = [
    businessName,
    description,
    ...headings,
    $("body").text().slice(0, 3000),
  ].join(" ");

  return {
    websiteUrl,
    businessName,
    description,
    industry: guessIndustry(pageText),
    logoUrl: logoAsset?.confidence >= 0.42 ? logoAsset.url : null,
    logoMode: logoAsset?.confidence >= 0.42 ? "image" : "text-only",
    faviconUrl: linkHref(
      $,
      [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
      ],
      websiteUrl,
    ),
    primaryColor,
    secondaryColor: getMutedAccent(primaryColor),
    themeColor: primaryColor,
    brandColorUsage: "balanced",
    headings,
    images: assets.map((asset) => asset.url).slice(0, 20),
    assets,
    selectedHeroImageUrl: heroAsset?.url ?? null,
    selectedBackgroundImageUrl: backgroundAsset?.url ?? heroAsset?.url ?? null,
    selectedProfileImageUrl: profileAsset?.url ?? null,
    brandTone: guessTone(pageText),
    confirmed: false,
  };
}
