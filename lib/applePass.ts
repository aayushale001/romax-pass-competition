import type { WalletReadyPass } from "@/types/card";

/**
 * Creates a real, installable Apple Wallet pass via pass2u.net.
 *
 * Native Apple Wallet only accepts passes signed by an Apple Pass Type ID
 * certificate (paid Developer Program). pass2u signs with *their* certificate,
 * so a free pass2u account yields a genuine "Add to Apple Wallet" link with no
 * Apple developer account of your own.
 *
 * Setup: create a pass model (template) in the pass2u dashboard, then set:
 *   PASS2U_API_KEY     your pass2u API key
 *   PASS2U_MODEL_ID    the model/template id the pass is built from
 *
 * The model's field keys should match the WalletReadyPass field keys
 * (name, memberId, tier, expiryDate, studentId, course, email, phone,
 * dateJoined, loyaltyPoints) so values populate.
 */

export type ApplePassInput = {
  pass: WalletReadyPass;
};

export async function createApplePassInstallUrl(
  input: ApplePassInput,
): Promise<{ installUrl: string }> {
  const apiKey = process.env.PASS2U_API_KEY;
  const modelId = process.env.PASS2U_MODEL_ID;

  if (!apiKey || !modelId) {
    throw new Error(
      "Apple Wallet (pass2u) is not configured. Set PASS2U_API_KEY and PASS2U_MODEL_ID in .env.local.",
    );
  }

  const { pass } = input;
  const memberId = pass.primaryFields.find(
    (field) => field.key === "memberId",
  )?.value;

  const fields = [
    ...pass.primaryFields,
    ...pass.secondaryFields,
    ...pass.auxiliaryFields,
  ].map((field) => ({
    key: field.key,
    label: field.label,
    value: field.value,
  }));

  const body = {
    barcode: {
      message: pass.barcode.message,
      altText: memberId ?? "",
      format: "PKBarcodeFormatQR",
    },
    fields,
  };

  const response = await fetch(
    `https://api.pass2u.net/v2/models/${modelId}/passes`,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept-Language": "en",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `pass2u request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as { passId?: string; id?: string };
  const passId = data.passId ?? data.id;
  if (!passId) {
    throw new Error("pass2u did not return a pass id.");
  }

  return { installUrl: `https://www.pass2u.net/d/${passId}` };
}
