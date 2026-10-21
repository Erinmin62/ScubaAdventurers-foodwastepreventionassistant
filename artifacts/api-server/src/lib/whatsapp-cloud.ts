import { createHmac, timingSafeEqual } from "node:crypto";

export type CloudConfig = {
  accessToken: string; phoneNumberId: string; graphVersion: string;
  templateName: string; language: string;
};
export type SendResult = {
  status: "accepted" | "failed" | "unknown"; providerMessageId?: string;
  error?: string; retryable: boolean;
};

/**
 * Official Meta Cloud API template transport. Not activated by the demo service.
 * Integration + owner authorization + approved template must precede live wiring.
 * No free-form/window assumption and no automatic retry after ambiguous timeout.
 */
export async function sendApprovedWhatsAppTemplate(
  config: CloudConfig,
  input: { phone: string; optedIn: boolean; title: string; detail: string; reviewUrl: string },
  http: typeof fetch = fetch,
): Promise<SendResult> {
  if (!input.optedIn || !/^\+[1-9]\d{7,14}$/.test(input.phone)) return { status: "failed", error: "Verified recipient opt-in and E.164 number required.", retryable: false };
  if (!config.accessToken || !/^\d+$/.test(config.phoneNumberId) || !/^v\d+\.\d+$/.test(config.graphVersion) ||
    !/^[a-z0-9_]+$/.test(config.templateName) || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(config.language)) {
    return { status: "failed", error: "Server-side Cloud API configuration is incomplete.", retryable: false };
  }
  let url: URL;
  try { url = new URL(input.reviewUrl); }
  catch { return { status: "failed", error: "A valid published HTTPS review URL is required.", retryable: false }; }
  if (url.protocol !== "https:" || url.username || url.password || !url.hash.startsWith("#token=")) {
    return { status: "failed", error: "A verified published HTTPS, expiring read-only review link is required.", retryable: false };
  }
  try {
    const response = await http(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        messaging_product: "whatsapp", recipient_type: "individual", to: input.phone.slice(1),
        type: "template", template: {
          name: config.templateName, language: { code: config.language },
          components: [{ type: "body", parameters: [
            { type: "text", text: input.title },
            { type: "text", text: input.detail },
            { type: "text", text: input.reviewUrl },
          ] }],
        },
      }),
    });
    if (!response.ok) return {
      status: "failed", error: `WhatsApp provider rejected request (HTTP ${response.status}).${response.status === 401 || response.status === 403 ? " Reconnect/replace credentials or review permissions before retrying." : ""}`,
      retryable: response.status === 429 || response.status >= 500,
    };
    const data = await response.json() as { messages?: { id?: string }[] };
    const id = data.messages?.[0]?.id;
    return id ? { status: "accepted", providerMessageId: id, retryable: false }
      : { status: "unknown", error: "Provider response lacks a message ID; do not blindly resend.", retryable: false };
  } catch {
    return { status: "unknown", error: "Network response unavailable. Delivery is unknown; do not blindly resend.", retryable: false };
  }
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function verifyWhatsAppSignature(raw: Buffer, signature: string, appSecret: string) {
  return !!appSecret && safeEqual(signature, `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`);
}
