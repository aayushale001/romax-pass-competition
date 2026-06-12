import crypto from "node:crypto";

export async function readJsonWithLimit<T = unknown>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new Error("Request body is too large.");
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new Error("Request body is too large.");
  }

  return JSON.parse(body) as T;
}

export function requireWalletIssuanceToken(request: Request) {
  const expectedToken = process.env.WALLET_ISSUANCE_TOKEN;
  if (!expectedToken) {
    throw new Error(
      "Wallet issuance is disabled. Export wallet-ready JSON unless a server-side WALLET_ISSUANCE_TOKEN is configured.",
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const actualToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";

  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(actualToken);
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    throw new Error("Wallet issuance is not authorized.");
  }
}
