import { lookup } from "node:dns/promises";
import net from "node:net";

const blockedHostnames = new Set(["localhost", "0.0.0.0"]);
const blockedHostnameSuffixes = [".localhost", ".local", ".internal", ".lan"];

type PublicFetchOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
};

function cleanHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function ipv4ToNumber(ip: string) {
  return ip.split(".").reduce((total, part) => {
    return (total << 8) + Number.parseInt(part, 10);
  }, 0) >>> 0;
}

function ipv4InRange(ip: string, cidrBase: string, bits: number) {
  const value = ipv4ToNumber(ip);
  const base = ipv4ToNumber(cidrBase);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

function isBlockedIpv4(ip: string) {
  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].some(([base, bits]) => ipv4InRange(ip, base as string, bits as number));
}

function isBlockedIpv6(ip: string) {
  const value = ip.toLowerCase();
  if (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fe80:") ||
    value.startsWith("ff") ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("2001:db8:")
  ) {
    return true;
  }

  const mappedIpv4 = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isBlockedIpv4(mappedIpv4) : false;
}

function isBlockedAddress(address: string) {
  const kind = net.isIP(address);
  if (kind === 4) return isBlockedIpv4(address);
  if (kind === 6) return isBlockedIpv6(address);
  return true;
}

export async function assertPublicHttpUrl(value: string) {
  const url = new URL(value);
  const hostname = cleanHostname(url.hostname);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not supported.");
  }

  if (
    blockedHostnames.has(hostname) ||
    blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("Local and private hostnames are not supported.");
  }

  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error("Local and private IP addresses are not supported.");
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("Local and private network destinations are not supported.");
  }
}

export async function fetchPublicUrl(
  inputUrl: string,
  init: RequestInit = {},
  options: PublicFetchOptions = {},
) {
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = inputUrl;

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    await assertPublicHttpUrl(currentUrl);
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
      signal:
        init.signal ??
        (options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined),
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")
    ) {
      currentUrl = new URL(response.headers.get("location")!, currentUrl).toString();
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error("Too many redirects while fetching this URL.");
}

export async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new Error("Website response is too large.");
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("Website response is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function readResponseBufferWithLimit(
  response: Response,
  maxBytes: number,
) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new Error("Remote image is too large.");
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("Remote image is too large.");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}
