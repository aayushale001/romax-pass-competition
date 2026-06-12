const PRIVATE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

export function normalizeWebsiteUrl(input: string) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not supported.");
  }

  if (PRIVATE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Local and private hostnames are not supported.");
  }

  return url.toString();
}

export function toAbsoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

export function sanitizeText(value: string | undefined, fallback = "") {
  return (value ?? fallback).replace(/\s+/g, " ").trim();
}

export function uniqueValues(values: string[], max = 10) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, max);
}

export function hostnameAsBusinessName(websiteUrl: string) {
  const hostname = new URL(websiteUrl).hostname.replace(/^www\./, "");
  const base = hostname.split(".")[0] ?? "Business";

  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
